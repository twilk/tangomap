'use client';

// A pure client-side custom-theme editor: four colour seeds → live contrast
// feedback + a token-accurate preview → Apply (the whole app re-themes via
// data-theme="custom") → Reset. Everything runs through the existing engine
// (src/lib/theme, src/lib/customTheme); there is no server call and no schema.

import React, { useEffect, useState } from 'react';
import { parseTheme, deriveTokens, AA_CONTRAST, AA_UI_CONTRAST, type Theme } from '@/src/lib/theme';
import type { ThemeTokens } from '@/design/tokens';
import { cssVar } from '@/design/tokens';
import { parseHex, contrastRatio } from '@/src/lib/color';
import { applyCustomTheme, clearCustomTheme, currentCustomTheme, readMode } from '@/src/lib/customTheme';
import { pushCustomTheme } from '@/src/lib/themeSync';
import PresetLibrary from '@/src/components/PresetLibrary';
import CommunityThemes from '@/src/components/CommunityThemes';

/** Share-gate context threaded from the Settings page (the profile row it already
 *  loads). The library pre-explains the public-profile requirement before the API 409. */
export type ThemeEditorProps = { isPublic?: boolean; handle?: string | null };

/** The four colour seeds a theme is built from — each a `#rrggbb` string the user edits. */
export type Seeds = { ground: string; ink: string; accent: string; accent2: string };

/** Starting points. Every preset's `{v:1,...seeds}` MUST pass parseTheme (a test enforces
 *  this): ink/ground ≥ 4.5 and each accent/ground ≥ 3. Tuned until green. */
export const PRESETS: ReadonlyArray<{ name: string; seeds: Seeds }> = [
  { name: 'Warm dark', seeds: { ground: '#1a1410', ink: '#f2e8d8', accent: '#e58c44', accent2: '#a8ba8a' } },
  { name: 'Cool dark', seeds: { ground: '#0f1419', ink: '#e6edf3', accent: '#58a6ff', accent2: '#7ee2b8' } },
  { name: 'Warm light', seeds: { ground: '#f5ead8', ink: '#201e1d', accent: '#b5642c', accent2: '#5f7048' } },
];

const DEFAULT: Seeds = PRESETS[0].seeds;

const SEED_LABELS: Record<keyof Seeds, string> = {
  ground: 'Background',
  ink: 'Text',
  accent: 'Accent',
  accent2: 'Second accent',
};

const SEED_ORDER: Array<keyof Seeds> = ['ground', 'ink', 'accent', 'accent2'];

/** Contrast ratio of two hex strings, or null if either is not a parseable colour. */
function ratioOf(fg: string, bg: string): number | null {
  const a = parseHex(fg);
  const b = parseHex(bg);
  return a && b ? contrastRatio(a, b) : null;
}

