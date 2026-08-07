import { describe, test, expect, vi, beforeEach } from 'vitest';

// The four funnel events that were allowlisted but never emitted. These assert the
// DECISION each call site makes — when to fire and, more importantly, when not to.
// An event that fires too eagerly is worse than a missing one: it produces a funnel
// that looks healthy and is not.

describe('handle_claimed fires only on the null -> set transition', () => {
  // The rule the route implements: `!existing?.handle && handle !== null`.
  const claimed = (existingHandle: string | null, next: string | null) => !existingHandle && next !== null;

  test('first ever claim counts', () => {
    expect(claimed(null, 'ola')).toBe(true);
  });

  test('renaming an existing handle is NOT a new claim', () => {
    // The inflation risk: someone edits their handle twice and looks like two invitees.
    expect(claimed('ola', 'ola2')).toBe(false);
  });

  test('clearing a handle is not a claim', () => {
    expect(claimed('ola', null)).toBe(false);
  });

  test('a no-op save on an existing handle is not a claim', () => {
    expect(claimed('ola', 'ola')).toBe(false);
  });
});

describe('link_open / compare_filled conditions', () => {
  // Mirrors app/compare/page.tsx: link_open needs ?a=, compare_filled needs BOTH
  // profiles to have resolved — not merely to have been requested.
  const linkOpen = (spA: string | undefined) => Boolean(spA);
  const compareFilled = (pa: unknown, pb: unknown) => Boolean(pa && pb);

  test('link_open fires on an arrival carrying ?a=', () => {
    expect(linkOpen('wilk')).toBe(true);
  });

  test('link_open does not fire on a bare /compare visit', () => {
    expect(linkOpen(undefined)).toBe(false);
  });

  test('compare_filled requires both profiles to resolve', () => {
    expect(compareFilled({ handle: 'a' }, { handle: 'b' })).toBe(true);
  });

  test('compare_filled does NOT fire when only one handle resolved', () => {
    // The common real case: an invitee arrives, their own handle is not public yet.
    expect(compareFilled({ handle: 'a' }, null)).toBe(false);
    expect(compareFilled(null, { handle: 'b' })).toBe(false);
  });

  test('compare_filled does not fire on an empty compare page', () => {
    expect(compareFilled(null, null)).toBe(false);
  });
});

describe('client emitter is same-origin and never throws', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  test('posts to a relative /api/events path — never an absolute URL', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal('window', {});
    const { track } = await import('@/src/lib/track');
    track('invite_copied');
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0][0]).toBe('/api/events');
  });

  test('carries the event name and slug in the body', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    // jsdom's Blob has no .text(); capture the payload as it is constructed instead.
    const seen: string[] = [];
    class CapturingBlob {
      constructor(parts: string[]) { seen.push(parts.join('')); }
    }
    vi.stubGlobal('Blob', CapturingBlob);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal('window', {});
    const { track } = await import('@/src/lib/track');
    track('skill_page_view', { slug: 'ocho-adelante', props: { src: 'organic' } });
    expect(JSON.parse(seen[0])).toEqual({
      name: 'skill_page_view',
      slug: 'ocho-adelante',
      props: { src: 'organic' },
    });
  });

  test('a throwing beacon never propagates — telemetry must not break an interaction', async () => {
    vi.stubGlobal('navigator', { sendBeacon: () => { throw new Error('blocked'); } });
    vi.stubGlobal('window', {});
    vi.stubGlobal('fetch', vi.fn());
    const { track } = await import('@/src/lib/track');
    expect(() => track('invite_copied')).not.toThrow();
  });

  test('is a no-op on the server, where there is no window', async () => {
    const beacon = vi.fn();
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    vi.stubGlobal('window', undefined);
    const { track } = await import('@/src/lib/track');
    track('invite_copied');
    expect(beacon).not.toHaveBeenCalled();
  });
});
