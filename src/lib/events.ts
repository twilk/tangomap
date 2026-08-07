import { db } from '@/db';
import { events } from '@/db/schema';
import { isMissingTable } from '@/src/lib/dbSafe';

/**
 * First-party telemetry. The closed allowlist below is the whole API surface —
 * `POST /api/events` rejects anything not in it, so a compromised or careless client
 * cannot invent event names and turn this table into a landfill.
 *
 * Recording is ALWAYS best-effort: telemetry must never fail a user's save. It follows
 * the same shape as the progress_history snapshot in app/api/progress/route.ts — swallow,
 * but leave a console trace, so a silent stop is still diagnosable.
 */
export const EVENT_NAMES = [
  // Product: the input metric that defines "complete", plus per-skill stall timing.
  'skill_mastered',
  'skill_unmastered',
  'skill_page_view',
  // Invite funnel (Gate 3's entry condition is a query over these).
  'link_open',
  'signin',
  'handle_claimed',
  'compare_filled',
  'invite_copied',
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

const ALLOWED = new Set<string>(EVENT_NAMES);

export function isEventName(v: unknown): v is EventName {
  return typeof v === 'string' && ALLOWED.has(v);
}

/** Allowlisted, non-PII property keys. Anything else is dropped, not stored. */
const ALLOWED_PROP_KEYS = new Set(['src', 'a_present']);

/** Keep only allowlisted keys with primitive values. Never store free text. */
export function sanitizeProps(input: unknown): Record<string, string | number | boolean> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!ALLOWED_PROP_KEYS.has(k)) continue;
    if (typeof v === 'string') { out[k] = v.slice(0, 32); continue; }
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

export type RecordInput = {
  name: EventName;
  userId?: string | null;
  anonId?: string | null;
  slug?: string | null;
  props?: Record<string, string | number | boolean> | null;
};

/**
 * Write one event. Returns whether it landed — callers ignore it in request paths and
 * assert on it in tests. Never throws.
 */
export async function recordEvent(e: RecordInput): Promise<boolean> {
  if (!isEventName(e.name)) return false;
  try {
    await db.insert(events).values({
      name: e.name,
      userId: e.userId ?? null,
      anonId: e.anonId ?? null,
      slug: e.slug ?? null,
      props: e.props ?? null,
    });
    return true;
  } catch (err) {
    // Deploy-safe: the table ships before migration 0005 reaches prod, and 42P01 must
    // degrade to "no telemetry", never to a failed save. Same guard as theme_preset.
    if (!isMissingTable(err)) console.error('recordEvent failed', e.name, err);
    return false;
  }
}

/**
 * Which skills were newly mastered / unmastered between two sets.
 * Pure, so the diff can be asserted without touching a database.
 */
export function masteryDiff(before: string[], after: string[]): { mastered: string[]; unmastered: string[] } {
  const b = new Set(before);
  const a = new Set(after);
  return {
    mastered: after.filter((s) => !b.has(s)),
    unmastered: before.filter((s) => !a.has(s)),
  };
}
