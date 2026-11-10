// A small, dependency-free MCP server (Streamable HTTP transport, stateless, JSON responses).
// Claude sends JSON-RPC over POST; we answer each request with plain JSON.
import { sql } from './db';
import {
  createInvoice, listInvoices, getInvoice, updateInvoice, setStatus,
  totals, displayStatus, daysOverdue, InvoiceError,
} from './invoices';
import { money, prettyDate } from './format';

const SERVER_INFO = { name: 'paid-invoices', title: 'Paid', version: '1.0.0' };

const INSTRUCTIONS = `Paid is the user's invoicing app. You turn messy inputs (chats, timesheets, emails, notes) into invoices with create_invoice; Paid stores them, gives each one a live link the user's client can open and pay by UPI, and tracks whether the client viewed or paid it.
- Never invent rates, quantities or client names. If the source doesn't say, ask the user.
- Paid calculates subtotal, tax and total itself, so send quantity and rate per line, not totals.
- New invoices are drafts. After creating or changing one, always show the user both links from the result: the edit link (for them) and the client link (to share).
- For follow-ups, call list_invoices with status "overdue" or "unpaid", then draft the reminder message yourself.`;

const itemSchema = {
  type: 'object',
  properties: {
    description: { type: 'string', description: 'What was delivered, written clearly for the client.' },
    quantity: { type: 'number', description: 'Hours, units or 1 for a fixed fee.' },
    rate: { type: 'number', description: 'Price per unit, before tax, in the invoice currency.' },
  },
  required: ['description', 'quantity', 'rate'],
};

