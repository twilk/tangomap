'use client';

// The community gallery: a panel below the preset library in Settings → Theme. On
// mount it pulls the public read model (GET /api/community-themes) and renders each
// shared theme as a button painted in its OWN colours (self-preview via
// presetStyleVars → inline --tm-* vars). Clicking one re-validates the seeds through
// applyCustomTheme (the client trust boundary re-parses) and, on success, applies it
// live, mirrors it across devices, and offers "Save to my library" — a direct POST to
// the preset API, subject to the same 5-cap the library enforces. Every fetch is
// guarded so an API error never breaks the editor.

import React, { useEffect, useState } from 'react';
import type { CommunityTheme } from '@/src/lib/types';
import { presetStyleVars } from '@/src/lib/presets';
import { applyCustomTheme } from '@/src/lib/customTheme';
import { pushCustomTheme } from '@/src/lib/themeSync';

/** Map a 409 from POST /api/presets into the sentence shown under "Save to my library". */
function saveErrorText(error: unknown): string {
  if (error === 'cap') return "You've saved 5 — rename or delete one in your library first";
  if (error === 'duplicate') return 'That name is already in your library';
  return "Couldn't save — try again";
}

/** Attribution line for a gallery card. The official curator (`tangomap`) is a brand,
 *  not a dancer, so it shows the brand name "Tango Map" with no `@`; every real dancer
 *  shows their `@handle`. */
function authorLabel(t: CommunityTheme): string {
  if (t.authorHandle === 'tangomap') return 'by Tango Map';
  return `by @${t.authorHandle}`;
}

/** Onboarding nudge: focus the preset-save input in the sibling PresetLibrary so a
 *  first-time contributor lands on the "name this theme / Save" control. Best-effort and
 *  DOM-only (the two panels are siblings under ThemeEditor); a no-op if the library
 *  isn't mounted. */
function focusShareControl(): void {
  const input = document.querySelector<HTMLInputElement>('.tm-preset-save .tm-preset-name-input');
  if (!input) return;
  try {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    /* jsdom / environments without scrollIntoView — focusing alone still helps */
  }
  input.focus();
}

export default function CommunityThemes(): React.JSX.Element | null {
  const [themes, setThemes] = useState<CommunityTheme[]>([]);
  // Only ever one row is "active" at a time in the panel's transient UI.
  const [appliedId, setAppliedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<{ id: string; text: string } | null>(null);

  // On mount, load the public gallery. Signed-out / offline / malformed → empty list.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/community-themes', { method: 'GET' });
        if (!res.ok) return;
        const data = (await res.json()) as CommunityTheme[];
        if (alive && Array.isArray(data)) setThemes(data);
      } catch {
        /* offline / malformed — keep the empty list, stay usable */
      }
    })();
    return () => { alive = false; };
  }, []);

  function onApply(t: CommunityTheme): void {
    setSaveMsg(null);
    // Defence in depth: the read model already validated, but re-parse on apply.
    if (!applyCustomTheme(t.seeds)) {
      setFailedId(t.id);
      setAppliedId(null);
      return;
    }
    setFailedId(null);
    setAppliedId(t.id);
    // Mirror to the server so the applied theme follows the user across devices.
    void pushCustomTheme();
  }

  async function onSaveToLibrary(t: CommunityTheme): Promise<void> {
    try {
      const res = await fetch('/api/presets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: t.name, seeds: t.seeds }),
      });
      if (res.ok) {
        setSaveMsg({ id: t.id, text: 'Saved to your library' });
        return;
      }
      const payload = await res.json().catch(() => ({}));
      setSaveMsg({ id: t.id, text: saveErrorText((payload as { error?: unknown }).error) });
    } catch {
      setSaveMsg({ id: t.id, text: "Couldn't save — try again" });
    }
  }

  if (themes.length === 0) return null;

  return (
    <section className="tm-community">
      <div className="tm-community-head">
        <h3 className="tm-community-h">Community themes</h3>
        <p className="tm-community-intro">Apply a theme someone shared — or add your own to the gallery.</p>
        <button type="button" className="tm-community-cta" onClick={focusShareControl}>
          Share your first theme <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="tm-community-grid">
        {themes.map((t) => (
          <div key={t.id} className="tm-community-item">
            <button
              type="button"
              className="tm-community-btn"
              style={presetStyleVars(t.seeds) as React.CSSProperties}
              onClick={() => onApply(t)}
            >
              <span className="name">{t.name}</span>
              <span className="by">{authorLabel(t)}</span>
            </button>

            {failedId === t.id && (
              <p className="tm-community-note" role="alert">Couldn&rsquo;t apply this theme.</p>
            )}

            {appliedId === t.id && (
              <div className="tm-community-save">
                <button type="button" onClick={() => void onSaveToLibrary(t)}>
                  Save to my library
                </button>
                {saveMsg?.id === t.id && (
                  <p className="tm-community-note" role="status">{saveMsg.text}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
