'use client';
import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn--quiet"
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1600); } catch {}
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}
