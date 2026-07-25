'use client';

// The preset library: a client panel below the seed pickers in Settings → Theme.
// Lists a dancer's saved theme presets (≤5), each row painted in its OWN colours
// (self-preview via presetStyleVars → inline --tm-* vars), and offers Save / Apply /
// Rename / Share / Delete. The ACTIVE theme still lives in profile.customTheme; the
// server API (app/api/presets/*) is authoritative, this component is a thin,
// resilient shell over it — every fetch is guarded so an API error never breaks the
// editor. Applying a preset ALSO runs applyCustomTheme locally so the live app
// re-themes flash-free, and pushCustomTheme mirrors it across devices.

import React, { useEffect, useId, useState } from 'react';
import type { Theme } from '@/src/lib/theme';
import type { ThemePreset } from '@/src/lib/types';
import { PRESET_CAP, canSavePreset, presetStyleVars } from '@/src/lib/presets';
import { applyCustomTheme } from '@/src/lib/customTheme';
import { pushCustomTheme } from '@/src/lib/themeSync';

type Props = {
  /** The current active theme seeds — the source for "Save current as preset". */
  initialActive: Theme | null;
  /** Whether the dancer's profile is public — gates the Share affordance. */
  isPublic: boolean;
  /** The dancer's handle — sharing needs a public profile WITH a handle. */
  handle: string | null;
};

const SHARE_HINT = 'Make your profile public (with a handle) to share this theme';

/** Whether two seed sets are the same theme (canonical `#rrggbb`, so string-equal). */
function sameSeeds(a: Theme | null, b: Theme | null): boolean {
  return (
    !!a && !!b &&
    a.ground === b.ground && a.ink === b.ink &&
    a.accent === b.accent && a.accent2 === b.accent2
  );
}

/** Turn a canSavePreset failure reason into the sentence shown under the Save button. */
function saveReasonText(reason: 'cap' | 'duplicate' | 'name'): string {
  if (reason === 'cap') return `You've saved ${PRESET_CAP} — rename or delete one`;
  if (reason === 'duplicate') return 'You already have a preset with that name';
  return '2–24 characters';
}

