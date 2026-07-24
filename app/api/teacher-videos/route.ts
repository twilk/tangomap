import { auth } from '@/auth';
import { isTeacher } from '@/src/lib/teachers';
import { slugsWithVideo } from '@/src/lib/knowledge';

// Which skills have a lesson video — for teacher-only badges on the /skills
// index. Returns the slug list ONLY to a signed-in teacher; { slugs: [] } for
// everyone else, so which skills have videos never leaks. Never cached.
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const headers = { 'Cache-Control': 'private, no-store' };
  const slugs = isTeacher(session?.user?.email) ? slugsWithVideo() : [];
  return Response.json({ slugs }, { headers });
}
