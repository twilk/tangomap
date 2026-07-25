import { describe, test, expect, vi, beforeEach } from 'vitest';

// Superset of the mocks both route modules need (route.ts + [id]/route.ts). One
// vi.mock('@/db') governs the whole file, so it wires every query/chain used across
// GET/POST (list/create) and PATCH/DELETE (mutate).
const {
  mockAuth,
  mockFindMany, mockPresetFindFirst, mockProfileFindFirst,
  mockInsert, mockValues, mockReturning, mockOnConflict,
  mockUpdate, mockSet, mockUpdateWhere,
  mockDelete, mockDeleteWhere,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockFindMany: vi.fn(), mockPresetFindFirst: vi.fn(), mockProfileFindFirst: vi.fn(),
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
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

const load = () => import('@/app/api/presets/route');
const loadId = () => import('@/app/api/presets/[id]/route');
const post = (b: unknown) => new Request('http://localhost/api/presets', { method: 'POST', body: JSON.stringify(b) });
const patch = (b: unknown) => new Request('http://localhost/api/presets/p1', { method: 'PATCH', body: JSON.stringify(b) });
const del = () => new Request('http://localhost/api/presets/p1', { method: 'DELETE' });
const ctx = (id = 'p1') => ({ params: Promise.resolve({ id }) });
const valid = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };
const ownedRow = { id: 'p1', userId: 'u1', name: 'Carmesí', seeds: valid, isShared: false, updatedAt: new Date(0) };

beforeEach(() => {
  vi.clearAllMocks();
  // insert(...).values(...).returning()  AND  insert(...).values(...).onConflictDoUpdate(...)
  mockReturning.mockResolvedValue([{ id: 'p1', name: 'Carmesí', seeds: valid, isShared: false, updatedAt: new Date(0) }]);
  mockOnConflict.mockResolvedValue(undefined);
  mockValues.mockReturnValue({ returning: mockReturning, onConflictDoUpdate: mockOnConflict });
  mockInsert.mockReturnValue({ values: mockValues });
  // update(...).set(...).where(...)
  mockUpdateWhere.mockResolvedValue(undefined);
  mockSet.mockReturnValue({ where: mockUpdateWhere });
  mockUpdate.mockReturnValue({ set: mockSet });
  // delete(...).where(...)
  mockDeleteWhere.mockResolvedValue(undefined);
  mockDelete.mockReturnValue({ where: mockDeleteWhere });
  // queries
  mockFindMany.mockResolvedValue([]);
  mockPresetFindFirst.mockResolvedValue(undefined);
  mockProfileFindFirst.mockResolvedValue(undefined);
});

