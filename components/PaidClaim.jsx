'use client';
import { useState } from 'react';

export default function PaidClaim({ slug, already }) {
  const [done, setDone] = useState(already);
  const [busy, setBusy] = useState(false);
  if (done) return <p className="small" style={{ color: 'var(--paid)', margin: 0 }}>Thanks. We’ve let them know you’ve paid.</p>;
  return (
    <button className="btn btn--quiet" disabled={busy} onClick={async () => {
      setBusy(true);
      const r = await fetch(`/api/public/${slug}/paid`, { method: 'POST' });
      setBusy(false);
      if (r.ok) setDone(true);
    }}>I’ve paid this</button>
  );
}
