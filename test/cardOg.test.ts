import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { CardData } from '@/src/lib/publicProfile';

// Mock next/og so no real PNG rendering happens; capture (el, opts).
vi.mock('next/og', () => ({
  ImageResponse: class {
    el: unknown;
    opts: { width: number; height: number };
    constructor(el: unknown, opts: { width: number; height: number }) {
      this.el = el;
      this.opts = opts;
    }
  },
}));

vi.mock('@/src/lib/publicProfile', () => ({ getCardData: vi.fn() }));

import { getCardData } from '@/src/lib/publicProfile';

const mockedGet = vi.mocked(getCardData);

async function load() {
  return import('@/app/u/[handle]/card/opengraph-image');
}

const card: CardData = {
  handle: 'ana',
  displayName: 'Ana',
  style: 'salon',
  mastered: ['mirada-cabeceo'],
  serial: 7,
  mintedYear: 2026,
  ghostMastered: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('card opengraph-image route', () => {
  test('exports size and contentType metadata', async () => {
    const mod = await load();
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
  });

  test('renders an ImageResponse containing the padded serial', async () => {
    mockedGet.mockResolvedValue(card);
    const mod = await load();
    const res = (await mod.default({ params: Promise.resolve({ handle: 'ana' }) })) as unknown as { el: unknown; opts: { width: number } };
    expect(res.opts.width).toBe(1200);
    // JSX children are split segments — assert the padded serial and year pieces.
    const html = JSON.stringify(res.el);
    expect(html).toContain('"0007"');
    expect(html).toContain('2026');
    expect(mockedGet).toHaveBeenCalledWith('ana');
  });

  test('clamps very long display names with an ellipsis', async () => {
    mockedGet.mockResolvedValue({ ...card, displayName: 'A'.repeat(60) });
    const mod = await load();
    const res = (await mod.default({ params: Promise.resolve({ handle: 'ana' }) })) as unknown as { el: unknown };
    const html = JSON.stringify(res.el);
    expect(html).toContain('…');
    expect(html).not.toContain('A'.repeat(30));
  });

  test('falls back to a generic image when the card is missing', async () => {
    mockedGet.mockResolvedValue(null);
    const mod = await load();
    const res = (await mod.default({ params: Promise.resolve({ handle: 'nobody' }) })) as unknown as { opts: { height: number } };
    expect(res.opts.height).toBe(630);
  });
});
