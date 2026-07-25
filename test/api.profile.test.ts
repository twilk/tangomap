import { describe, test, expect, vi, beforeEach } from 'vitest';

// Shared mock fns, hoisted so the vi.mock factories below can close over them.
const { mockAuth, mockFindFirst, mockOnConflict, mockValues, mockInsert } = vi.hoisted(() => {
  const mockAuth = vi.fn();
  const mockFindFirst = vi.fn();
  const mockOnConflict = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();
  return { mockAuth, mockFindFirst, mockOnConflict, mockValues, mockInsert };
});

vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/db', () => ({
  db: {
    query: { profile: { findFirst: mockFindFirst } },
    insert: mockInsert,
  },
}));

const loadRoute = () => import('@/app/api/profile/route');
const putReq = (body: unknown) =>
  new Request('http://localhost/api/profile', { method: 'PUT', body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish the drizzle insert(...).values(...).onConflictDoUpdate(...) chain.
  mockOnConflict.mockResolvedValue(undefined);
  mockValues.mockReturnValue({ onConflictDoUpdate: mockOnConflict });
  mockInsert.mockReturnValue({ values: mockValues });
  mockFindFirst.mockResolvedValue(undefined);
});

describe('profile API', () => {
  test('(a) GET returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('(b) PUT returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ handle: 'ana-tango' }));
    expect(res.status).toBe(401);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('(c) PUT with invalid handle "ab" returns 400', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ handle: 'ab' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_handle' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('(d) PUT where handle is owned by a different user returns 409', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindFirst.mockResolvedValue({ userId: 'other' });
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ handle: 'taken-handle' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'handle_taken' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('(e) PUT happy path returns 200 and echoes the input', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindFirst.mockResolvedValue(undefined); // no clash
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ handle: 'Milonguero-99', isPublic: true, displayName: 'Ada', style: 'nuevo' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      handle: 'milonguero-99', // normalized to lowercase
      isPublic: true,
      displayName: 'Ada',
      style: 'nuevo',
    });
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockOnConflict).toHaveBeenCalledTimes(1);
  });

  test('(f) partial update keeps existing fields (does not clobber)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindFirst.mockResolvedValue({ userId: 'u1', handle: 'ana', displayName: 'Ana', isPublic: false, style: null });
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ isPublic: true })); // only isPublic sent
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ handle: 'ana', isPublic: true, displayName: 'Ana', style: null });
    // the persisted set must retain handle + displayName
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ handle: 'ana', displayName: 'Ana', isPublic: true }));
  });

  test('(g) going public with no handle returns 400 handle_required', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindFirst.mockResolvedValue(undefined); // no existing profile
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ isPublic: true }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'handle_required' });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('(h) an empty displayName is coerced to null (page & OG agree)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockFindFirst.mockResolvedValue(undefined);
    const { PUT } = await loadRoute();
    const res = await PUT(putReq({ handle: 'ada-tango', displayName: '   ' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ displayName: null });
    expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ displayName: null }));
  });

  test('(i) a non-object JSON body returns 400 invalid_body (not a 500)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const { PUT } = await loadRoute();
    const res = await PUT(putReq([1, 2, 3]));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_body' });
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
