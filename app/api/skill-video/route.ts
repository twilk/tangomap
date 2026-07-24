import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { canSeeLessonVideos } from '@/src/lib/teachers';
import { getSkillContent } from '@/src/lib/knowledge';

// Gated lesson video for a skill. The URL is deliberately NOT baked into the
// static skill page (that would leak it to everyone via view-source); it is
// returned here only to a viewer allowed to see it — a teacher, or one of the
// first 50 accounts. Everyone else gets { video: null } for every slug, so there
// is no way to tell whether a video exists. Never cached, so one viewer's answer
// can't be served to another.
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') ?? '';
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return Response.json({ video: null }, { headers: HEADERS });

  const prof = await db.query.profile.findFirst({ where: eq(profile.userId, uid) });
  if (!canSeeLessonVideos({ email: session?.user?.email, cardSerial: prof?.cardSerial })) {
    return Response.json({ video: null }, { headers: HEADERS });
  }

  return Response.json({ video: getSkillContent(slug)?.video ?? null }, { headers: HEADERS });
}
