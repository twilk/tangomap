import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile, progress } from '@/db/schema';
import { SKILLS } from '@/src/data/skills';
import { sanitizeMastered } from '@/src/lib/progress';
import { recommend } from '@/src/lib/recommend';

// "What's next" for the map's idle Skill Details panel (the MapHomeCard).
// Deliberately never 401s: a signed-out visitor gets { signedIn: false } so the
// panel can render its sign-in invitation instead of swallowing an error.
// `handle` is included ONLY for a public profile — same rule as app/me/page.tsx,
// so a private handle never leaks into a client-side fetch. Never cached.
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ signedIn: false }, { headers: HEADERS });
  const uid = session.user.id;

  const [prof, prog] = await Promise.all([
    db.query.profile.findFirst({ where: eq(profile.userId, uid) }),
    db.query.progress.findFirst({ where: eq(progress.userId, uid) }),
  ]);

  const mastered = sanitizeMastered(prog?.mastered ?? []);
  const handle = prof?.isPublic && prof.handle ? prof.handle : null;
  const next = recommend(mastered, 3).map((r) => ({ name: r.name, slug: r.slug, level: r.level, reason: r.reason }));

  return Response.json(
    { signedIn: true, handle, mastered: mastered.length, total: SKILLS.length, next },
    { headers: HEADERS },
  );
}
