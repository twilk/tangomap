import { auth } from '@/auth';
import { db } from '@/db';
import { progress } from '@/db/schema';
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
  const input = (await req.json()) as ProgressInput;
  const mastered = sanitizeMastered(input.mastered);
  const theme = input.theme === 'dark' || input.theme === 'light' ? input.theme : null;
  const sel = typeof input.sel === 'string' ? input.sel : null;
  const now = new Date();
  await db.insert(progress).values({ userId: session.user.id, mastered, theme, sel, updatedAt: now })
    .onConflictDoUpdate({ target: progress.userId, set: { mastered, theme, sel, updatedAt: now } });
  return Response.json({ mastered, theme, sel, updatedAt: now.toISOString() } satisfies Progress);
}