export default function ThemeEditor({ isPublic = false, handle = null }: ThemeEditorProps): React.JSX.Element {
  const [seeds, setSeeds] = useState<Seeds>(DEFAULT);
  const [applied, setApplied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Effect-backed so SSR/first render never diverge from the server markup:
  // false on the server and on first client paint, then set once mounted.
  const [hasCustom, setHasCustom] = useState(false);
  // The active theme + a mounted flag, both effect-backed for the same no-flash
  // reason: the preset library only renders (and only learns the active seeds) on
  // the client, so its markup can never diverge from the server's.
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = currentCustomTheme();
    if (t) {
      setSeeds({ ground: t.ground, ink: t.ink, accent: t.accent, accent2: t.accent2 });
    }
    if (t !== null || readMode() === 'custom') setHasCustom(true);
    setActiveTheme(t);
    setMounted(true);
  }, []);

  // Derived fresh each render — the single source of truth for validity + feedback.
  const candidate = parseTheme({ v: 1, ...seeds });
  const valid = candidate !== null;

  const inkR = ratioOf(seeds.ink, seeds.ground);
  const accentR = ratioOf(seeds.accent, seeds.ground);
  const accent2R = ratioOf(seeds.accent2, seeds.ground);

  const previewVars: React.CSSProperties | null = candidate
    ? (() => {
        const tokens = deriveTokens(candidate);
        const vars: Record<string, string> = {};
        (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach((k) => {
          vars[cssVar(k)] = tokens[k];
        });
        return vars as React.CSSProperties;
      })()
    : null;

  const anyUnparseable =
    parseHex(seeds.ground) === null ||
    parseHex(seeds.ink) === null ||
    parseHex(seeds.accent) === null ||
    parseHex(seeds.accent2) === null;

  const warnings: string[] = [];
  if (anyUnparseable) {
    warnings.push('Enter a valid hex colour (like #1b1327) for every swatch.');
  }
  if (inkR != null && inkR < AA_CONTRAST) {
    warnings.push(`Text on background is ${inkR.toFixed(1)}:1 — needs ${AA_CONTRAST}:1 to stay readable.`);
  }
  if (accentR != null && accentR < AA_UI_CONTRAST) {
    warnings.push(`Accent on background is ${accentR.toFixed(1)}:1 — needs ${AA_UI_CONTRAST}:1 to stay visible.`);
  }
  if (accent2R != null && accent2R < AA_UI_CONTRAST) {
    warnings.push(`Second accent on background is ${accent2R.toFixed(1)}:1 — needs ${AA_UI_CONTRAST}:1 to stay visible.`);
  }

  function onSeed(key: keyof Seeds, value: string): void {
    setSeeds((s) => ({ ...s, [key]: value }));
    setApplied(false);
    setConfirming(false);
  }

  function onApply(): void {
    if (candidate && applyCustomTheme(candidate)) {
      setApplied(true);
      setHasCustom(true);
      // Keep the library's "Save current as preset" gate in step with the live theme.
      setActiveTheme(candidate);
      // Mirror to the server so the theme follows the user across devices.
      void pushCustomTheme();
    }
  }

  function onReset(): void {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    clearCustomTheme();
    setSeeds(DEFAULT);
    setApplied(false);
    setConfirming(false);
    setHasCustom(false);
    setActiveTheme(null);
    // Propagate the cleared state so other devices drop the theme too.
    void pushCustomTheme();
  }

  return (
    <div className="tm-theme-editor">
      <div className="tm-presets">
        {PRESETS.map((p) => (
          <button
            key={p.name}
            type="button"
            className="tm-preset"
            onClick={() => {
              setSeeds(p.seeds);
              setApplied(false);
              setConfirming(false);
            }}
          >
            {p.name}
          </button>
        ))}
      </div>

      <div className="tm-seedgrid">
        {SEED_ORDER.map((key) => {
          const raw = seeds[key];
          const colorValue = parseHex(raw) ? raw : '#000000';
          return (
            <label className="tm-seed" key={key}>
              <span>{SEED_LABELS[key]}</span>
              <div className="row">
                <input
                  type="color"
                  aria-label={SEED_LABELS[key]}
                  value={colorValue}
                  onChange={(e) => onSeed(key, e.target.value)}
                />
                <input
                  type="text"
                  aria-label={`${SEED_LABELS[key]} hex`}
                  spellCheck={false}
                  autoCapitalize="none"
                  value={raw}
                  onChange={(e) => onSeed(key, e.target.value)}
                />
              </div>
            </label>
          );
        })}
      </div>

      {valid ? (
        <div className="tm-profile tm-tp" style={previewVars ?? undefined}>
          <h4>Aa — your theme, live</h4>
          <p className="m">Muted body text stays readable on your background.</p>
          <div className="panel">A raised panel, the way cards and strips look.</div>
          <div className="row">
            <button type="button" className="btn" tabIndex={-1}>
              Primary
            </button>
            <span className="chip">accent</span>
          </div>
        </div>
      ) : (
        <p className="tm-tp-empty">Fix the contrast issues below to preview your theme.</p>
      )}

      {warnings.length > 0 && (
        <div className="tm-warn" role="alert">
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="tm-actions">
        <button type="button" className="tm-save" disabled={!valid} onClick={onApply}>
          Apply
        </button>
        {applied && (
          <p className="tm-ok" role="status">
            ✓ Applied — your theme is live across the app.
          </p>
        )}
      </div>

      {hasCustom && (
        <div className="tm-reset-row">
          <button
            type="button"
            className={confirming ? 'tm-reset confirm' : 'tm-reset'}
            onClick={onReset}
          >
            {confirming ? 'Click again to clear your custom theme' : 'Reset to default theme'}
          </button>
        </div>
      )}

      {mounted && (
        <>
          <PresetLibrary initialActive={activeTheme} isPublic={isPublic} handle={handle} />
          <CommunityThemes />
        </>
      )}
    </div>
  );
}
