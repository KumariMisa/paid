import { getCurrentUser } from '@/lib/auth';
import { updateInvoice, setStatus, deleteInvoice, InvoiceError } from '@/lib/invoices';

async function run(req, fn) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Log in again.' }, { status: 401 });
  try {
    return await fn(user);
  } catch (e) {
    if (e instanceof InvoiceError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export function PATCH(req, { params }) {
  return run(req, async (user) => {
    const body = await req.json();
    let inv;
    if (body.status) inv = await setStatus(user.id, params.id, body.status, 'web');
    else inv = await updateInvoice(user.id, params.id, body, 'web');
    return Response.json({ ok: true, invoice: inv });
  });
}

export function DELETE(req, { params }) {
  return run(req, async (user) => {
    await deleteInvoice(user.id, params.id);
    return Response.json({ ok: true });
  });
}
