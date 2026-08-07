import { auth } from '@/auth';
import { isEventName, sanitizeProps, recordEvent, type EventName } from '@/src/lib/events';

/**
 * The client-side telemetry pipe. It is a pipe, not an API.
 *
 * Only two names are reachable from a browser (`invite_copied`, `skill_page_view`);
 * everything else is emitted server-side where it cannot be forged. The name allowlist
 * and the props allowlist mean a hostile client can add rows but cannot invent event
 * types or store free text — the worst it achieves is noise in two buckets.
 *
 * Always 204, even on reject: telemetry must never surface an error to a user, and a
 * caller has nothing useful to do with the outcome.
 */
export const dynamic = 'force-dynamic';

/** Names a browser is allowed to emit. Strictly narrower than EVENT_NAMES. */
const CLIENT_EMITTABLE = new Set<EventName>(['invite_copied', 'skill_page_view']);

const NO_CONTENT = { status: 204, headers: { 'Cache-Control': 'no-store' } } as const;

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, NO_CONTENT);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return new Response(null, NO_CONTENT);

  const { name, slug, props } = body as { name?: unknown; slug?: unknown; props?: unknown };
  if (!isEventName(name) || !CLIENT_EMITTABLE.has(name)) return new Response(null, NO_CONTENT);

  // A session if there is one; signed-out events are legitimate (link_open precursor).
  const session = await auth().catch(() => null);

  await recordEvent({
    name,
    userId: session?.user?.id ?? null,
    // Slugs are short identifiers, never prose. Cap defensively.
    slug: typeof slug === 'string' && slug.length <= 64 ? slug : null,
    props: sanitizeProps(props),
  });

  return new Response(null, NO_CONTENT);
}
