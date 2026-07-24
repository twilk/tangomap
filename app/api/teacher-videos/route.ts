import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { canSeeLessonVideos } from '@/src/lib/teachers';
import { slugsWithVideo } from '@/src/lib/knowledge';

// Which skills have a lesson video — for the "video" badges on the /skills index.
// Returns the slug list ONLY to a viewer allowed to see the videos (a teacher, or
// one of the first 50 accounts), so which skills have videos never leaks. Never
// cached, so one viewer's answer can't be served to another.
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return Response.json({ slugs: [] }, { headers: HEADERS });

  const prof = await db.query.profile.findFirst({ where: eq(profile.userId, uid) });
  const allowed = canSeeLessonVideos({ email: session?.user?.email, cardSerial: prof?.cardSerial });

  return Response.json({ slugs: allowed ? slugsWithVideo() : [] }, { headers: HEADERS });
}
