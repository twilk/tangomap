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

  const existing = await db.query.profile.findFirst({ where: eq(profile.userId, userId) });

  // Partial update: only fields present in the body change; the rest keep their
  // current value (a bare {isPublic:true} must not wipe an existing handle/name).
  let handle = existing?.handle ?? null;
  if (body.handle !== undefined) {
    if (body.handle === null) {
      handle = null;
    } else {
      const h = normalizeHandle(String(body.handle));
      if (!isValidHandle(h)) return Response.json({ error: 'invalid_handle' }, { status: 400 });
      const clash = await db.query.profile.findFirst({ where: eq(profile.handle, h) });
      if (clash && clash.userId !== userId) return Response.json({ error: 'handle_taken' }, { status: 409 });
      handle = h;
    }
  }

  const isPublic = body.isPublic !== undefined ? body.isPublic === true : (existing?.isPublic ?? false);
  const displayName =
    body.displayName !== undefined
      ? typeof body.displayName === 'string'
        ? body.displayName
        : null
      : (existing?.displayName ?? null);
  const style = body.style !== undefined ? asStyle(body.style) : asStyle(existing?.style);

  // A public profile needs a handle to be reachable at /u/[handle].
  if (isPublic && !handle) return Response.json({ error: 'handle_required' }, { status: 400 });

  try {
    await db.insert(profile).values({ userId, handle, isPublic, displayName, style })
      .onConflictDoUpdate({ target: profile.userId, set: { handle, isPublic, displayName, style } });
  } catch (e) {
    // unique(handle) violation from a concurrent claim — surface as a clean 409.
    if (String((e as { code?: string }).code) === '23505') {
      return Response.json({ error: 'handle_taken' }, { status: 409 });
    }
    throw e;
  }

  return Response.json({ handle, isPublic, displayName, style } satisfies ProfileDTO);
}
