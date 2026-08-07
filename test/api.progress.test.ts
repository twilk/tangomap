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
    // Three inserts now: progress row, daily history snapshot, and exactly ONE event.
    // The existing row holds ['mirada-cabeceo','posture'] and the sanitised write is
    // ['mirada-cabeceo'], so the diff is a single UNMASTER of 'posture'. Note what does
    // NOT appear: 'mirada-cabeceo' is unchanged and emits nothing, and 'not-a-skill' was
    // sanitised away before the diff — sync churn must never inflate the input metric.
    expect(mockInsert).toHaveBeenCalledTimes(3);
    expect(mockValues).toHaveBeenCalledTimes(3);
    // Only the first two are upserts; the event insert is a plain append.
    expect(mockOnConflict).toHaveBeenCalledTimes(2);
    // The insert mock is typed for progress rows; an event row is a different shape.
    const evt = mockValues.mock.calls[2][0] as unknown as { name: string; slug: string; userId: string };
    expect(evt.name).toBe('skill_unmastered');
    expect(evt.slug).toBe('posture');
    expect(evt.userId).toBe('u1');
    // persisted values are sanitized too (both the row and the snapshot)
    expect(mockValues.mock.calls[0][0].mastered).toEqual(['mirada-cabeceo']);
    expect(mockValues.mock.calls[1][0].mastered).toEqual(['mirada-cabeceo']);
    // snapshot rows carry a YYYY-MM-DD day key
    expect((mockValues.mock.calls[1][0] as unknown as { day: string }).day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("accepts and persists theme:'custom' (does not null it)", async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    const { PUT } = await loadRoute();
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: [], theme: 'custom', sel: null }),
    });
    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect((await res.json()).theme).toBe('custom');
    expect(mockValues.mock.calls[0][0].theme).toBe('custom');
  });

  // Last-write-wins: a device whose local state is older than what the server holds
  // must NOT be able to overwrite it. This is the guard against the cross-device
  // clobber where a stale/second device wiped a fresh device's progress.
  test('LWW: rejects a stale write and returns the stored row WITHOUT writing', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockFindFirst.mockResolvedValue({
      mastered: ['mirada-cabeceo', 'posture', 'walking'],
      theme: 'dark',
      sel: null,
      updatedAt: new Date('2026-06-01T00:00:00.000Z'), // server is newer
    });
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: ['walking'], theme: 'light', sel: null, updatedAt: '2026-01-01T00:00:00.000Z' }),
    });
    const { PUT } = await loadRoute();
    const res = await PUT(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // authoritative stored state is returned, not the stale client set
    expect(body.mastered).toEqual(['mirada-cabeceo', 'posture', 'walking']);
    expect(body.theme).toBe('dark');
    expect(body.updatedAt).toBe('2026-06-01T00:00:00.000Z');
    // and crucially: nothing was written — no clobber
    expect(mockInsert).not.toHaveBeenCalled();
  });

  test('LWW: accepts a write newer than stored, stamped with the client clock', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockFindFirst.mockResolvedValue({
      mastered: ['walking'],
      theme: 'light',
      sel: null,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'), // server is older
    });
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: ['mirada-cabeceo', 'posture'], theme: 'dark', sel: null, updatedAt: '2026-06-01T00:00:00.000Z' }),
    });
    const { PUT } = await loadRoute();
    const res = await PUT(req);
    const body = await res.json();
    expect(body.mastered).toEqual(['mirada-cabeceo', 'posture']);
    expect(body.updatedAt).toBe('2026-06-01T00:00:00.000Z'); // stamped with the client clock, not now
    expect(mockInsert).toHaveBeenCalled();
    expect((mockValues.mock.calls[0][0].updatedAt as Date).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  test('LWW: a tie (equal timestamps) is accepted — the client wins ties', async () => {
    mockedAuth.mockResolvedValue({ user: { id: 'u1' } } as never);
    mockFindFirst.mockResolvedValue({
      mastered: ['walking'],
      theme: 'light',
      sel: null,
      updatedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    const req = new Request('http://test/api/progress', {
      method: 'PUT',
      body: JSON.stringify({ mastered: ['posture'], theme: 'dark', sel: null, updatedAt: '2026-03-01T00:00:00.000Z' }),
    });
    const { PUT } = await loadRoute();
    const res = await PUT(req);
    expect((await res.json()).mastered).toEqual(['posture']);
    expect(mockInsert).toHaveBeenCalled();
  });
});
