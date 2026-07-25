export type Theme = 'light' | 'dark';
export type Style = 'salon' | 'milonguero' | 'nuevo';

export type Progress = {
  mastered: string[];
  theme: Theme | null;
  sel: string | null;
  updatedAt: string;
};
export type ProgressInput = { mastered: string[]; theme: Theme | null; sel: string | null };

export type ProfileDTO = {
  handle: string | null;
  isPublic: boolean;
  displayName: string | null;
  style: Style | null;
};
export type ProfileInput = Partial<ProfileDTO>;

export type PublicProfile = {
  handle: string;
  displayName: string | null;
  style: Style | null;
  mastered: string[];
};
