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
const post = (b: unknown) => new Request('http://localhost/api/presets', { method: 'POST', body: JSON.stringify(b) });
const valid = { v: 1, ground: '#1b1327', ink: '#f2e8d8', accent: '#e59ac2', accent2: '#8fd4b0' };

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
