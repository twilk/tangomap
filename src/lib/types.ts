import type { Theme as CustomThemeStruct, Theme as ThemeSeeds } from '@/src/lib/theme';

export type Theme = 'light' | 'dark' | 'custom';
export type Style = 'salon' | 'milonguero' | 'nuevo';

export type Progress = {
  mastered: string[];
  theme: Theme | null;
  sel: string | null;
  updatedAt: string;
};
// `updatedAt` is the client's clock at the moment its local state last changed —
// the token for last-write-wins. Optional: a missing/invalid value is treated as
// "now" by the server (a client that doesn't stamp its writes always wins ties).
export type ProgressInput = { mastered: string[]; theme: Theme | null; sel: string | null; updatedAt?: string };

export type ProfileDTO = {
  handle: string | null;
  isPublic: boolean;
  displayName: string | null;
  style: Style | null;
  customTheme: CustomThemeStruct | null;
  cardUsesCustomTheme: boolean;
  themeShared: boolean;
  customThemeUpdatedAt: string | null; // ISO, or null
};
export type ProfileInput = Partial<ProfileDTO>;

export type PublicProfile = {
  handle: string;
  displayName: string | null;
  style: Style | null;
  mastered: string[];
};

export type ThemePreset = {
  id: string;
  name: string;
  seeds: ThemeSeeds;
  isShared: boolean;
  updatedAt: string; // ISO
};
export type ThemePresetInput = { name: string; seeds: ThemeSeeds };
/** Public read model for the community gallery — never any private field. */
export type CommunityTheme = {
  id: string;
  name: string;
  seeds: ThemeSeeds;
  authorHandle: string;
  authorDisplayName: string | null;
};
