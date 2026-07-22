import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidHandle, normalizeHandle } from '@/src/lib/handle';
import type { ProfileDTO, ProfileInput, Style } from '@/src/lib/types';

const empty = (): ProfileDTO => ({ handle: null, isPublic: false, displayName: null, style: null });

const asStyle = (v: unknown): Style | null =>
  v === 'salon' || v === 'milonguero' || v === 'nuevo' ? v : null;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const row = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
  const body: ProfileDTO = row
    ? { handle: row.handle, isPublic: row.isPublic, displayName: row.displayName, style: asStyle(row.style) }
    : empty();
  return Response.json(body);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const body = (await req.json()) as ProfileInput;

  let handle: string | null = null;
  if (body.handle !== null && body.handle !== undefined) {
    const h = normalizeHandle(String(body.handle));
    if (!isValidHandle(h)) return Response.json({ error: 'invalid_handle' }, { status: 400 });
    const clash = await db.query.profile.findFirst({ where: eq(profile.handle, h) });
    if (clash && clash.userId !== userId) return Response.json({ error: 'handle_taken' }, { status: 409 });
    handle = h;
  }

  const isPublic = body.isPublic === true;
  const style = asStyle(body.style);
  const displayName = typeof body.displayName === 'string' ? body.displayName : null;

  await db.insert(profile).values({ userId, handle, isPublic, displayName, style })
    .onConflictDoUpdate({ target: profile.userId, set: { handle, isPublic, displayName, style } });

  return Response.json({ handle, isPublic, displayName, style } satisfies ProfileDTO);
}