const TOOLS = [
  {
    name: 'create_invoice',
    title: 'Create invoice',
    description: 'Create a draft invoice in Paid from line items you extracted. Paid computes totals and returns an edit link for the user and a payment link for their client.',
    inputSchema: {
      type: 'object',
      properties: {
        client_name: { type: 'string', description: 'Client company or person being billed.' },
        client_email: { type: 'string', description: 'Client billing email, if known.' },
        items: { type: 'array', items: itemSchema, minItems: 1 },
        tax_percent: { type: 'number', description: 'Tax rate in percent, e.g. 18 for GST at 18%. Use 0 if none.' },
        due_in_days: { type: 'integer', description: 'Days until payment is due. Default 15. Ignored if due_date is given.' },
        due_date: { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        currency: { type: 'string', description: 'ISO currency code. Default INR.' },
        notes: { type: 'string', description: 'Short note shown on the invoice, e.g. project reference or thank-you line.' },
      },
      required: ['client_name', 'items'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  {
    name: 'list_invoices',
    title: 'List invoices',
    description: 'List the user\'s invoices with status, amount, due date and whether the client has opened the link. Use this to answer "who owes me?" or to plan follow-ups.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['all', 'draft', 'sent', 'viewed', 'unpaid', 'overdue', 'paid'], description: 'Filter. "unpaid" means sent but not yet paid. Default all.' },
        client: { type: 'string', description: 'Only invoices whose client name contains this text.' },
      },
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_invoice',
    title: 'Get invoice',
    description: 'Get one invoice with its line items, totals, status, view history and links.',
    inputSchema: {
      type: 'object',
      properties: { invoice: { type: 'string', description: 'Invoice number, e.g. INV-0003 (or just 3).' } },
      required: ['invoice'],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'update_invoice',
    title: 'Update invoice',
    description: 'Change an existing invoice. Only send the fields that change. Sending items replaces the whole list of line items.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice: { type: 'string', description: 'Invoice number, e.g. INV-0003.' },
        client_name: { type: 'string' },
        client_email: { type: 'string' },
        items: { type: 'array', items: itemSchema, minItems: 1 },
        tax_percent: { type: 'number' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        currency: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['invoice'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'set_invoice_status',
    title: 'Set invoice status',
    description: 'Mark an invoice as sent (shared with the client), paid (money received) or back to draft.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice: { type: 'string', description: 'Invoice number, e.g. INV-0003.' },
        status: { type: 'string', enum: ['draft', 'sent', 'paid'] },
      },
      required: ['invoice', 'status'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
];

function describe(inv, base) {
  const t = totals(inv);
  const ds = displayStatus(inv);
  return {
    number: inv.number,
    client: inv.client_name,
    client_email: inv.client_email,
    status: ds,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    days_overdue: ds === 'overdue' ? daysOverdue(inv) : 0,
    currency: inv.currency,
    items: inv.items,
    tax_percent: inv.tax_percent,
    subtotal: t.subtotal,
    tax: t.tax,
    total: t.total,
    total_display: money(t.total, inv.currency),
    client_opened_link: inv.view_count > 0,
    times_opened: inv.view_count,
    last_opened_at: inv.last_viewed_at,
    client_says_paid: Boolean(inv.client_reported_paid_at),
    notes: inv.notes,
    edit_url: `${base}/invoices/${inv.id}`,
    client_link: `${base}/i/${inv.slug}`,
  };
}

function row(inv) {
  const ds = displayStatus(inv);
  const extra = ds === 'overdue' ? `, ${daysOverdue(inv)} days overdue` : '';
  const seen = inv.status === 'sent' ? (inv.view_count > 0 ? ', client opened it' : ', not opened yet') : '';
  return `${inv.number} | ${inv.client_name} | ${money(totals(inv).total, inv.currency)} | ${ds}${extra}${seen} | due ${prettyDate(inv.due_date)}`;
}

const text = (s, isError = false) => ({ content: [{ type: 'text', text: s }], ...(isError ? { isError: true } : {}) });

async function callTool(user, name, args, base) {
  args = args || {};
  switch (name) {
    case 'create_invoice': {
      const inv = await createInvoice(user.id, args, 'claude');
      const d = describe(inv, base);
      return text(`Created draft ${d.number} for ${d.client}: ${d.total_display} (incl. ${d.tax_percent}% tax), due ${prettyDate(d.due_date)}.
Edit and send it here: ${d.edit_url}
Client payment link: ${d.client_link}

${JSON.stringify(d, null, 2)}`);
    }
    case 'list_invoices': {
      const rows = await listInvoices(user.id, args);
      if (rows.length === 0) return text('No invoices match that filter.');
      const outstanding = rows.filter((r) => r.status === 'sent').reduce((s, r) => s + totals(r).total, 0);
      return text(`${rows.length} invoice(s). Outstanding in this list: ${money(outstanding)}.
${rows.map(row).join('\n')}

Dashboard: ${base}/dashboard`);
    }
    case 'get_invoice': {
      const inv = await getInvoice(user.id, args.invoice);
      return text(JSON.stringify(describe(inv, base), null, 2));
    }
    case 'update_invoice': {
      const { invoice, ...patch } = args;
      const inv = await updateInvoice(user.id, invoice, patch, 'claude');
      const d = describe(inv, base);
      return text(`Updated ${d.number}. New total ${d.total_display}.
Edit link: ${d.edit_url}
Client link: ${d.client_link}

${JSON.stringify(d, null, 2)}`);
    }
    case 'set_invoice_status': {
      const inv = await setStatus(user.id, args.invoice, args.status, 'claude');
      return text(`${inv.number} is now ${displayStatus(inv)}. ${base}/invoices/${inv.id}`);
    }
    default:
      return null;
  }
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

async function handleMessage(msg, user, base) {
  if (!msg || typeof msg !== 'object') return rpcError(null, -32600, 'Invalid request');
  if (msg.method === undefined) return null; // a response from the client; nothing to answer
  if (typeof msg.method !== 'string') return rpcError(msg.id, -32600, 'Invalid request');
  const isNotification = !('id' in msg);
  if (isNotification) return null;
  const { id, method, params } = msg;
  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: typeof params?.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18',
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };
    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };
    case 'tools/call': {
      try {
        const result = await callTool(user, params?.name, params?.arguments, base);
        if (!result) return rpcError(id, -32602, `Unknown tool: ${params?.name}`);
        return { jsonrpc: '2.0', id, result };
      } catch (e) {
        if (e instanceof InvoiceError) return { jsonrpc: '2.0', id, result: text(e.message, true) };
        console.error('tool error', e);
        return { jsonrpc: '2.0', id, result: text('Paid hit an unexpected error. Try again in a moment.', true) };
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Accept',
};

const json = (body, status = 200) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === null ? {} : { 'Content-Type': 'application/json' }), ...CORS },
  });

function baseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function handleMcp(req, key) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response('This is an MCP endpoint. Add it to Claude as a custom connector.', {
      status: 405, headers: { Allow: 'POST', ...CORS },
    });
  }
  const [user] = key ? await sql`select id, business_name from users where mcp_key = ${key}` : [];
  if (!user) {
    return json(rpcError(null, -32001, 'Unknown connector link. Copy your link again from Paid → Settings.'), 404);
  }
  let body;
  try {
    body = await req.json();
  } catch {
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }
  const base = baseUrl(req);
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(m, user, base)))).filter(Boolean);
    return out.length ? json(out) : json(null, 202);
  }
  const res = await handleMessage(body, user, base);
  return res ? json(res) : json(null, 202);
}
