'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stamp from './Stamp';

const fmt = (n, c) => {
  const v = Number(n || 0);
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: c || 'INR', minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 }).format(v); }
  catch { return `${c} ${Number(n || 0).toFixed(2)}`; }
};
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

function pick(inv) {
  return {
    client_name: inv.client_name || '',
    client_email: inv.client_email || '',
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    currency: inv.currency || 'INR',
    tax_percent: inv.tax_percent ?? 0,
    notes: inv.notes || '',
    items: (inv.items?.length ? inv.items : [{ description: '', quantity: 1, rate: 0 }]).map((i) => ({ ...i })),
  };
}

export default function InvoiceEditor({ invoice, businessName, isNew = false, paidDate }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => pick(invoice));
  const [form, setForm] = useState(() => pick(invoice));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // If the invoice changes on the server (say, Claude edited it) and you have no unsaved edits, show the new version.
  const lastServer = useRef(invoice.updated_at);
  useEffect(() => {
    if (isNew || String(invoice.updated_at) === String(lastServer.current)) return;
    lastServer.current = invoice.updated_at;
    if (JSON.stringify(form) === JSON.stringify(saved)) { const next = pick(invoice); setSaved(next); setForm(next); }
  }, [invoice, isNew, form, saved]);

  const dirty = isNew || JSON.stringify(form) !== JSON.stringify(saved);
  const t = useMemo(() => {
    const subtotal = r2(form.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.rate) || 0), 0));
    const tax = r2((subtotal * (Number(form.tax_percent) || 0)) / 100);
    return { subtotal, tax, total: r2(subtotal + tax) };
  }, [form]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setJustSaved(false); };
  const setItem = (idx, k, v) => set('items', form.items.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  async function save() {
    setBusy(true); setError('');
    const body = {
      ...form,
      tax_percent: Number(form.tax_percent) || 0,
      items: form.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), rate: Number(i.rate) })),
    };
    const res = await fetch(isNew ? '/api/invoices' : `/api/invoices/${invoice.id}`, {
      method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error || 'Could not save. Try again.'); return; }
    if (isNew) { router.push(`/invoices/${data.id}`); return; }
    const next = pick(data.invoice);
    setSaved(next); setForm(next); setJustSaved(true);
    router.refresh();
  }

  return (
    <div>
      <article className="sheet">
        <div className="sheet-head">
          <div>
            <div className="sheet-from">{businessName}</div>
            <div className="tiny">Invoice</div>
          </div>
          <div className="sheet-title">
            <div className="num-big num">{isNew ? 'New invoice' : invoice.number}</div>
          </div>
        </div>

        <div className="sheet-meta">
          <div>
            <div className="meta-label"><label htmlFor="cn">Billed to</label></div>
            <input id="cn" className="flat flat--strong" value={form.client_name} onChange={(e) => set('client_name', e.target.value)} placeholder="Client name" />
            <input aria-label="Client email" className="flat small" value={form.client_email} onChange={(e) => set('client_email', e.target.value)} placeholder="client@email.com" />
          </div>
          <div>
            <div className="meta-label"><label htmlFor="id">Issued</label></div>
            <input id="id" type="date" className="flat num" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} />
          </div>
          <div>
            <div className="meta-label"><label htmlFor="dd">Due</label></div>
            <input id="dd" type="date" className="flat num" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="items">
            <thead>
              <tr><th>Description</th><th className="qty right">Qty</th><th className="rate right">Rate</th><th className="amt right">Amount</th><th className="x" aria-label="Remove" /></tr>
            </thead>
            <tbody>
              {form.items.map((it, idx) => (
                <tr key={idx}>
                  <td><textarea rows={1} aria-label={`Line ${idx + 1} description`} className="flat" style={{ resize: 'vertical' }} value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} placeholder="What you delivered" /></td>
                  <td className="qty"><input aria-label={`Line ${idx + 1} quantity`} inputMode="decimal" className="flat right num" value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></td>
                  <td className="rate"><input aria-label={`Line ${idx + 1} rate`} inputMode="decimal" className="flat right num" value={it.rate} onChange={(e) => setItem(idx, 'rate', e.target.value)} /></td>
                  <td className="amt right num">{fmt((Number(it.quantity) || 0) * (Number(it.rate) || 0), form.currency)}</td>
                  <td className="x">
                    {form.items.length > 1 && (
                      <button type="button" className="remove" aria-label={`Remove line ${idx + 1}`} onClick={() => set('items', form.items.filter((_, i) => i !== idx))}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="linkish small" style={{ marginTop: 10 }} onClick={() => set('items', [...form.items, { description: '', quantity: 1, rate: 0 }])}>Add a line</button>

        <div className="totals-wrap">
        <Stamp paid={invoice.status === 'paid'} date={paidDate} />
        <div className="totals">
          <div><span className="muted">Subtotal</span><span className="num">{fmt(t.subtotal, form.currency)}</span></div>
          <div>
            <span className="muted">Tax <input aria-label="Tax percent" inputMode="decimal" className="flat tax-input num" value={form.tax_percent} onChange={(e) => set('tax_percent', e.target.value)} />%</span>
            <span className="num">{fmt(t.tax, form.currency)}</span>
          </div>
          <div className="grand"><span>Total</span><span className="num">{fmt(t.total, form.currency)}</span></div>
        </div>
        </div>

        <div className="sheet-notes">
          <div className="meta-label"><label htmlFor="nt">Note to client</label></div>
          <textarea id="nt" rows={2} className="flat" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional, e.g. thanks for the project" />
        </div>
      </article>

      <div className="savebar">
        <button className="btn" onClick={save} disabled={!dirty || busy}>{busy ? 'Saving…' : isNew ? 'Create invoice' : 'Save changes'}</button>
        {!isNew && dirty && <button className="btn btn--quiet" onClick={() => { setForm(saved); setError(''); }}>Discard</button>}
        {justSaved && !dirty && <span className="small" style={{ color: 'var(--paid)' }}>Changes saved</span>}
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    </div>
  );
}
