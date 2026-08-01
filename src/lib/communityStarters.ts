// Curated starter themes for the community gallery. These are the first three cards a
// dancer sees before any real dancer has shared one — so the gallery is never empty,
// and there is always something tasteful to apply on day one. They are prepended to
// the live shared themes in getCommunityThemes.
//
// PROJECT-RULE NOTE: the hex strings below are DATA, not styling — each `seeds` block
// is a Theme (four colour seeds the engine expands into the full --tm-* palette), the
// same shape a user authors in the editor. They are the ONLY literal colours allowed
// outside design/tokens.ts, exactly like the seed hexes in ThemeEditor's PRESETS.
//
// Every `seeds` set MUST pass parseTheme (a test enforces it): ink/ground ≥ 4.5 and
// each accent/ground ≥ 3, all canonical lowercase `#rrggbb`. Tuned until green.

import type { CommunityTheme } from '@/src/lib/types';

export const STARTER_COMMUNITY_THEMES: CommunityTheme[] = [
  {
    // Cool dark — deep navy ground, cyan-blue and teal accents.
    id: 'starter:midnight',
    name: 'Midnight',
    seeds: { v: 1, ground: '#0f1524', ink: '#e8edf7', accent: '#5aa9f0', accent2: '#54d3ac' },
    authorHandle: 'tangomap',
    authorDisplayName: 'Tango Map',
  },
  {
    // Warm dark rose — near-black plum ground, rose and warm-gold accents.
    id: 'starter:carmesi',
    name: 'Carmesí',
    seeds: { v: 1, ground: '#1e1013', ink: '#f4e4e0', accent: '#e86a86', accent2: '#d9a441' },
    authorHandle: 'tangomap',
    authorDisplayName: 'Tango Map',
  },
  {
    // Light — warm paper ground, terracotta and sage accents.
    id: 'starter:sereno',
    name: 'Sereno',
    seeds: { v: 1, ground: '#f3efe6', ink: '#2a2622', accent: '#b0552c', accent2: '#4f7a5a' },
    authorHandle: 'tangomap',
    authorDisplayName: 'Tango Map',
  },
];
