import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { todayIST, addDays } from '@/lib/format';
import TopBar from '@/components/TopBar';
import InvoiceEditor from '@/components/InvoiceEditor';

export const dynamic = 'force-dynamic';

export default async function NewInvoice() {
  const user = await requireUser();
  const today = todayIST();
  const blank = { id: 'new', status: 'draft', issue_date: today, due_date: addDays(today, 15), currency: 'INR', tax_percent: 18, items: [] };
  return (
    <>
      <TopBar user={user} current="invoices" />
      <main className="page" style={{ maxWidth: 860 }}>
        <div className="page-head">
          <div>
            <Link href="/dashboard" className="small muted">Back to invoices</Link>
            <h1 style={{ marginTop: 6 }}>New invoice</h1>
          </div>
        </div>
        <InvoiceEditor invoice={blank} businessName={user.business_name} isNew />
      </main>
    </>
  );
}
