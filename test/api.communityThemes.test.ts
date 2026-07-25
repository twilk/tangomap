import { describe, test, expect, vi, beforeEach } from 'vitest';

// The endpoint is a thin, unauthenticated wrapper over the gated read model, so we
// mock the read model itself and assert the JSON body + the cache header.
const { mockGetCommunityThemes } = vi.hoisted(() => ({ mockGetCommunityThemes: vi.fn() }));
vi.mock('@/src/lib/publicProfile', () => ({ getCommunityThemes: mockGetCommunityThemes }));

const load = () => import('@/app/api/community-themes/route');

const THEME = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const LIST = [
  { id: 'p1', name: 'Carmesí', seeds: THEME, authorHandle: 'ana', authorDisplayName: 'Ana' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCommunityThemes.mockResolvedValue(LIST);
});

describe('community-themes API', () => {
  test('GET returns the community list as JSON (no auth required)', async () => {
    const res = await (await load()).GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(LIST);
    expect(mockGetCommunityThemes).toHaveBeenCalledTimes(1);
  });

  test('GET sets a 60s public Cache-Control header', async () => {
    const res = await (await load()).GET();
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=60');
  });

  test('GET returns [] when the gallery is empty', async () => {
    mockGetCommunityThemes.mockResolvedValue([]);
    const res = await (await load()).GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});
