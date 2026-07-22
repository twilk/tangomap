import { beforeEach, describe, test, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// The auth control is a plain browser IIFE served from public/auth-ui.js. We load its
// source and eval it against a fresh jsdom document, stubbing fetch to return a given
// session shape, then assert the rendered #tm-auth anchor.
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

describe('auth-ui.js', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('signed out → Sign in link pointing at /api/auth/signin', async () => {
    await run({});
    const a = document.querySelector('#tm-auth a') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a!.getAttribute('href')).toBe('/api/auth/signin');
    expect(a!.textContent).toMatch(/sign in/i);
  });

  test('signed in → Sign out link pointing at /api/auth/signout', async () => {
    await run({ user: { name: 'Wilk', email: 'wilczyy@gmail.com' } });
    const a = document.querySelector('#tm-auth a') as HTMLAnchorElement | null;
    expect(a).not.toBeNull();
    expect(a!.getAttribute('href')).toBe('/api/auth/signout');
    expect(a!.textContent).toMatch(/sign out/i);
  });
});
