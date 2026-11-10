import { sql } from '@/lib/db';
import { checkPassword, setSession } from '@/lib/auth';

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  const [u] = await sql`select id, password_hash from users where email = ${String(email || '').trim().toLowerCase()}`;
  if (!u || !checkPassword(String(password || ''), u.password_hash)) {
    return Response.json({ error: 'Email or password is wrong.' }, { status: 401 });
  }
  setSession(u.id);
  return Response.json({ ok: true });
}
