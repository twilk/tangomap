import { auth } from '@/auth';
import { db } from '@/db';
import { themePreset, profile } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { parseTheme } from '@/src/lib/theme';
import { isValidPresetName, sanitizePresetName } from '@/src/lib/presets';

type Ctx = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  const row = await db.query.themePreset.findFirst({ where: and(eq(themePreset.id, id), eq(themePreset.userId, userId)) });
  return row ?? null;
}

export async function PATCH(req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;
  const row = await owned(userId, id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });

  let body: { name?: unknown; isShared?: unknown; setActive?: unknown };
  try { const p = await req.json(); if (!p || typeof p !== 'object' || Array.isArray(p)) throw 0; body = p; }
  catch { return Response.json({ error: 'invalid_body' }, { status: 400 }); }

  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    if (!isValidPresetName(body.name)) return Response.json({ error: 'invalid_name' }, { status: 400 });
    const name = sanitizePresetName(body.name as string);
    const siblings = await db.query.themePreset.findMany({ where: and(eq(themePreset.userId, userId), ne(themePreset.id, id)) });
    if (siblings.some((s) => s.name.toLowerCase() === name.toLowerCase())) return Response.json({ error: 'duplicate' }, { status: 409 });
    set.name = name;
  }

  if (body.isShared === true) {
    const prof = await db.query.profile.findFirst({ where: eq(profile.userId, userId) });
    if (!prof?.isPublic || !prof.handle) return Response.json({ error: 'needs_public' }, { status: 409 });
    // 0-or-1 shared per user: clear the others first.
    await db.update(themePreset).set({ isShared: false }).where(and(eq(themePreset.userId, userId), ne(themePreset.id, id)));
    set.isShared = true;
  } else if (body.isShared === false) {
    set.isShared = false;
  }

  await db.update(themePreset).set(set).where(and(eq(themePreset.id, id), eq(themePreset.userId, userId)));

  if (body.setActive === true) {
    const seeds = parseTheme(row.seeds);
    if (seeds) {
      await db.insert(profile).values({ userId, customTheme: seeds, customThemeUpdatedAt: new Date() })
        .onConflictDoUpdate({ target: profile.userId, set: { customTheme: seeds, customThemeUpdatedAt: new Date() } });
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const row = await owned(session.user.id, id);
  if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
  await db.delete(themePreset).where(and(eq(themePreset.id, id), eq(themePreset.userId, session.user.id)));
  return Response.json({ ok: true });
}
