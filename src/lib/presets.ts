import { deriveTokens, type Theme } from '@/src/lib/theme';
import { cssVar } from '@/design/tokens';

export const PRESET_CAP = 5;

/** Collapse internal whitespace + trim; the stored/display form. */
export function sanitizePresetName(raw: string): string {
  return String(raw).replace(/\s+/g, ' ').trim();
}
/** 2–24 visible characters after sanitising. */
export function isValidPresetName(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const n = sanitizePresetName(raw);
  return n.length >= 2 && n.length <= 24;
}

export type SaveCheck = { ok: true } | { ok: false; reason: 'cap' | 'duplicate' | 'name' };
/** Gate a new save against the cap and case-insensitive name collisions. */
export function canSavePreset(existingNames: string[], name: string): SaveCheck {
  if (!isValidPresetName(name)) return { ok: false, reason: 'name' };
  if (existingNames.length >= PRESET_CAP) return { ok: false, reason: 'cap' };
  const lc = sanitizePresetName(name).toLowerCase();
  if (existingNames.some((n) => sanitizePresetName(n).toLowerCase() === lc)) {
    return { ok: false, reason: 'duplicate' };
  }
  return { ok: true };
}

/** Inline CSS custom properties that paint a control in a preset's OWN colors —
 *  the "self-preview". Same mapping the editor live-preview and customStyleText use. */
export function presetStyleVars(theme: Theme): Record<string, string> {
  const t = deriveTokens(theme);
  const out: Record<string, string> = {};
  for (const k of Object.keys(t) as (keyof typeof t)[]) out[cssVar(k)] = t[k];
  return out;
}
