import { describe, test, expect, beforeEach, vi } from 'vitest';

const mockAuth = vi.fn();
const mockWhere = vi.fn(() => Promise.resolve());
const mockDelete = vi.fn(() => ({ where: mockWhere }));

vi.mock('@/auth', () => ({ auth: mockAuth }));
vi.mock('@/db', () => ({ db: { delete: mockDelete } }));

async function importRoute() {
  return await import('@/app/api/account/route');
}

describe('DELETE /api/account', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockWhere.mockClear();
    mockDelete.mockClear();
  });

  test('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const { DELETE } = await importRoute();
    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test('deletes the user and returns { deleted: true } when authenticated', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const { DELETE } = await importRoute();
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: true });
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(mockWhere).toHaveBeenCalledTimes(1);
  });
});