describe('presets API', () => {
  test('GET 401 unauth', async () => {
    mockAuth.mockResolvedValue(null);
    expect((await (await load()).GET()).status).toBe(401);
  });

  test('POST rejects an illegible theme with 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await (await load()).POST(post({ name: 'Bad', seeds: { v: 1, ground: '#111', ink: '#131313', accent: '#111', accent2: '#111' } }));
    expect(res.status).toBe(400);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('POST rejects at cap (5 existing) with 409 cap', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValue([1, 2, 3, 4, 5].map((i) => ({ name: `P${i}` })));
    const res = await (await load()).POST(post({ name: 'Sixth', seeds: valid }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'cap' });
  });

  test('POST happy path inserts the parsed (canonical) seeds and returns the row', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await (await load()).POST(post({ name: '  Carmesí ', seeds: valid }));
    expect(res.status).toBe(200);
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', name: 'Carmesí' }));
  });

  test('POST rejects an invalid name with 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await (await load()).POST(post({ name: 'a', seeds: valid }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_name' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('POST rejects a duplicate name with 409 duplicate', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindMany.mockResolvedValue([{ name: 'Carmesí' }]);
    const res = await (await load()).POST(post({ name: 'carmesí', seeds: valid }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'duplicate' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('POST 401 unauth (no insert)', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await (await load()).POST(post({ name: 'X', seeds: valid }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('GET lists owned presets and drops rows whose stored seeds no longer validate', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const bad = { v: 1, ground: '#000000', ink: '#111111', accent: '#222222', accent2: '#333333' }; // sub-AA
    mockFindMany.mockResolvedValue([
      { id: 'p1', name: 'Good', seeds: valid, isShared: false, updatedAt: new Date(0) },
      { id: 'p2', name: 'Rotten', seeds: bad, isShared: false, updatedAt: new Date(0) },
    ]);
    const res = await (await load()).GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ id: 'p1', name: 'Good', isShared: false });
    expect(body[0].seeds).toEqual(valid);
    expect(typeof body[0].updatedAt).toBe('string');
  });
});

describe('presets [id] API', () => {
  test('PATCH 401 unauth (no write)', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await (await loadId()).PATCH(patch({ name: 'X' }), ctx());
    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('PATCH on a row owned by another user returns 404', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(undefined); // owned() finds nothing for this user
    const res = await (await loadId()).PATCH(patch({ name: 'Nope' }), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('PATCH invalid name returns 400 invalid_name (no write)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(ownedRow);
    const res = await (await loadId()).PATCH(patch({ name: 'a' }), ctx());
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_name' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('PATCH name that duplicates a sibling returns 409 duplicate (case-insensitive, no write)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue({ ...ownedRow, name: 'Old' });
    mockFindMany.mockResolvedValue([{ name: 'Taken' }]); // sibling presets
    const res = await (await loadId()).PATCH(patch({ name: 'taken' }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'duplicate' });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('PATCH name (valid, unique) persists the sanitized name', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue({ ...ownedRow, name: 'Old' });
    mockFindMany.mockResolvedValue([]); // no siblings
    const res = await (await loadId()).PATCH(patch({ name: '  Neon  Nights ' }), ctx());
    expect(res.status).toBe(200);
    expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ name: 'Neon Nights' }));
  });

  test('PATCH isShared:true on a PRIVATE profile returns 409 needs_public (share gate fires before any write)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(ownedRow);
    mockProfileFindFirst.mockResolvedValue({ isPublic: false, handle: null });
    const res = await (await loadId()).PATCH(patch({ isShared: true }), ctx());
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'needs_public' });
    expect(mockUpdate).not.toHaveBeenCalled();  // no sibling-clear, no main write
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('PATCH isShared:true public+handle clears siblings then sets this one (0-or-1 per user)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(ownedRow);
    mockProfileFindFirst.mockResolvedValue({ isPublic: true, handle: 'ana' });
    const res = await (await loadId()).PATCH(patch({ isShared: true }), ctx());
    expect(res.status).toBe(200);
    // First update clears the OTHER presets' isShared; the main update sets this one.
    expect(mockSet.mock.calls[0][0]).toEqual({ isShared: false });
    expect(mockSet.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ isShared: true }));
  });

  test('PATCH setActive:true upserts profile.customTheme = this.seeds, setting ONLY customTheme+customThemeUpdatedAt', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(ownedRow);
    const res = await (await loadId()).PATCH(patch({ setActive: true }), ctx());
    expect(res.status).toBe(200);
    // profile upsert happened
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const values = mockValues.mock.calls[0][0];
    expect(values.customTheme).toEqual(valid);
    expect(values.customThemeUpdatedAt).toBeInstanceOf(Date);
    // The onConflict SET must touch EXACTLY these two columns — never clobber handle/isPublic/etc.
    const conflictArg = mockOnConflict.mock.calls[0][0];
    expect(Object.keys(conflictArg.set).sort()).toEqual(['customTheme', 'customThemeUpdatedAt']);
    expect(conflictArg.set.customTheme).toEqual(valid);
    expect(conflictArg.set.customThemeUpdatedAt).toBeInstanceOf(Date);
  });

  test('DELETE 401 unauth (no delete)', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await (await loadId()).DELETE(del(), ctx());
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('DELETE on a row owned by another user returns 404 (no delete)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(undefined);
    const res = await (await loadId()).DELETE(del(), ctx());
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('DELETE an owned row removes it', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPresetFindFirst.mockResolvedValue(ownedRow);
    const res = await (await loadId()).DELETE(del(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});
