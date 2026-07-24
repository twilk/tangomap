import { auth } from '@/auth';
import { isTeacher } from '@/src/lib/teachers';
import { getSkillContent } from '@/src/lib/knowledge';

// Teacher-gated lesson video for a skill. The URL is deliberately NOT baked into
// the static skill page (that would leak it to everyone via view-source); it is
// returned here only to a signed-in member of the teacher allowlist. Everyone
// else gets { video: null } for every slug — no way to tell whether a video
// exists. Never cached, so one viewer's answer can't be served to another.
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get('slug') ?? '';
  const session = await auth();
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!isTeacher(session?.user?.email)) return Response.json({ video: null }, { headers });
  const video = getSkillContent(slug)?.video ?? null;
  return Response.json({ video }, { headers });
}
