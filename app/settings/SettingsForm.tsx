'use client';

import React, { useState } from 'react';
import type { ProfileDTO, Style } from '@/src/lib/types';

const STYLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'none' },
  { value: 'salon', label: 'salon' },
  { value: 'milonguero', label: 'milonguero' },
  { value: 'nuevo', label: 'nuevo' },
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
    <form onSubmit={(e) => e.preventDefault()}>
      <label>
        Display name
        <input
          type="text"
          name="displayName"
          aria-label="displayName"
          value={state.displayName ?? ''}
          onChange={(e) =>
            setState((s) => ({ ...s, displayName: e.target.value === '' ? null : e.target.value }))
          }
        />
      </label>

      <label>
        Handle
        <input
          type="text"
          name="handle"
          aria-label="handle"
          value={state.handle ?? ''}
          onChange={(e) =>
            setState((s) => ({ ...s, handle: e.target.value === '' ? null : e.target.value }))
          }
        />
      </label>
      {handleError ? (
        <span role="alert" aria-label="handleError">
          {handleError}
        </span>
      ) : null}

      <label>
        Style
        <select
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

      <label>
        Public profile
        <input
          type="checkbox"
          name="isPublic"
          aria-label="isPublic"
          checked={state.isPublic}
          onChange={(e) => setState((s) => ({ ...s, isPublic: e.target.checked }))}
        />
      </label>

      <button type="button" onClick={onSave} disabled={saving}>
        Save
      </button>

      {saved ? <p role="status">Saved</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {showPublicUrl ? (
        <p>
          Public URL: <a href={`/u/${state.handle}`}>/{state.handle}</a>
        </p>
      ) : null}
    </form>
  );
}
