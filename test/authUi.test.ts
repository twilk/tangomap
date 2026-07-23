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

  test('signed out → a single Sign in link pointing at the branded /signin', async () => {
    await run({});
    const a = links();
    expect(a).toHaveLength(1);
    expect(a[0].getAttribute('href')).toBe('/signin');
    expect(a[0].textContent).toMatch(/sign in/i);
  });

  test('signed in → Settings + Sign out links (branded routes)', async () => {
    await run({ user: { name: 'Wilk', email: 'wilczyy@gmail.com' } });
    const a = links();
    const byHref = Object.fromEntries(a.map((x) => [x.getAttribute('href'), x.textContent ?? '']));
    expect(byHref['/settings']).toMatch(/settings/i);
    expect(byHref['/signout']).toMatch(/sign out/i);
    // no legacy /api/auth/* links leak into the map pill
    expect(a.some((x) => (x.getAttribute('href') ?? '').startsWith('/api/auth'))).toBe(false);
  });
});
