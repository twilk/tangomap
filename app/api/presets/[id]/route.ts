import { auth } from '@/auth';
import { db } from '@/db';
import { themePreset, profile } from '@/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { parseTheme } from '@/src/lib/theme';
import { isValidPresetName, sanitizePresetName } from '@/src/lib/presets';
import { isMissingTable } from '@/src/lib/dbSafe';

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

  // Deploy-safe: every theme_preset touch below (owned() lookup, sibling read,
  // sibling-clear + main update) raises 42P01 until migration 0004 creates the table.
  // The owned() lookup is the first touch, so a missing table short-circuits to 503
  // not_ready before the profile upsert ever runs. Any other error re-throws so real
  // bugs are never swallowed.
  try {
    const row = await owned(userId, id);
    if (!row) return Response.json({ error: 'not_found' }, { status: 404 });

    let body: { name?: unknown; isShared?: unknown; setActive?: unknown };
    try { const p = await req.json(); if (!p || typeof p !== 'object' || Array.isArray(p)) throw 0; body = p; }
    catch { return Response.json({ error: 'invalid_body' }, { status: 400 }); }

    const set: Record<string, unknown> = {};

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
      // TODO: wrap in db.transaction — the 0-or-1 clear-then-set spans two statements
      // (sibling-clear here + the main update below). Accepted for a single-user app.
      // 0-or-1 shared per user: clear the others first.
      await db.update(themePreset).set({ isShared: false }).where(and(eq(themePreset.userId, userId), ne(themePreset.id, id)));
      set.isShared = true;
    } else if (body.isShared === false) {
      set.isShared = false;
    }

    // Only bump the preset row when its DEFINITION actually changed (name/isShared).
    // A pure {setActive:true} PATCH must NOT touch updatedAt — the Phase 4 gallery sorts
    // desc(updatedAt), so re-applying your own shared preset must not re-float it.
    if (Object.keys(set).length > 0) {
      set.updatedAt = new Date();
      await db.update(themePreset).set(set).where(and(eq(themePreset.id, id), eq(themePreset.userId, userId)));
    }

    if (body.setActive === true) {
      const seeds = parseTheme(row.seeds);
      if (seeds) {
        await db.insert(profile).values({ userId, customTheme: seeds, customThemeUpdatedAt: new Date() })
          .onConflictDoUpdate({ target: profile.userId, set: { customTheme: seeds, customThemeUpdatedAt: new Date() } });
      } else {
        // Stored seeds no longer parse — don't report success while doing nothing.
        return Response.json({ error: 'corrupt_preset' }, { status: 422 });
      }
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) return Response.json({ error: 'not_ready' }, { status: 503 });
    throw err;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  // Deploy-safe: the owned() lookup + delete raise 42P01 until migration 0004 creates
  // theme_preset — return a clean 503 not_ready rather than 500. Other errors re-throw.
  try {
    const row = await owned(session.user.id, id);
    if (!row) return Response.json({ error: 'not_found' }, { status: 404 });
    await db.delete(themePreset).where(and(eq(themePreset.id, id), eq(themePreset.userId, session.user.id)));
    return Response.json({ ok: true });
  } catch (err) {
    if (isMissingTable(err)) return Response.json({ error: 'not_ready' }, { status: 503 });
    throw err;
  }
}
