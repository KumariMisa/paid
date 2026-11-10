import { clearSession } from '@/lib/auth';

export async function POST(req) {
  clearSession();
  return Response.redirect(new URL('/', req.url), 303);
}
