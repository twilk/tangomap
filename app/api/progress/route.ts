import { auth } from '@/auth';
import { db } from '@/db';
import { progress, progressHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sanitizeMastered } from '@/src/lib/progress';
import type { Progress, ProgressInput } from '@/src/lib/types';

const empty = (): Progress => ({ mastered: [], theme: null, sel: null, updatedAt: new Date(0).toISOString() });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const row = await db.query.progress.findFirst({ where: eq(progress.userId, session.user.id) });
  const body: Progress = row
    ? { mastered: row.mastered, theme: row.theme as Progress['theme'], sel: row.sel, updatedAt: row.updatedAt.toISOString() }
    : empty();
  return Response.json(body);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  let input: ProgressInput;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad body');
    input = parsed as ProgressInput;
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }
  const mastered = sanitizeMastered(input.mastered);
  const theme = input.theme === 'dark' || input.theme === 'light' ? input.theme : null;
  const sel = typeof input.sel === 'string' ? input.sel : null;
  const now = new Date();
  await db.insert(progress).values({ userId: session.user.id, mastered, theme, sel, updatedAt: now })
    .onConflictDoUpdate({ target: progress.userId, set: { mastered, theme, sel, updatedAt: now } });
  // Daily history snapshot (one row per UTC day) — powers growth views like the
  // card's ghost blob. Best-effort: a failed snapshot must not fail the save,
  // but it must leave a trace (silent loss here silently kills the ghost).
  try {
    const day = now.toISOString().slice(0, 10);
    await db.insert(progressHistory).values({ userId: session.user.id, day, mastered })
      .onConflictDoUpdate({ target: [progressHistory.userId, progressHistory.day], set: { mastered } });
  } catch (e) {
    console.error('progress_history snapshot failed', e);
  }
  return Response.json({ mastered, theme, sel, updatedAt: now.toISOString() } satisfies Progress);
}
