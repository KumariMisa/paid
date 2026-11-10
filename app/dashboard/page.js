import Link from 'next/link';
import { connectorUrl } from '@/lib/urls';
import { requireUser } from '@/lib/auth';
import { listInvoices, totals, displayStatus } from '@/lib/invoices';
import { money, prettyDate, relativeTime } from '@/lib/format';
import TopBar from '@/components/TopBar';
import StatusPill from '@/components/StatusPill';
import CopyButton from '@/components/CopyButton';
import AutoRefresh from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await requireUser();
  const invoices = await listInvoices(user.id);
  const mcpUrl = connectorUrl(user.mcp_key);

  const month = new Date().toISOString().slice(0, 7);
  let outstanding = 0, overdue = 0, overdueCount = 0, paidMonth = 0;
  for (const inv of invoices) {
    const t = totals(inv).total;
    const ds = displayStatus(inv);
    if (inv.status === 'sent') outstanding += t;
    if (ds === 'overdue') { overdue += t; overdueCount++; }
    if (inv.status === 'paid' && inv.paid_at && new Date(inv.paid_at).toISOString().slice(0, 7) === month) paidMonth += t;
  }

  return (
    <>
      <TopBar user={user} current="invoices" />
      <AutoRefresh />
      <main className="page">
        <div className="page-head">
          <h1>Invoices</h1>
          <Link href="/invoices/new" className="btn btn--quiet">New invoice by hand</Link>
        </div>

        <div className="ledger-summary">
          <div><span className="muted small">Waiting to be paid</span><span className="figure num">{money(outstanding)}</span></div>
          <div className="late"><span className="muted small">Overdue{overdueCount ? ` (${overdueCount})` : ''}</span><span className="figure num">{money(overdue)}</span></div>
          <div className="paidsum"><span className="muted small">Paid this month</span><span className="figure num">{money(paidMonth)}</span></div>
        </div>

        <section className="connect" aria-labelledby="connect-h" style={{ marginTop: 24 }}>
          <div>
            <h2 id="connect-h">{invoices.length ? 'Your Claude connector' : 'Connect Claude to start'}</h2>
            <ol>
              <li>In Claude, open Settings, then Connectors, and choose Add custom connector.</li>
              <li>Name it Paid and paste this link. No other setup is needed.</li>
              <li>In a chat, ask Claude to invoice a client. It shows up here.</li>
            </ol>
          </div>
          <div className="keybox"><code title={mcpUrl}>{mcpUrl}</code><CopyButton value={mcpUrl} label="Copy link" /></div>
        </section>

        {invoices.length === 0 ? (
          <div className="empty">
            <h2>No invoices yet</h2>
            <p>Try this in Claude: “Invoice Halden Coffee for 12 hours of design at ₹2,500 an hour, plus 18% GST, due in 15 days.”</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="inv-table">
              <thead>
                <tr><th>Invoice</th><th>Client</th><th>Status</th><th>Due</th><th className="right">Amount</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const ds = displayStatus(inv);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/invoices/${inv.id}`} className="num">{inv.number}</Link>
                        <div className="via">{inv.created_via === 'claude' ? 'Made in Claude' : 'Made by hand'}, {relativeTime(inv.created_at)}</div>
                      </td>
                      <td className="inv-client">{inv.client_name}</td>
                      <td>
                        <StatusPill status={ds} />
                        {inv.client_reported_paid_at && inv.status !== 'paid' && <div className="via">Client says paid</div>}
                      </td>
                      <td className="num">{prettyDate(inv.due_date)}</td>
                      <td className="right num" style={{ fontWeight: 600 }}>{money(totals(inv).total, inv.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
