'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CopyButton from './CopyButton';

export default function InvoiceActions({ invoice, clientLink, displayStatus, totalText, businessName }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function status(s) {
    setBusy(true); setError('');
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: s }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not update.'); return; }
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete ${invoice.number}? Its client link will stop working.`)) return;
    const res = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/dashboard');
  }

  const waText = encodeURIComponent(`Hi ${invoice.client_name}, here is invoice ${invoice.number} from ${businessName} for ${totalText}. You can view and pay it here: ${clientLink}`);

  return (
    <div className="side-block">
      {invoice.status === 'draft' && (
        <>
          <p className="small muted" style={{ margin: 0 }}>Draft. Your client can’t open the link until you mark it as sent.</p>
          <button className="btn btn--block" disabled={busy} onClick={() => status('sent')}>Mark as sent</button>
        </>
      )}
      {invoice.status === 'sent' && (
        <>
          {invoice.client_reported_paid_at && <div className="notice notice--late">Your client says they’ve paid. Check your account, then confirm.</div>}
          {displayStatus === 'overdue' && !invoice.client_reported_paid_at && <div className="notice notice--late">Past due. Ask Claude to draft a reminder for {invoice.number}.</div>}
          <button className="btn btn--paid btn--block" disabled={busy} onClick={() => status('paid')}>Mark as paid</button>
          <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => status('draft')}>Move back to draft</button>
        </>
      )}
      {invoice.status === 'paid' && (
        <>
          <div className="notice notice--paid">Paid in full.</div>
          <button className="btn btn--quiet btn--block" disabled={busy} onClick={() => status('sent')}>Mark as unpaid</button>
        </>
      )}
      {error && <p className="error">{error}</p>}

      <h2 style={{ marginTop: 12 }}>Client link</h2>
      <div className="linkline">
        <input className="input" readOnly value={clientLink} aria-label="Client link" onFocus={(e) => e.target.select()} />
        <CopyButton value={clientLink} />
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <a className="btn btn--quiet" href={clientLink} target="_blank" rel="noreferrer">Preview</a>
        <a className="btn btn--quiet" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer">Share on WhatsApp</a>
      </div>
      <button className="btn btn--danger" style={{ justifySelf: 'start', marginTop: 8 }} onClick={remove}>Delete invoice</button>
    </div>
  );
}
