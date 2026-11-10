// Creates tables and a demo account. Safe to run more than once.
import fs from 'node:fs';
import postgres from 'postgres';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('Set DATABASE_URL first.'); process.exit(1); }
const sql = postgres(url, { prepare: false, onnotice: () => {} });

await sql.unsafe(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));

const DEMO_EMAIL = 'demo@paid.app';
const DEMO_KEY = process.env.DEMO_MCP_KEY || 'pk_demo_volopay_2026';
const existing = await sql`select id from users where email = ${DEMO_EMAIL}`;
if (existing.length === 0) {
  const [u] = await sql`
    insert into users (email, password_hash, business_name, upi_id, mcp_key)
    values (${DEMO_EMAIL}, ${bcrypt.hashSync('demo1234', 10)}, 'Misa Studio', 'misastudio@okaxis', ${DEMO_KEY})
    returning id`;
  const seed = [
    { n: 'INV-0001', client: 'Halden Coffee Co.', email: 'accounts@haldencoffee.in', status: 'paid', daysAgo: 40, due: -25,
      items: [{ description: 'Brand refresh: logo and colour system', quantity: 1, rate: 45000 }], views: 3 },
    { n: 'INV-0002', client: 'Northwind Logistics', email: 'ap@northwind.in', status: 'sent', daysAgo: 24, due: -9,
      items: [{ description: 'Dashboard UI design (hours)', quantity: 18, rate: 2000 }, { description: 'Design system handoff', quantity: 1, rate: 8000 }], views: 2 },
  ];
  for (const s of seed) {
    const [inv] = await sql`
      insert into invoices (user_id, number, slug, client_name, client_email, issue_date, due_date, tax_percent, items, status, created_via, view_count, first_viewed_at, last_viewed_at, paid_at, created_at)
      values (${u.id}, ${s.n}, ${'demo-' + s.n.toLowerCase()}, ${s.client}, ${s.email},
        current_date - ${s.daysAgo}::int, current_date + ${s.due}::int, 18, ${sql.json(s.items)}, ${s.status}, 'claude', ${s.views},
        now() - ${s.daysAgo - 2 + ' days'}::interval, now() - interval '3 days',
        ${s.status === 'paid' ? sql`now() - ${s.daysAgo - 6 + ' days'}::interval` : null}, now() - ${s.daysAgo + ' days'}::interval)
      returning id`;
    await sql`insert into invoice_events (invoice_id, type, created_at) values (${inv.id}, 'created_claude', now() - ${s.daysAgo + ' days'}::interval)`;
    await sql`insert into invoice_events (invoice_id, type, created_at) values (${inv.id}, 'sent', now() - ${s.daysAgo - 1 + ' days'}::interval)`;
    await sql`insert into invoice_events (invoice_id, type, created_at) values (${inv.id}, 'viewed', now() - ${s.daysAgo - 2 + ' days'}::interval)`;
    if (s.status === 'paid') await sql`insert into invoice_events (invoice_id, type, created_at) values (${inv.id}, 'paid', now() - ${s.daysAgo - 6 + ' days'}::interval)`;
  }
  console.log(`Demo account created: ${DEMO_EMAIL} / demo1234 (connector key ${DEMO_KEY})`);
} else {
  console.log('Demo account already exists.');
}
console.log('Database ready.');
await sql.end();
