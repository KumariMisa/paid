import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AuthForm from '@/components/AuthForm';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <>
      <header className="topbar"><span className="brand"><span className="brand-mark" aria-hidden="true" />Paid</span></header>
      <main className="landing">
        <section>
          <h1>Ask Claude for the invoice. Paid gets you the money.</h1>
          <p className="lede">
            Paste a WhatsApp thread or timesheet into Claude and say who to bill. Paid turns it into a live invoice your client can open and pay by UPI, and tells you when they’ve seen it.
          </p>
          <div className="flow" aria-hidden="true">
            <div className="bubble">
              <div className="bubble-who">You, in Claude</div>
              Bill Northwind for the 18 hours from this thread at ₹2,000, plus the handoff. Add GST.
            </div>
            <div className="mini">
              <div className="stamp"><span className="stamp-word">PAID</span></div>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>INV-0007, Northwind Logistics</div>
              <div className="mini-row"><span>Dashboard UI design × 18 h</span><span className="num">₹36,000</span></div>
              <div className="mini-row"><span>Design system handoff</span><span className="num">₹8,000</span></div>
              <div className="mini-row"><span>GST 18%</span><span className="num">₹7,920</span></div>
              <div className="mini-total"><span>Total</span><span className="num">₹51,920</span></div>
            </div>
          </div>
          <ol className="flow-steps">
            <li>Claude reads the mess and writes the line items.</li>
            <li>Paid saves the invoice, and you fix anything in a click.</li>
            <li>Your client opens the link and pays. You see every step.</li>
          </ol>
        </section>
        <AuthForm />
      </main>
    </>
  );
}
