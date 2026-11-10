import { getInvoiceBySlug, clientReportsPaid } from '@/lib/invoices';

export async function POST(req, { params }) {
  const inv = await getInvoiceBySlug(params.slug);
  if (!inv || inv.status === 'draft') return Response.json({ error: 'Invoice not found.' }, { status: 404 });
  await clientReportsPaid(inv);
  return Response.json({ ok: true });
}
