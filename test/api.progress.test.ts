import { describe, test, expect, beforeEach, vi } from 'vitest';

// --- Mock @/auth: auth() is a controllable async fn ---
vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

// --- Mock @/db: db.query.progress.findFirst + chainable db.insert(...) ---
type Row = { mastered: string[]; theme: string | null; sel: string | null; updatedAt: Date };
// Names must start with `mock` — Vitest hoists vi.mock factories above these decls.
const mockOnConflict = vi.fn((_set?: unknown) => Promise.resolve(undefined));
const mockValues = vi.fn((_row: Row) => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = vi.fn((_table?: unknown) => ({ values: mockValues }));
const mockFindFirst = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: { progress: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

import { auth } from '@/auth';
const mockedAuth = vi.mocked(auth);

async function loadRoute() {
  return import('@/app/api/progress/route');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/progress', () => {
  test('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('returns the stored row for an authenticated user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockFindFirst.mockResolvedValue({
      mastered: ['mirada-cabeceo', 'posture'],
      theme: 'light',
      sel: 'posture',
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const { GET } = await loadRoute();
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mastered).toEqual(['mirada-cabeceo', 'posture']);
    expect(body.theme).toBe('light');
    expect(body.sel).toBe('posture');
    expect(body.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('PUT /api/progress', () => {
  test('returns 401 when unauthenticated', async () => {
    mockedAuth.mockResolvedValue(null as never);
    const { PUT } = await loadRoute();
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: [], theme: null, sel: null }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  test('rejects a non-object / malformed body with 400 invalid_body', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const { PUT } = await loadRoute();
    for (const body of ['null', '"a string"', '[1,2]', 'not json']) {
      const req = new Request('http://test/api/progress', { method: 'PUT', body });
      const res = await PUT(req);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid_body' });
    }
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('sanitizes mastered and persists for an authenticated user', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const { PUT } = await loadRoute();
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: ['mirada-cabeceo', 'not-a-skill'], theme: 'dark', sel: null }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mastered).toContain('mirada-cabeceo');
    expect(body.mastered).not.toContain('not-a-skill');
    expect(body.theme).toBe('dark');
    expect(body.sel).toBe(null);
    // upsert chain was invoked twice: progress row + daily history snapshot
    expect(mockInsert).toHaveBeenCalledTimes(2);
    expect(mockValues).toHaveBeenCalledTimes(2);
    expect(mockOnConflict).toHaveBeenCalledTimes(2);
    // persisted values are sanitized too (both the row and the snapshot)
    expect(mockValues.mock.calls[0][0].mastered).toEqual(['mirada-cabeceo']);
    expect(mockValues.mock.calls[1][0].mastered).toEqual(['mirada-cabeceo']);
    // snapshot rows carry a YYYY-MM-DD day key
    expect((mockValues.mock.calls[1][0] as unknown as { day: string }).day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
