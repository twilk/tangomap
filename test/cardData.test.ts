import { describe, test, expect, beforeEach, vi } from 'vitest';

// --- Mock @/db for getCardData: profile + progress + progressHistory lookups ---
const profileFindFirst = vi.fn();
const progressFindFirst = vi.fn();
const historyFindFirst = vi.fn();

vi.mock('@/db', () => ({
  db: {
    query: {
      profile: { findFirst: (...args: unknown[]) => profileFindFirst(...args) },
      progress: { findFirst: (...args: unknown[]) => progressFindFirst(...args) },
      progressHistory: { findFirst: (...args: unknown[]) => historyFindFirst(...args) },
    },
  },
}));

async function load() {
  return import('@/src/lib/publicProfile');
}

const publicRow = {
  userId: 'u1',
  handle: 'ana',
  isPublic: true,
  displayName: 'Ana',
  style: 'salon',
  createdAt: new Date('2026-03-05T12:00:00Z'),
  cardSerial: 42,
};

beforeEach(() => {
  vi.clearAllMocks();
  progressFindFirst.mockResolvedValue({ userId: 'u1', mastered: ['mirada-cabeceo'] });
  historyFindFirst.mockResolvedValue(undefined);
});

describe('getCardData', () => {
  test('unknown or private handle → null, no further queries', async () => {
    profileFindFirst.mockResolvedValue(undefined);
    const { getCardData } = await load();
    expect(await getCardData('nobody')).toBeNull();

    profileFindFirst.mockResolvedValue({ ...publicRow, isPublic: false });
    expect(await getCardData('ana')).toBeNull();
    expect(progressFindFirst).not.toHaveBeenCalled();
    expect(historyFindFirst).not.toHaveBeenCalled();
  });

  test('serial comes from the minted cardSerial column, mintedYear from createdAt', async () => {
    profileFindFirst.mockResolvedValue(publicRow);
    const { getCardData } = await load();
    const data = await getCardData('ana');
    expect(data?.serial).toBe(42);
    expect(data?.mintedYear).toBe(2026);
  });

  test('a row that missed the backfill reports serial 0, never a live count', async () => {
    profileFindFirst.mockResolvedValue({ ...publicRow, cardSerial: null });
    const { getCardData } = await load();
    const data = await getCardData('ana');
    expect(data?.serial).toBe(0);
  });

  test('ghostMastered surfaces the snapshot row and defaults to null', async () => {
    profileFindFirst.mockResolvedValue(publicRow);
    historyFindFirst.mockResolvedValue({ userId: 'u1', day: '2026-06-01', mastered: ['posture'] });
    const { getCardData } = await load();
    expect((await getCardData('ana'))?.ghostMastered).toEqual(['posture']);

    historyFindFirst.mockResolvedValue(undefined);
    expect((await getCardData('ana'))?.ghostMastered).toBeNull();
  });
});
