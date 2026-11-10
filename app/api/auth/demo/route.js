import { sql } from '@/lib/db';
import { setSession } from '@/lib/auth';

export async function POST() {
  const [u] = await sql`select id from users where email = 'demo@paid.app'`;
  if (!u) return Response.json({ error: 'The demo account is not set up. Run npm run db:setup.' }, { status: 404 });
  setSession(u.id);
  return Response.json({ ok: true });
}
