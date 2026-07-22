import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { PublicProfile } from '@/src/lib/types';

// Mock next/og so no real PNG rendering happens; capture (el, opts).
vi.mock('next/og', () => ({
  ImageResponse: class {
    el: any;
    opts: any;
    constructor(el: any, opts: any) {
      this.el = el;
      this.opts = opts;
    }
  },
}));

// Mock the public-profile lookup (owned by another agent).
vi.mock('@/src/lib/publicProfile', () => ({ getPublicProfile: vi.fn() }));

import { getPublicProfile } from '@/src/lib/publicProfile';

const mockedGet = vi.mocked(getPublicProfile);

async function load() {
  return import('@/app/u/[handle]/opengraph-image');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('opengraph-image route', () => {
  test('(a) exports size and contentType metadata', async () => {
    const mod = await load();
    expect(mod.size).toEqual({ width: 1200, height: 630 });
    expect(mod.contentType).toBe('image/png');
  });

  test('(b) renders an ImageResponse for a real profile', async () => {
    const profile: PublicProfile = {
      handle: 'ana',
      displayName: 'Ana',
      style: 'salon',
      mastered: ['mirada-cabeceo'],
    };
    mockedGet.mockResolvedValue(profile);

    const mod = await load();
    const res: any = await mod.default({ params: Promise.resolve({ handle: 'ana' }) });

    expect(res).toBeDefined();
    expect(res.opts.width).toBe(1200);
    expect(res.opts.height).toBe(630);
    expect(mockedGet).toHaveBeenCalledWith('ana');
  });

  test('(c) renders a generic ImageResponse when profile is null', async () => {
    mockedGet.mockResolvedValue(null);

    const mod = await load();
    const res: any = await mod.default({ params: Promise.resolve({ handle: 'nobody' }) });

    expect(res).toBeDefined();
    expect(res.opts.width).toBe(1200);
    expect(res.opts.height).toBe(630);
  });
});
