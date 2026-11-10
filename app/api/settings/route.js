import { sql } from '@/lib/db';
import { getCurrentUser, newMcpKey } from '@/lib/auth';

export async function PATCH(req) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Log in again.' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (body.regenerate_key) {
    if (user.email === 'demo@paid.app') return Response.json({ error: 'The demo account keeps its shared connector link.' }, { status: 400 });
    const [u] = await sql`update users set mcp_key = ${newMcpKey()} where id = ${user.id} returning mcp_key`;
    return Response.json({ ok: true, mcp_key: u.mcp_key });
  }
  const name = String(body.business_name ?? user.business_name).trim();
  if (!name) return Response.json({ error: 'Business name cannot be empty.' }, { status: 400 });
  const upi = String(body.upi_id ?? '').trim();
  if (upi && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(upi)) return Response.json({ error: 'A UPI ID looks like name@bank.' }, { status: 400 });
  await sql`update users set business_name = ${name.slice(0, 120)}, upi_id = ${upi || null} where id = ${user.id}`;
  return Response.json({ ok: true });
}
