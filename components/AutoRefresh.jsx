'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Re-fetches server data every few seconds so invoices Claude creates, and client views, appear without a reload.
export default function AutoRefresh({ every = 4000 }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') router.refresh(); }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}
