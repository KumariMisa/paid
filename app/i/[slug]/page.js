import QRCode from 'qrcode';
import { sql } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getInvoiceBySlug, recordView, totals, displayStatus } from '@/lib/invoices';
import { money, prettyDate } from '@/lib/format';
import PaidClaim from '@/components/PaidClaim';
import AutoRefresh from '@/components/AutoRefresh';
import Stamp from '@/components/Stamp';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const inv = await getInvoiceBySlug(params.slug);
  return { title: inv ? `Invoice ${inv.number}` : 'Invoice', robots: { index: false } };
}

function Shell({ children }) {
  return <main className="public">{children}<p className="tiny public-foot">Sent with Paid</p></main>;
}

export default async function PublicInvoice({ params }) {
  const inv = await getInvoiceBySlug(params.slug);
  const viewer = await getCurrentUser();
  const isOwner = viewer && inv && viewer.id === inv.user_id;

  if (!inv || (inv.status === 'draft' && !isOwner)) {
    return <Shell><div className="empty"><h1 style={{ fontSize: 26 }}>This invoice isn’t available</h1><p>The link may be wrong, or the invoice hasn’t been sent yet. Ask the sender for a fresh link.</p></div></Shell>;
  }

  const [biz] = await sql`select business_name, upi_id from users where id = ${inv.user_id}`;
  if (!isOwner) await recordView(inv);
  const t = totals(inv);

  let qr = null;
  let upiLink = null;
  if (biz.upi_id && inv.currency === 'INR' && inv.status !== 'paid') {
    const p = new URLSearchParams({ pa: biz.upi_id, pn: biz.business_name, am: t.total.toFixed(2), cu: 'INR', tn: `${inv.number} ${biz.business_name}`.slice(0, 50) });
    upiLink = `upi://pay?${p.toString().replace(/\+/g, '%20')}`;
    qr = await QRCode.toString(upiLink, { type: 'svg', margin: 0, color: { dark: '#1b2540', light: '#ffffff' } });
  }

  return (
    <Shell>
      {isOwner && <AutoRefresh every={5000} />}
      {isOwner && (
        <div className="notice notice--info owner-note">
          This is what your client sees.{inv.status === 'draft' ? ' It stays hidden from them until you mark it as sent.' : ' Your own visits aren’t counted as views.'}
        </div>
      )}
      <article className="sheet">
        <div className="sheet-head">
          <div>
            <div className="sheet-from">{biz.business_name}</div>
            <div className="tiny">Invoice</div>
          </div>
          <div className="sheet-title"><div className="num-big num">{inv.number}</div></div>
        </div>
        <div className="sheet-meta">
          <div><div className="meta-label">Billed to</div><div style={{ fontWeight: 600 }}>{inv.client_name}</div>{inv.client_email && <div className="small muted">{inv.client_email}</div>}</div>
          <div><div className="meta-label">Issued</div><div className="num">{prettyDate(inv.issue_date)}</div></div>
          <div><div className="meta-label">Due</div><div className="num">{prettyDate(inv.due_date)}</div></div>
        </div>
        <div className="table-wrap">
          <table className="items">
            <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: 'pre-wrap' }}>{it.description}</td>
                  <td className="right num">{it.quantity}</td>
                  <td className="right num">{money(it.rate, inv.currency)}</td>
                  <td className="right num">{money(it.quantity * it.rate, inv.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="totals-wrap">
        <Stamp paid={inv.status === 'paid'} date={inv.paid_at ? prettyDate(new Date(inv.paid_at).toISOString()) : ''} />
        <div className="totals">
          <div><span className="muted">Subtotal</span><span className="num">{money(t.subtotal, inv.currency)}</span></div>
          <div><span className="muted">Tax ({inv.tax_percent}%)</span><span className="num">{money(t.tax, inv.currency)}</span></div>
          <div className="grand"><span>Total</span><span className="num">{money(t.total, inv.currency)}</span></div>
        </div>
        </div>
        {inv.notes && <p className="sheet-notes muted" style={{ whiteSpace: 'pre-wrap' }}>{inv.notes}</p>}
      </article>

      {inv.status !== 'paid' && (
        <section className="paybox" aria-label="Pay this invoice">
          {qr && <div className="qr" dangerouslySetInnerHTML={{ __html: qr }} aria-label="UPI QR code" role="img" />}
          <div>
            {displayStatus(inv) === 'overdue'
              ? <div className="small overdue-note">Overdue since {prettyDate(inv.due_date)}</div>
              : <div className="muted small">Amount due by {prettyDate(inv.due_date)}</div>}
            <div className="due-figure num">{money(t.total, inv.currency)}</div>
            {qr ? (
              <p className="small muted" style={{ margin: '6px 0 0' }}>Scan with any UPI app, or pay to <strong>{biz.upi_id}</strong>.</p>
            ) : (
              <p className="small muted" style={{ margin: '6px 0 0' }}>Ask {biz.business_name} for payment details.</p>
            )}
            <div className="paybox-actions">
              {upiLink && <a className="btn touch-only" href={upiLink}>Pay with a UPI app</a>}
              {!isOwner && <PaidClaim slug={inv.slug} already={Boolean(inv.client_reported_paid_at)} />}
            </div>
          </div>
        </section>
      )}
    </Shell>
  );
}
