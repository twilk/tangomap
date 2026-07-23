'use client';

import React, { useState } from 'react';
import type { ProfileDTO, Style } from '@/src/lib/types';

const STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'No style set' },
  { value: 'salon', label: 'Salón' },
  { value: 'milonguero', label: 'Milonguero' },
  { value: 'nuevo', label: 'Nuevo' },
];

export default function SettingsForm({ initial }: { initial: ProfileDTO }) {
  const [state, setState] = useState<ProfileDTO>(initial);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaved(false);
    setHandleError(null);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (res.status === 200) {
        const dto = (await res.json()) as ProfileDTO;
        setState(dto);
        setSaved(true);
      } else if (res.status === 409) {
        setHandleError('Handle already taken');
      } else if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setHandleError(
          body.error === 'handle_required'
            ? 'Pick a handle before going public'
            : 'That handle isn’t valid — use 3–30 letters, numbers or hyphens',
        );
      } else {
        setError('Could not save changes');
      }
    } catch {
      setError('Could not save changes');
    } finally {
      setSaving(false);
    }
  }

  const showPublicUrl = state.isPublic && !!state.handle;

  return (
    <form className="tm-form" onSubmit={(e) => e.preventDefault()}>
      <div className="tm-row2">
        <label className="tm-field">
          <span>Display name</span>
          <span className="tm-inp">
            <input
              type="text"
              name="displayName"
              aria-label="displayName"
              autoComplete="off"
              placeholder="Your name…"
              value={state.displayName ?? ''}
              onChange={(e) =>
                setState((s) => ({ ...s, displayName: e.target.value === '' ? null : e.target.value }))
              }
            />
          </span>
        </label>

        <label className="tm-field">
          <span>Handle</span>
          <span className="tm-inp">
            <span className="pre" aria-hidden="true">@</span>
            <input
              type="text"
              name="handle"
              aria-label="handle"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              placeholder="your-handle…"
              value={state.handle ?? ''}
              onChange={(e) =>
                setState((s) => ({ ...s, handle: e.target.value === '' ? null : e.target.value }))
              }
            />
          </span>
        </label>
      </div>
      {handleError ? (
        <span className="tm-alert" role="alert" aria-label="handleError">
          {handleError}
        </span>
      ) : null}

      <label className="tm-field">
        <span>Style</span>
        <select
          className="tm-select"
          name="style"
          aria-label="style"
          value={state.style ?? ''}
          onChange={(e) =>
            setState((s) => ({ ...s, style: e.target.value === '' ? null : (e.target.value as Style) }))
          }
        >
          {STYLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="tm-toggle">
        <input
          type="checkbox"
          name="isPublic"
          aria-label="isPublic"
          checked={state.isPublic}
          onChange={(e) => setState((s) => ({ ...s, isPublic: e.target.checked }))}
        />
        <span className="tm-sw2" aria-hidden="true" />
        <span className="tm-tx">
          <span className="a">
            {state.isPublic ? <span className="tm-pulse" aria-hidden="true" /> : null}
            Public profile —{' '}
            {state.isPublic ? <span className="on-txt">On</span> : <span className="off-txt">Off</span>}
          </span>
          <span className="b">Anyone with the link sees your DNA &amp; progress. Off by default.</span>
        </span>
      </label>

      {showPublicUrl ? (
        <p className="tm-hint">
          Live at <a className="tm-publink" href={`/u/${state.handle}`}>partykamap.vercel.app/u/{state.handle}</a> · turn the
          switch off and the page 404s instantly.
        </p>
      ) : null}

      <button className="tm-save" type="button" onClick={onSave} disabled={saving}>
        Save
      </button>

      {saved ? (
        <p className="tm-ok" role="status">
          <span aria-hidden="true">✓</span> Saved
        </p>
      ) : null}
      {error ? (
        <p className="tm-alert" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
