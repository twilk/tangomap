import { auth } from '@/auth';
import { db } from '@/db';
import { themePreset } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseTheme } from '@/src/lib/theme';
import { isValidPresetName, sanitizePresetName, canSavePreset } from '@/src/lib/presets';
import type { ThemePreset } from '@/src/lib/types';

const toDTO = (r: { id: string; name: string; seeds: unknown; isShared: boolean; updatedAt: Date }): ThemePreset => ({
  id: r.id, name: r.name, seeds: parseTheme(r.seeds)!, isShared: r.isShared, updatedAt: r.updatedAt.toISOString(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rows = await db.query.themePreset.findMany({ where: eq(themePreset.userId, session.user.id) });
  // Defensive: drop any row whose stored seeds no longer validate.
  return Response.json(rows.filter((r) => parseTheme(r.seeds)).map(toDTO));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const userId = session.user.id;
  let body: { name?: unknown; seeds?: unknown };
  try {
    const p = await req.json();
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw 0;
    body = p;
  } catch { return Response.json({ error: 'invalid_body' }, { status: 400 }); }

  const seeds = parseTheme(body.seeds);
  if (!seeds) return Response.json({ error: 'invalid_theme' }, { status: 400 });
  if (!isValidPresetName(body.name)) return Response.json({ error: 'invalid_name' }, { status: 400 });
  const name = sanitizePresetName(body.name as string);

  // TODO: wrap the cap/duplicate check + insert in db.transaction — the read-then-insert
  // is TOCTOU (a concurrent POST could exceed the cap). Accepted for a single-user app.
  const existing = await db.query.themePreset.findMany({ where: eq(themePreset.userId, userId) });
  const check = canSavePreset(existing.map((e) => e.name), name);
  if (!check.ok) return Response.json({ error: check.reason }, { status: 409 });

  const [row] = await db.insert(themePreset)
    .values({ userId, name, seeds, isShared: false })
    .returning();
  return Response.json(toDTO(row));
}
