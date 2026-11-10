import { getCurrentUser } from '@/lib/auth';
import { createInvoice, InvoiceError } from '@/lib/invoices';

export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Log in again.' }, { status: 401 });
  try {
    const body = await req.json();
    const inv = await createInvoice(user.id, body, 'web');
    return Response.json({ id: inv.id });
  } catch (e) {
    if (e instanceof InvoiceError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
