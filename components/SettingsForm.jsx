'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CopyButton from './CopyButton';

export default function SettingsForm({ user, mcpBase, isDemo }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [key, setKey] = useState(user.mcp_key);
  const url = `${mcpBase}/mcp/${key}`;

  async function patch(body) {
    setMsg(''); setErr('');
    const r = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || 'Could not save.'); return null; }
    router.refresh();
    return d;
  }

  return (
    <div className="settings">
      <section>
        <h2>Business details</h2>
        <form style={{ display: 'grid', gap: 14 }} onSubmit={async (e) => {
          e.preventDefault();
          const d = await patch(Object.fromEntries(new FormData(e.currentTarget)));
          if (d) setMsg('Details saved');
        }}>
          <div className="field"><label htmlFor="bn">Business name</label><input id="bn" name="business_name" className="input" defaultValue={user.business_name} required /></div>
          <div className="field">
            <label htmlFor="upi">UPI ID</label>
            <input id="upi" name="upi_id" className="input" defaultValue={user.upi_id || ''} placeholder="yourname@okaxis" />
            <span className="tiny">Clients see a QR code for this on unpaid invoices.</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn">Save details</button>
            {msg && <span className="small" style={{ color: 'var(--paid)' }}>{msg}</span>}
          </div>
        </form>
      </section>
      <section>
        <h2>Claude connector</h2>
        <p className="small muted" style={{ margin: 0 }}>Anyone with this link can create and read invoices in your account, so keep it private. Make a new link if it leaks; the old one stops working.</p>
        <div className="linkline"><input className="input" readOnly value={url} aria-label="Connector link" onFocus={(e) => e.target.select()} /><CopyButton value={url} /></div>
        {!isDemo && (
          <button className="btn btn--quiet" style={{ justifySelf: 'start' }} onClick={async () => {
            if (!confirm('Make a new link? You’ll need to update the connector in Claude.')) return;
            const d = await patch({ regenerate_key: true });
            if (d) { setKey(d.mcp_key); setMsg('New link made'); }
          }}>Make a new link</button>
        )}
      </section>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
