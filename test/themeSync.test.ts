import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import { pushCustomTheme, pullAndMergeTheme } from '@/src/lib/themeSync';
import { applyCustomTheme, customUpdatedAt, hasCustomTheme } from '@/src/lib/customTheme';
import type { Theme } from '@/src/lib/theme';

// A legible theme (ink/ground ≥ 4.5, accents ≥ 3) — parseTheme accepts it.
const THEME: Theme = { v: 1, ground: '#ffffff', ink: '#000000', accent: '#0000ff', accent2: '#008000' };

function styleEl() {
  return document.getElementById('tm-custom-theme');
}

/** A GET response for /api/profile carrying the given clock + theme. */
function getRes(customThemeUpdatedAt: string | null, customTheme: Theme | null) {
  return { status: 200, json: async () => ({ customThemeUpdatedAt, customTheme }) };
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  const el = styleEl();
  if (el && el.parentNode) el.parentNode.removeChild(el);
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- pushCustomTheme ---------------------------------------------------------

test('pushCustomTheme PUTs the local theme + its clock as an ISO string', async () => {
  applyCustomTheme(THEME, 1234);
  fetchMock.mockResolvedValue({ status: 200, json: async () => ({}) });

  await pushCustomTheme();

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/profile');
  expect(opts.method).toBe('PUT');
  const body = JSON.parse(opts.body);
  expect(body.customTheme).toEqual(THEME);
  expect(body.customThemeUpdatedAt).toBe(new Date(1234).toISOString());
});

test('pushCustomTheme swallows a rejected fetch (offline is non-fatal)', async () => {
  applyCustomTheme(THEME, 1234);
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(pushCustomTheme()).resolves.toBeUndefined();
});

// --- pullAndMergeTheme -------------------------------------------------------

test('pull with server newer + non-null theme caches it WITHOUT forcing data-theme=custom', async () => {
  // local: nothing recorded (clock 0). server: a theme stamped later.
  fetchMock.mockResolvedValue(getRes(new Date(9000).toISOString(), THEME));

  await pullAndMergeTheme();

  // cache written…
  expect(localStorage.getItem('tsm-custom-css')).toContain('--tm-ground:#ffffff');
  expect(hasCustomTheme()).toBe(true);
  expect(customUpdatedAt()).toBe(9000);
  // …but the user is NOT switched into custom mode
  expect(localStorage.getItem('tsm-theme')).not.toBe('custom');
  expect(document.documentElement.getAttribute('data-theme')).not.toBe('custom');
  // and only the GET happened — no echo push
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('pull with server newer + null theme clears the local custom theme', async () => {
  applyCustomTheme(THEME, 1000); // local theme, older clock
  expect(hasCustomTheme()).toBe(true);
  fetchMock.mockResolvedValue(getRes(new Date(5000).toISOString(), null));

  await pullAndMergeTheme();

  expect(hasCustomTheme()).toBe(false);
  expect(localStorage.getItem('tsm-custom-css')).toBeNull();
  // the clear stamps the server's clock (records when it was cleared)
  expect(customUpdatedAt()).toBe(5000);
  expect(fetchMock).toHaveBeenCalledTimes(1); // GET only
});

test('pull with local newer pushes the local theme to the server', async () => {
  applyCustomTheme(THEME, 9999); // local is fresher than the server
  fetchMock.mockImplementation((_url: string, opts?: { method?: string }) =>
    Promise.resolve(
      opts?.method === 'PUT'
        ? { status: 200, json: async () => ({}) }
        : getRes(new Date(1000).toISOString(), THEME),
    ),
  );

  await pullAndMergeTheme();

  // GET then a PUT (the echo push)
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const put = fetchMock.mock.calls.find((c) => c[1]?.method === 'PUT');
  expect(put).toBeTruthy();
  const body = JSON.parse(put![1].body);
  expect(body.customTheme).toEqual(THEME);
  expect(body.customThemeUpdatedAt).toBe(new Date(9999).toISOString());
});

test('pull on a 401 response is a no-op (signed out)', async () => {
  applyCustomTheme(THEME, 1000);
  fetchMock.mockResolvedValue({ status: 401, json: async () => ({ error: 'unauthorized' }) });

  await pullAndMergeTheme();

  // nothing merged, nothing pushed — the local theme is untouched
  expect(hasCustomTheme()).toBe(true);
  expect(customUpdatedAt()).toBe(1000);
  expect(fetchMock).toHaveBeenCalledTimes(1); // GET only, no PUT
});

test('pull swallows a rejected fetch (offline is non-fatal)', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(pullAndMergeTheme()).resolves.toBeUndefined();
});
