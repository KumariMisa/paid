import crypto from 'node:crypto';
import { sql } from './db';
import { todayIST, addDays, daysBetween } from './format';

const COLS = sql`
  id, user_id, number, slug, client_name, client_email,
  issue_date::text as issue_date, due_date::text as due_date,
  currency, tax_percent::float8 as tax_percent, items, notes, status, created_via,
  view_count, first_viewed_at, last_viewed_at, client_reported_paid_at, paid_at, created_at, updated_at`;

export class InvoiceError extends Error {}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new InvoiceError('Add at least one line item.');
  if (items.length > 50) throw new InvoiceError('An invoice can have at most 50 line items.');
  return items.map((it, i) => {
    const description = String(it?.description ?? '').trim();
    const quantity = Number(it?.quantity ?? 1);
    const rate = Number(it?.rate ?? it?.unit_price ?? 0);
    if (!description) throw new InvoiceError(`Line ${i + 1} needs a description.`);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new InvoiceError(`Line ${i + 1} needs a quantity above 0.`);
    if (!Number.isFinite(rate) || rate < 0) throw new InvoiceError(`Line ${i + 1} needs a rate of 0 or more.`);
    return { description: description.slice(0, 300), quantity: round2(quantity), rate: round2(rate) };
  });
}

export function totals(inv) {
  const subtotal = round2((inv.items || []).reduce((s, it) => s + Number(it.quantity) * Number(it.rate), 0));
  const tax = round2((subtotal * Number(inv.tax_percent || 0)) / 100);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

// draft | sent | viewed | overdue | paid
export function displayStatus(inv) {
  if (inv.status === 'paid') return 'paid';
  if (inv.status === 'draft') return 'draft';
  if (inv.due_date < todayIST()) return 'overdue';
  if (inv.view_count > 0) return 'viewed';
  return 'sent';
}

function validDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
}