export default function PresetLibrary({ initialActive, isPublic, handle }: Props): React.JSX.Element {
  const [list, setList] = useState<ThemePreset[]>([]);
  // The active theme drives the "Active" badge. Seeded from initialActive and kept
  // in sync with it (below), so a theme change from the EDITOR (Apply/Reset moves the
  // prop) re-points the badge; the library's own Apply also sets it directly so the
  // badge lands before the parent hears about the change.
  const [activeSeeds, setActiveSeeds] = useState<Theme | null>(initialActive);

  // Save-as-preset row.
  const [name, setName] = useState('');
  const saveHintId = useId();

  // Per-row transient UI state (only ever one row at a time).
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [shareHintId, setShareHintId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // On mount, load the server-authoritative library.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/presets', { method: 'GET' });
        if (!res.ok) return;
        const data = (await res.json()) as ThemePreset[];
        if (alive && Array.isArray(data)) setList(data);
      } catch {
        /* offline / signed-out / malformed — keep the empty list, stay usable */
      }
    })();
    return () => { alive = false; };
  }, []);

  // Follow the active theme when it changes from OUTSIDE the library (the editor's
  // Apply/Reset move the initialActive prop). The library's own Apply updates
  // activeSeeds directly without moving the prop, so this never clobbers it.
  useEffect(() => {
    setActiveSeeds(initialActive);
  }, [initialActive]);

  const canShare = isPublic && !!handle;

  // Save gate: null active → nothing to save; otherwise run the pure cap/name check.
  let saveHint: string | null = null;
  if (!initialActive) {
    saveHint = 'Apply a theme first, then save it as a preset.';
  } else {
    const check = canSavePreset(list.map((p) => p.name), name);
    if (!check.ok) saveHint = saveReasonText(check.reason);
  }
  const saveDisabled = saveHint !== null;

  async function onSave(): Promise<void> {
    setConfirmDeleteId(null);
    if (saveDisabled || !initialActive) return;
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, seeds: initialActive }),
      });
      if (!res.ok) return;
      const dto = (await res.json()) as ThemePreset;
      if (dto && dto.id) {
        setList((cur) => [dto, ...cur]);
        setName('');
      }
    } catch {
      /* best-effort — leave the input as-is so the user can retry */
    }
  }

  async function onApply(p: ThemePreset): Promise<void> {
    setConfirmDeleteId(null);
    // Local, flash-free apply first so the live app re-themes instantly.
    applyCustomTheme(p.seeds);
    setActiveSeeds(p.seeds);
    void pushCustomTheme();
    try {
      await fetch(`/api/presets/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ setActive: true }),
      });
    } catch {
      /* server copy will reconcile on next sync — the local apply already landed */
    }
  }

  function startRename(p: ThemePreset): void {
    setConfirmDeleteId(null);
    setRenamingId(p.id);
    setRenameValue(p.name);
    setRenameError(null);
  }

  async function submitRename(p: ThemePreset): Promise<void> {
    const next = renameValue;
    try {
      const res = await fetch(`/api/presets/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      if (res.status === 409) {
        setRenameError('You already have a preset with that name');
        return;
      }
      if (res.status === 400) {
        setRenameError('2–24 characters');
        return;
      }
      if (!res.ok) return;
      setList((cur) => cur.map((x) => (x.id === p.id ? { ...x, name: next.replace(/\s+/g, ' ').trim() } : x)));
      setRenamingId(null);
      setRenameError(null);
    } catch {
      /* leave the inline editor open so the user can retry */
    }
  }

  async function onShare(p: ThemePreset): Promise<void> {
    setConfirmDeleteId(null);
    // Pre-explain the requirement before the API would 409.
    if (!canShare) {
      setShareHintId(p.id);
      return;
    }
    try {
      const res = await fetch(`/api/presets/${p.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isShared: true }),
      });
      if (res.status === 409) {
        setShareHintId(p.id);
        return;
      }
      if (!res.ok) return;
      // 0-or-1 shared per user: this one is now the shared one.
      setShareHintId(null);
      setList((cur) => cur.map((x) => ({ ...x, isShared: x.id === p.id })));
    } catch {
      /* best-effort */
    }
  }

  async function onDelete(p: ThemePreset): Promise<void> {
    if (confirmDeleteId !== p.id) {
      setConfirmDeleteId(p.id);
      return;
    }
    try {
      const res = await fetch(`/api/presets/${p.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) return;
      setList((cur) => cur.filter((x) => x.id !== p.id));
      setConfirmDeleteId(null);
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="tm-preset-library">
      <div className="tm-preset-save">
        <input
          type="text"
          aria-label="preset name"
          className="tm-preset-name-input"
          placeholder="Name this theme"
          spellCheck={false}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="tm-save"
          disabled={saveDisabled}
          aria-describedby={saveHint ? saveHintId : undefined}
          onClick={() => void onSave()}
        >
          Save
        </button>
      </div>
      {saveHint && <p id={saveHintId} className="tm-preset-hint" role="status">{saveHint}</p>}

      {list.length > 0 && (
        <ul className="tm-preset-list">
          {list.map((p) => {
            const isActive = sameSeeds(activeSeeds, p.seeds);
            const renaming = renamingId === p.id;
            return (
              <li
                key={p.id}
                className="tm-preset-row"
                style={presetStyleVars(p.seeds) as React.CSSProperties}
              >
                <span className="chip" aria-hidden="true" />
                {renaming ? (
                  <input
                    type="text"
                    aria-label={`rename ${p.name}`}
                    className="tm-preset-name-input"
                    value={renameValue}
                    spellCheck={false}
                    maxLength={40}
                    autoFocus
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitRename(p);
                      if (e.key === 'Escape') { setRenamingId(null); setRenameError(null); }
                    }}
                  />
                ) : (
                  <span className="name">{p.name}</span>
                )}

                {isActive && <span className="badge">Active</span>}
                {p.isShared && <span className="badge">Shared</span>}

                <div className="tm-preset-actions">
                  {renaming ? (
                    <>
                      <button type="button" onClick={() => void submitRename(p)}>Save name</button>
                      <button type="button" onClick={() => { setRenamingId(null); setRenameError(null); }}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => void onApply(p)}>Apply</button>
                      <button type="button" onClick={() => startRename(p)}>Rename</button>
                      <button type="button" onClick={() => void onShare(p)}>Share</button>
                      <button type="button" onClick={() => void onDelete(p)}>
                        {confirmDeleteId === p.id ? 'Confirm' : 'Delete'}
                      </button>
                    </>
                  )}
                </div>

                {renaming && renameError && (
                  <p className="tm-preset-rowhint" role="alert">{renameError}</p>
                )}
                {shareHintId === p.id && (
                  <p className="tm-preset-rowhint" role="status">{SHARE_HINT}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
