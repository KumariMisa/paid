'use client';
import { useEffect, useRef, useState } from 'react';

// Shows the PAID stamp. It only animates when the invoice becomes paid while you watch.
export default function Stamp({ paid, date }) {
  const prev = useRef(paid);
  const [fresh, setFresh] = useState(false);
  useEffect(() => {
    if (paid && !prev.current) setFresh(true);
    prev.current = paid;
  }, [paid]);
  if (!paid) return null;
  return (
    <div className={`stamp${fresh ? ' stamp--fresh' : ''}`} aria-label="Paid">
      <span className="stamp-word">PAID</span>
      {date && <span className="stamp-date">{date}</span>}
    </div>
  );
}
