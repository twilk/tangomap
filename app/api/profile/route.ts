import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { isValidHandle, normalizeHandle } from '@/src/lib/handle';
import { parseTheme } from '@/src/lib/theme';
import type { ProfileDTO, ProfileInput, Style } from '@/src/lib/types';

const empty = (): ProfileDTO => ({
  handle: null,
  isPublic: false,
  displayName: null,
  style: null,
  customTheme: null,
  cardUsesCustomTheme: false,
  themeShared: false,
  customThemeUpdatedAt: null,
});

const asStyle = (v: unknown): Style | null =>
  v === 'salon' || v === 'milonguero' || v === 'nuevo' ? v : null;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const row = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
  const body: ProfileDTO = row
    ? {
        handle: row.handle,
        isPublic: row.isPublic,
        displayName: row.displayName,
        style: asStyle(row.style),
        customTheme: parseTheme(row.customTheme),
        cardUsesCustomTheme: row.cardUsesCustomTheme,
        themeShared: row.themeShared,
        customThemeUpdatedAt: row.customThemeUpdatedAt ? row.customThemeUpdatedAt.toISOString() : null,
      }
    : empty();
  return Response.json(body);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  let body: ProfileInput;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('bad body');
    body = parsed as ProfileInput;
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

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
      ? typeof body.displayName === 'string' && body.displayName.trim() !== ''
        ? body.displayName
        : null
      : (existing?.displayName ?? null);
  const style = body.style !== undefined ? asStyle(body.style) : asStyle(existing?.style);

  // Custom theme (last-write-wins across devices). A present key writes; an absent
  // key keeps the stored value. The theme itself is re-validated through parseTheme,
  // and its clock (customThemeUpdatedAt) is set whenever the theme is written —
  // preferring a client-supplied ISO timestamp, else server-now.
  let customTheme = existing?.customTheme ?? null;
  let customThemeUpdatedAt: Date | null = existing?.customThemeUpdatedAt ?? null;
  if (body.customTheme !== undefined) {
    if (body.customTheme === null) {
      customTheme = null;
    } else {
      const t = parseTheme(body.customTheme);
      if (!t) return Response.json({ error: 'invalid_body' }, { status: 400 });
      customTheme = t;
    }
    // Loose `!= null` catches both null and undefined, so an explicit
    // customThemeUpdatedAt:null never becomes `new Date(null)` (epoch 1970).
    if (body.customThemeUpdatedAt != null) {
      const d = new Date(body.customThemeUpdatedAt as string | number);
      customThemeUpdatedAt = Number.isNaN(d.getTime()) ? new Date() : d;
    } else {
      customThemeUpdatedAt = new Date();
    }
  }
  const cardUsesCustomTheme =
    body.cardUsesCustomTheme !== undefined
      ? body.cardUsesCustomTheme === true
      : (existing?.cardUsesCustomTheme ?? false);
  const themeShared =
    body.themeShared !== undefined ? body.themeShared === true : (existing?.themeShared ?? false);

  // A public profile needs a handle to be reachable at /u/[handle].
  if (isPublic && !handle) return Response.json({ error: 'handle_required' }, { status: 400 });

  try {
    await db.insert(profile)
      .values({ userId, handle, isPublic, displayName, style, customTheme, cardUsesCustomTheme, themeShared, customThemeUpdatedAt })
      .onConflictDoUpdate({
        target: profile.userId,
        set: { handle, isPublic, displayName, style, customTheme, cardUsesCustomTheme, themeShared, customThemeUpdatedAt },
      });
  } catch (e) {
    // unique(handle) violation from a concurrent claim — surface as a clean 409.
    if (String((e as { code?: string }).code) === '23505') {
      return Response.json({ error: 'handle_taken' }, { status: 409 });
    }
    throw e;
  }

  return Response.json({
    handle,
    isPublic,
    displayName,
    style,
    customTheme,
    cardUsesCustomTheme,
    themeShared,
    customThemeUpdatedAt: customThemeUpdatedAt ? customThemeUpdatedAt.toISOString() : null,
  } satisfies ProfileDTO);
}
