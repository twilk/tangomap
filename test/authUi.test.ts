import { beforeEach, describe, test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The auth control is a plain browser IIFE served from public/auth-ui.js. We load its
// source and eval it against a fresh jsdom document, stubbing fetch to return a given
// session shape, then assert the rendered #tm-auth anchors.
const here = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(here, '../public/auth-ui.js'), 'utf8');

async function run(session: unknown) {
  document.documentElement.innerHTML = '<head></head><body></body>';
  globalThis.fetch = vi.fn(async () => ({ json: async () => session })) as unknown as typeof fetch;
  (0, eval)(SRC);
  // Flush the fetch().then().then() microtask chain.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

function links(): HTMLAnchorElement[] {
  return Array.from(document.querySelectorAll('#tm-auth a')) as HTMLAnchorElement[];
}

describe('auth-ui.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // The map header and the app's own TopNav are two separate navigations that
  // must offer the same destinations, or the product tells two different stories
  // about where things live. These assert the converged menu: Learn is offered to
  // everyone, and a signed-in dancer can reach their card in one click from the
  // map. Changing either nav without the other should fail here.
  test('signed out → Learn + a Sign in link pointing at the branded /signin', async () => {
    await run({});
    const a = links();
    const byHref = Object.fromEntries(a.map((x) => [x.getAttribute('href'), x.textContent ?? '']));
    expect(a).toHaveLength(2);
    expect(byHref['/skills']).toMatch(/learn/i);
    expect(byHref['/signin']).toMatch(/sign in/i);
  });

  test('signed in → the full converged menu (branded routes)', async () => {
    await run({ user: { name: 'Wilk', email: 'wilczyy@gmail.com' } });
    const a = links();
    const byHref = Object.fromEntries(a.map((x) => [x.getAttribute('href'), x.textContent ?? '']));
    expect(byHref['/skills']).toMatch(/learn/i);
    expect(byHref['/me']).toMatch(/profile/i);
    // the dancer card is a destination, reachable in one click from the map
    expect(byHref['/me/card']).toMatch(/card/i);
    expect(byHref['/settings']).toMatch(/settings/i);
    expect(byHref['/signout']).toMatch(/sign out/i);
    // no legacy /api/auth/* links leak into the map pill
    expect(a.some((x) => (x.getAttribute('href') ?? '').startsWith('/api/auth'))).toBe(false);
  });
});
