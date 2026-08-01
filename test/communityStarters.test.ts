import { describe, test, expect } from 'vitest';
import { STARTER_COMMUNITY_THEMES } from '@/src/lib/communityStarters';
import { parseTheme } from '@/src/lib/theme';
import type { CommunityTheme } from '@/src/lib/types';

describe('STARTER_COMMUNITY_THEMES', () => {
  test('ships exactly three curated starters', () => {
    expect(STARTER_COMMUNITY_THEMES).toHaveLength(3);
  });

  test('every starter seed set passes parseTheme (legible: ink/ground ≥ 4.5, accents ≥ 3)', () => {
    for (const t of STARTER_COMMUNITY_THEMES) {
      const parsed = parseTheme(t.seeds);
      expect(parsed, `${t.name} seeds must clear the legibility floor`).not.toBeNull();
      // The stored seeds are already canonical (lowercase #rrggbb), so parseTheme is a no-op.
      expect(parsed).toEqual(t.seeds);
    }
  });

  test('ids are unique and all carry the `starter:` prefix', () => {
    const ids = STARTER_COMMUNITY_THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.startsWith('starter:')).toBe(true);
  });

  test('each starter is shaped as a CommunityTheme authored by Tango Map', () => {
    for (const t of STARTER_COMMUNITY_THEMES) {
      // Compile-time + runtime shape: exactly the CommunityTheme keys, nothing private.
      const shaped: CommunityTheme = t;
      expect(Object.keys(shaped).sort()).toEqual(
        ['authorDisplayName', 'authorHandle', 'id', 'name', 'seeds'].sort(),
      );
      expect(typeof t.name).toBe('string');
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.authorHandle).toBe('tangomap');
      expect(t.authorDisplayName).toBe('Tango Map');
      expect(t.seeds.v).toBe(1);
    }
  });

  test('names are the three distinct curated moods', () => {
    expect(STARTER_COMMUNITY_THEMES.map((t) => t.name)).toEqual(['Midnight', 'Carmesí', 'Sereno']);
  });
});
