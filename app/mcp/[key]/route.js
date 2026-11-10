import { handleMcp } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const handler = (req, { params }) => handleMcp(req, params.key);
export { handler as GET, handler as POST, handler as OPTIONS, handler as DELETE };
