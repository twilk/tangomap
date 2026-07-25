import { deriveTokens, type Theme, type DerivedTokens } from '@/src/lib/theme';
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

/** Map an ALREADY-derived token set onto its inline `--tm-*` custom properties.
 *  Lets a caller that already has `DerivedTokens` (e.g. `reconcileCompare`'s `P.a`/
 *  `P.b`) paint a self-preview without deriving a second time. */
export function tokenStyleVars(tokens: DerivedTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(tokens) as (keyof DerivedTokens)[]) out[cssVar(k)] = tokens[k];
  return out;
}

/** Inline CSS custom properties that paint a control in a preset's OWN colors —
 *  the "self-preview". Same mapping the editor live-preview and customStyleText use. */
export function presetStyleVars(theme: Theme): Record<string, string> {
  return tokenStyleVars(deriveTokens(theme));
}
