import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { getInvoice, getEvents, totals, displayStatus, InvoiceError } from '@/lib/invoices';
import { money, prettyDate, relativeTime } from '@/lib/format';
import { appBase } from '@/lib/urls';
import TopBar from '@/components/TopBar';
import StatusPill from '@/components/StatusPill';
import InvoiceEditor from '@/components/InvoiceEditor';
import InvoiceActions from '@/components/InvoiceActions';
import AutoRefresh from '@/components/AutoRefresh';

export const dynamic = 'force-dynamic';

const EVENT_TEXT = {
  created_claude: 'Created by Claude',
  created_web: 'Created by hand',
  edited_claude: 'Edited by Claude',
  edited_web: 'Edited by you',
  sent: 'Marked as sent',
  viewed: 'Client opened the link',
  client_reported_paid: 'Client said they paid',
  paid: 'Marked as paid',
  reopened: 'Moved back to draft',
};
const EVENT_CLASS = { created_claude: 'claude', edited_claude: 'claude', viewed: 'viewed', paid: 'paid', client_reported_paid: 'client_reported_paid' };

export default async function InvoicePage({ params }) {
  const user = await requireUser();
  let inv;
  try { inv = await getInvoice(user.id, params.id); } catch (e) { if (e instanceof InvoiceError) notFound(); throw e; }
  const events = await getEvents(inv.id);
  const ds = displayStatus(inv);
  const clientLink = `${appBase()}/i/${inv.slug}`;
  const plain = JSON.parse(JSON.stringify(inv));

  return (
    <>
      <TopBar user={user} current="invoices" />
      <AutoRefresh every={5000} />
      <main className="page">
        <div className="page-head">
          <div>
            <Link href="/dashboard" className="small muted">Back to invoices</Link>
            <h1 style={{ marginTop: 6 }}>Invoice for {inv.client_name} <StatusPill status={ds} /></h1>
          </div>
        </div>
        <div className="inv-layout">
          <InvoiceEditor invoice={plain} businessName={user.business_name} paidDate={inv.paid_at ? prettyDate(new Date(inv.paid_at).toISOString()) : ''} />
          <aside className="side">
            <InvoiceActions invoice={plain} clientLink={clientLink} displayStatus={ds} totalText={money(totals(inv).total, inv.currency)} businessName={user.business_name} />
            <div className="side-block">
              <h2>Activity</h2>
              <ol className="timeline">
                {events.map((ev, i) => (
                  <li key={i} className={`ev-${EVENT_CLASS[ev.type] || 'other'}`}>
                    <div>
                      <div>{EVENT_TEXT[ev.type] || ev.type}{ev.detail ? <span className="muted">: {ev.detail}</span> : null}</div>
                      <div className="tiny">{relativeTime(ev.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
