import { describe, test, expect, vi, beforeEach } from 'vitest';
import { isMissingTable } from '@/src/lib/dbSafe';
import { STARTER_COMMUNITY_THEMES } from '@/src/lib/communityStarters';

// The curated starters are prepended to every getCommunityThemes read, so even a
// missing theme_preset table degrades to a starters-only gallery, never a 500.
const STARTER_IDS = STARTER_COMMUNITY_THEMES.map((t) => t.id);
const N_STARTERS = STARTER_COMMUNITY_THEMES.length;

// Deploy-safety: `theme_preset` is declared in the schema but only created by
// migration 0004. Until that runs in a given database, every query that touches
// the table raises Postgres 42P01 ("undefined_table"). These tests drive the db
// layer to THROW { code: '42P01' } from the theme_preset queries and assert that
// every read degrades to empty/null and every write degrades to a clean 503 —
// while any OTHER error (a real bug) still propagates untouched.

// One @/db mock governs the whole file: it wires the query/chain surface used by
// BOTH the publicProfile read model (getCommunityThemes / getSharedTheme) and the
// preset route handlers (GET/POST + PATCH/DELETE).
const {
  mockAuth,
  mockFindMany, mockPresetFindFirst, mockProfileFindFirst,
  mockSelect,
  mockInsert, mockValues, mockReturning, mockOnConflict,
  mockUpdate, mockSet, mockUpdateWhere,
  mockDelete, mockDeleteWhere,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindMany: vi.fn(), mockPresetFindFirst: vi.fn(), mockProfileFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(), mockValues: vi.fn(), mockReturning: vi.fn(), mockOnConflict: vi.fn(),
  mockUpdate: vi.fn(), mockSet: vi.fn(), mockUpdateWhere: vi.fn(),
  mockDelete: vi.fn(), mockDeleteWhere: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/db', () => ({
  db: {
    query: {
      themePreset: { findMany: mockFindMany, findFirst: mockPresetFindFirst },
      profile: { findFirst: mockProfileFindFirst },
    },
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

const loadRoute = () => import('@/app/api/presets/route');
const loadIdRoute = () => import('@/app/api/presets/[id]/route');
const loadPublic = () => import('@/src/lib/publicProfile');

const post = (b: unknown) => new Request('http://localhost/api/presets', { method: 'POST', body: JSON.stringify(b) });
const patch = (b: unknown) => new Request('http://localhost/api/presets/p1', { method: 'PATCH', body: JSON.stringify(b) });
const del = () => new Request('http://localhost/api/presets/p1', { method: 'DELETE' });
const ctx = (id = 'p1') => ({ params: Promise.resolve({ id }) });

const valid = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const MISSING = { code: '42P01' }; // undefined_table
const OTHER = { code: '08006' };   // connection_failure — a real error, must NOT be swallowed

/** A chainable db.select(...) stub whose terminal .limit() settles with `settle()`. */
function selectChain(settle: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = self;
  chain.innerJoin = self;
  chain.where = self;
  chain.orderBy = self;
  chain.limit = settle;
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  // Safe defaults (success-path shape); individual tests override to throw.
  mockFindMany.mockResolvedValue([]);
  mockPresetFindFirst.mockResolvedValue(undefined);
  mockProfileFindFirst.mockResolvedValue(undefined);
  mockSelect.mockReturnValue(selectChain(() => Promise.resolve([])));
  mockReturning.mockResolvedValue([{ id: 'p1', name: 'Valid Name', seeds: valid, isShared: false, updatedAt: new Date(0) }]);
  mockOnConflict.mockResolvedValue(undefined);
  mockValues.mockReturnValue({ returning: mockReturning, onConflictDoUpdate: mockOnConflict });
  mockInsert.mockReturnValue({ values: mockValues });
  mockUpdateWhere.mockResolvedValue(undefined);
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockDeleteWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
});

describe('isMissingTable', () => {
  test('true only for Postgres 42P01', () => {
    expect(isMissingTable({ code: '42P01' })).toBe(true);
    expect(isMissingTable({ code: '08006' })).toBe(false);
    expect(isMissingTable(new Error('boom'))).toBe(false);
    expect(isMissingTable(null)).toBe(false);
    expect(isMissingTable(undefined)).toBe(false);
    expect(isMissingTable('42P01')).toBe(false);
  });
});

// --- READ paths degrade to empty/null when theme_preset is missing ---
describe('read paths degrade gracefully on missing table', () => {
  test('getCommunityThemes() → starters only (not a throw) when the table is missing', async () => {
    mockSelect.mockReturnValue(selectChain(() => Promise.reject(MISSING)));
    const { getCommunityThemes } = await loadPublic();
    // No live rows survive a missing table, but the starters always ship.
    await expect(getCommunityThemes().then((l) => l.map((t) => t.id))).resolves.toEqual(STARTER_IDS);
  });

  test('getSharedTheme() → null, with a public profile row present so it reaches the preset query', async () => {
    mockProfileFindFirst.mockResolvedValue({ userId: 'u1', handle: 'wilk', isPublic: true, displayName: 'Wilk' });
    mockPresetFindFirst.mockRejectedValue(MISSING);
    const { getSharedTheme } = await loadPublic();
    await expect(getSharedTheme('wilk')).resolves.toBeNull();
    // Proves it got past the profile gate and actually hit the theme_preset query.
    expect(mockPresetFindFirst).toHaveBeenCalledTimes(1);
  });

  test('GET /api/presets → 200 with [] (empty library)', async () => {
    mockFindMany.mockRejectedValue(MISSING);
    const res = await (await loadRoute()).GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

// --- WRITE paths degrade to a clean 503 not_ready when theme_preset is missing ---
describe('write paths degrade to 503 not_ready on missing table', () => {
  test('POST /api/presets (valid body) → 503 not_ready', async () => {
    mockFindMany.mockRejectedValue(MISSING);
    const res = await (await loadRoute()).POST(post({ name: 'Valid Name', seeds: valid }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not_ready' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('PATCH /api/presets/[id] → 503 not_ready', async () => {
    mockPresetFindFirst.mockRejectedValue(MISSING);
    const res = await (await loadIdRoute()).PATCH(patch({ setActive: true }), ctx());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not_ready' });
    // No profile upsert once the preset lookup reports the table missing.
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('DELETE /api/presets/[id] → 503 not_ready', async () => {
    mockPresetFindFirst.mockRejectedValue(MISSING);
    const res = await (await loadIdRoute()).DELETE(del(), ctx());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'not_ready' });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// --- A NON-42P01 error is a real bug — it must still propagate, never be swallowed ---
describe('non-42P01 errors still propagate (real bugs are not swallowed)', () => {
  test('getCommunityThemes rejects on a non-42P01 error', async () => {
    mockSelect.mockReturnValue(selectChain(() => Promise.reject(OTHER)));
    const { getCommunityThemes } = await loadPublic();
    await expect(getCommunityThemes()).rejects.toMatchObject(OTHER);
  });

  test('getSharedTheme rejects on a non-42P01 error', async () => {
    mockProfileFindFirst.mockResolvedValue({ userId: 'u9', handle: 'other', isPublic: true, displayName: 'Other' });
    mockPresetFindFirst.mockRejectedValue(OTHER);
    const { getSharedTheme } = await loadPublic();
    await expect(getSharedTheme('other')).rejects.toMatchObject(OTHER);
  });

  test('GET /api/presets rejects on a non-42P01 error', async () => {
    mockFindMany.mockRejectedValue(OTHER);
    await expect((await loadRoute()).GET()).rejects.toMatchObject(OTHER);
  });

  test('POST /api/presets rejects on a non-42P01 error', async () => {
    mockFindMany.mockRejectedValue(OTHER);
    await expect((await loadRoute()).POST(post({ name: 'Valid Name', seeds: valid }))).rejects.toMatchObject(OTHER);
  });

  test('PATCH /api/presets/[id] rejects on a non-42P01 error', async () => {
    mockPresetFindFirst.mockRejectedValue(OTHER);
    await expect((await loadIdRoute()).PATCH(patch({ setActive: true }), ctx())).rejects.toMatchObject(OTHER);
  });

  test('DELETE /api/presets/[id] rejects on a non-42P01 error', async () => {
    mockPresetFindFirst.mockRejectedValue(OTHER);
    await expect((await loadIdRoute()).DELETE(del(), ctx())).rejects.toMatchObject(OTHER);
  });
});

// --- The guard is transparent when the table EXISTS: success paths are unchanged ---
describe('guard is transparent when the table exists', () => {
  test('GET /api/presets returns the owned rows normally', async () => {
    mockFindMany.mockResolvedValue([{ id: 'p1', name: 'Good', seeds: valid, isShared: false, updatedAt: new Date(0) }]);
    const res = await (await loadRoute()).GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveLength(1);
  });

  test('getCommunityThemes shapes rows normally (starters first, then the live row)', async () => {
    mockSelect.mockReturnValue(selectChain(() => Promise.resolve([
      { id: 'p1', name: 'Carmesí', seeds: valid, isShared: true, isPublic: true, authorHandle: 'ana', authorDisplayName: 'Ana' },
    ])));
    const { getCommunityThemes } = await loadPublic();
    const list = await getCommunityThemes();
    expect(list).toHaveLength(N_STARTERS + 1);
    expect(list.slice(0, N_STARTERS).map((t) => t.id)).toEqual(STARTER_IDS);
    expect(list[N_STARTERS]).toMatchObject({ id: 'p1', name: 'Carmesí', authorHandle: 'ana' });
  });
});
