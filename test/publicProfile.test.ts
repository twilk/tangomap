import { describe, test, expect, beforeEach, vi } from 'vitest';

// --- Mock @/db: db.query.profile.findFirst + db.query.progress.findFirst ---
const profileFindFirst = vi.fn();
const progressFindFirst = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      profile: { findFirst: (...args: unknown[]) => profileFindFirst(...args) },
      progress: { findFirst: (...args: unknown[]) => progressFindFirst(...args) },
    },
  },
}));

async function load() {
  return import('@/src/lib/publicProfile');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getPublicProfile', () => {
  test('(a) unknown handle → null', async () => {
    profileFindFirst.mockResolvedValue(undefined);
    const { getPublicProfile } = await load();
    expect(await getPublicProfile('nobody')).toBeNull();
    // no progress lookup when there is no profile
    expect(progressFindFirst).not.toHaveBeenCalled();
  });

  test('(b) private profile → null', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'priv',
      isPublic: false,
      displayName: 'Priv',
      style: 'salon',
    });
    const { getPublicProfile } = await load();
    expect(await getPublicProfile('priv')).toBeNull();
  });

  test('(c) public profile → PublicProfile with mastered from the progress row', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'ana',
      isPublic: true,
      displayName: 'Ana',
      style: 'nuevo',
    });
    progressFindFirst.mockResolvedValue({
      userId: 'u1',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });

    const { getPublicProfile } = await load();
    // handle is normalized (lower/trim) before lookup
    const result = await getPublicProfile('  ANA  ');

    expect(result).toEqual({
      handle: 'ana',
      displayName: 'Ana',
      style: 'nuevo',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });
    // mastered equals exactly the mocked progress row's mastered
    expect(result?.mastered).toEqual(['mirada-cabeceo', 'posture', 'embrace']);
  });

  test('(c2) public profile with no progress row → mastered defaults to []', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u2',
      handle: 'bob',
      isPublic: true,
      displayName: null,
      style: null,
    });
    progressFindFirst.mockResolvedValue(undefined);

    const { getPublicProfile } = await load();
    const result = await getPublicProfile('bob');
    expect(result).toEqual({ handle: 'bob', displayName: null, style: null, mastered: [] });
  });

  test('(d) masteredCount on the result is correct', async () => {
    profileFindFirst.mockResolvedValue({
      userId: 'u1',
      handle: 'ana',
      isPublic: true,
      displayName: 'Ana',
      style: 'nuevo',
    });
    progressFindFirst.mockResolvedValue({
      userId: 'u1',
      mastered: ['mirada-cabeceo', 'posture', 'embrace'],
    });

    const { getPublicProfile } = await load();
    const { masteredCount } = await import('@/src/lib/progress');
    const result = await getPublicProfile('ana');

    expect(result).not.toBeNull();
    expect(masteredCount(result!.mastered)).toBe(3);
  });
});