function checkTax(t) {
  const n = Number(t ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new InvoiceError('Tax percent must be between 0 and 100.');
  return n;
}

async function logEvent(invoiceId, type, detail = null) {
  await sql`insert into invoice_events (invoice_id, type, detail) values (${invoiceId}, ${type}, ${detail})`;
}

export async function createInvoice(userId, input, via = 'web') {
  const clientName = String(input.client_name ?? '').trim();
  if (!clientName) throw new InvoiceError('client_name is required.');
  const items = normalizeItems(input.items);
  const issue = validDate(input.issue_date) ? input.issue_date : todayIST();
  let due;
  if (input.due_date !== undefined && input.due_date !== null && input.due_date !== '') {
    if (!validDate(input.due_date)) throw new InvoiceError('due_date must look like YYYY-MM-DD.');
    due = input.due_date;
  } else {
    const days = Number(input.due_in_days ?? 15);
    due = addDays(issue, Number.isFinite(days) && days >= 0 ? Math.round(days) : 15);
  }
  const currency = String(input.currency || 'INR').toUpperCase().slice(0, 3);
  const tax = checkTax(input.tax_percent);

  for (let attempt = 0; attempt < 3; attempt++) {
    const [{ next }] = await sql`
      select coalesce(max((substring(number from '[0-9]+$'))::int), 0) + 1 as next
      from invoices where user_id = ${userId}`;
    const number = 'INV-' + String(next).padStart(4, '0');
    const slug = crypto.randomBytes(8).toString('base64url');
    try {
      const [inv] = await sql`
        insert into invoices (user_id, number, slug, client_name, client_email, issue_date, due_date, currency, tax_percent, items, notes, created_via)
        values (${userId}, ${number}, ${slug}, ${clientName.slice(0, 200)}, ${input.client_email?.trim() || null},
          ${issue}, ${due}, ${currency}, ${tax}, ${sql.json(items)}, ${input.notes?.trim() || null}, ${via})
        returning ${COLS}`;
      await logEvent(inv.id, via === 'claude' ? 'created_claude' : 'created_web');
      return inv;
    } catch (e) {
      if (e.code === '23505' && attempt < 2) continue; // number collision, retry
      throw e;
    }
  }
}

export async function getInvoice(userId, ref) {
  const r = String(ref ?? '').trim();
  if (!r) throw new InvoiceError('Give an invoice number like INV-0003.');
  const isUuid = /^[0-9a-f-]{36}$/i.test(r);
  const num = /^\d+$/.test(r) ? 'INV-' + r.padStart(4, '0') : r.toUpperCase();
  const [inv] = isUuid
    ? await sql`select ${COLS} from invoices where user_id = ${userId} and id = ${r}`
    : await sql`select ${COLS} from invoices where user_id = ${userId} and upper(number) = ${num}`;
  if (!inv) throw new InvoiceError(`No invoice found for "${r}".`);
  return inv;
}

export async function getInvoiceBySlug(slug) {
  const [inv] = await sql`select ${COLS} from invoices where slug = ${slug}`;
  return inv || null;
}

export async function listInvoices(userId, { status = 'all', client } = {}) {
  let rows = await sql`select ${COLS} from invoices where user_id = ${userId} order by created_at desc limit 500`;
  if (client) {
    const q = String(client).toLowerCase();
    rows = rows.filter((r) => r.client_name.toLowerCase().includes(q));
  }
  if (status && status !== 'all') {
    rows = rows.filter((r) => {
      const ds = displayStatus(r);
      if (status === 'unpaid') return r.status === 'sent';
      if (status === 'sent') return ds === 'sent' || ds === 'viewed';
      return ds === status;
    });
  }
  return rows;
}

const EDITABLE = ['client_name', 'client_email', 'issue_date', 'due_date', 'currency', 'tax_percent', 'items', 'notes'];

export async function updateInvoice(userId, ref, patch, via = 'web') {
  const inv = await getInvoice(userId, ref);
  const next = {};
  for (const k of EDITABLE) if (patch[k] !== undefined) next[k] = patch[k];
  if (next.items !== undefined) next.items = normalizeItems(next.items);
  if (next.client_name !== undefined) {
    next.client_name = String(next.client_name).trim();
    if (!next.client_name) throw new InvoiceError('Client name cannot be empty.');
  }
  if (next.client_email !== undefined) next.client_email = String(next.client_email || '').trim() || null;
  if (next.notes !== undefined) next.notes = String(next.notes || '').trim() || null;
  for (const d of ['issue_date', 'due_date']) if (next[d] !== undefined && !validDate(next[d])) throw new InvoiceError(`${d} must look like YYYY-MM-DD.`);
  if (next.tax_percent !== undefined) next.tax_percent = checkTax(next.tax_percent);
  if (next.currency !== undefined) next.currency = String(next.currency).toUpperCase().slice(0, 3);

  const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(inv[k]));
  if (changed.length === 0) return inv;
  const values = { ...next, updated_at: new Date() };
  if (values.items) values.items = sql.json(values.items);
  const [updated] = await sql`update invoices set ${sql(values, Object.keys(values))} where id = ${inv.id} returning ${COLS}`;
  await logEvent(inv.id, via === 'claude' ? 'edited_claude' : 'edited_web', changed.map((c) => c.replace('_', ' ')).join(', '));
  return updated;
}

export async function setStatus(userId, ref, status, via = 'web') {
  if (!['draft', 'sent', 'paid'].includes(status)) throw new InvoiceError('Status must be draft, sent or paid.');
  const inv = await getInvoice(userId, ref);
  if (inv.status === status) return inv;
  const [updated] = await sql`
    update invoices set status = ${status}, updated_at = now(),
      paid_at = ${status === 'paid' ? sql`now()` : null}
    where id = ${inv.id} returning ${COLS}`;
  await logEvent(inv.id, status === 'draft' ? 'reopened' : status, via === 'claude' ? 'via Claude' : null);
  return updated;
}

export async function deleteInvoice(userId, ref) {
  const inv = await getInvoice(userId, ref);
  await sql`delete from invoices where id = ${inv.id}`;
}

export async function recordView(inv) {
  await sql`
    update invoices set view_count = view_count + 1,
      first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
    where id = ${inv.id}`;
  // Log at most one "viewed" event per hour so the activity list stays readable.
  const [recent] = await sql`
    select 1 from invoice_events where invoice_id = ${inv.id} and type = 'viewed' and created_at > now() - interval '1 hour'`;
  if (!recent) await logEvent(inv.id, 'viewed');
}

export async function clientReportsPaid(inv) {
  if (inv.client_reported_paid_at || inv.status === 'paid') return;
  await sql`update invoices set client_reported_paid_at = now() where id = ${inv.id}`;
  await logEvent(inv.id, 'client_reported_paid');
}

export async function getEvents(invoiceId) {
  return sql`select type, detail, created_at from invoice_events where invoice_id = ${invoiceId} order by created_at desc, id desc limit 50`;
}

export function daysOverdue(inv) {
  return Math.max(0, daysBetween(inv.due_date, todayIST()));
}
