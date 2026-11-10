import { sql } from '@/lib/db';
import { hashPassword, newMcpKey, setSession } from '@/lib/auth';

export async function POST(req) {
  const { email, password, business_name } = await req.json().catch(() => ({}));
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return Response.json({ error: 'Enter a valid email.' }, { status: 400 });
  if (String(password || '').length < 8) return Response.json({ error: 'Use a password of at least 8 characters.' }, { status: 400 });
  const name = String(business_name || '').trim() || e.split('@')[0];
  const [exists] = await sql`select 1 from users where email = ${e}`;
  if (exists) return Response.json({ error: 'That email already has an account. Log in instead.' }, { status: 409 });
  const [u] = await sql`
    insert into users (email, password_hash, business_name, mcp_key)
    values (${e}, ${hashPassword(password)}, ${name.slice(0, 120)}, ${newMcpKey()}) returning id`;
  setSession(u.id);
  return Response.json({ ok: true });
}
