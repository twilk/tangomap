'use client';

import { useState } from 'react';

/** Self-service account deletion, wired to DELETE /api/account (cascades progress
 *  + profile). Guarded behind a typed confirmation because it is irreversible. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function del() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/account', { method: 'DELETE' });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      setErr('Could not delete your account. Please try again.');
    } catch {
      setErr('Could not delete your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tm-danger">
      <div className="tm-danger-head">
        <div>
          <div className="a">Delete account</div>
          <div className="b">Permanently removes your account, saved progress and profile. This can’t be undone.</div>
        </div>
        {!open && (
          <button type="button" className="tm-btn-ghost-danger" onClick={() => setOpen(true)}>
            Delete…
          </button>
        )}
      </div>

      {open && (
        <div className="tm-danger-confirm">
          <label className="tm-field">
            <span>Type DELETE to confirm</span>
            <span className="tm-inp">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm account deletion"
              />
            </span>
          </label>
          <div className="tm-danger-actions">
            <button type="button" className="tm-btn-danger" disabled={confirm !== 'DELETE' || busy} onClick={del}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              type="button"
              className="tm-link-btn"
              onClick={() => {
                setOpen(false);
                setConfirm('');
                setErr(null);
              }}
            >
              Cancel
            </button>
          </div>
          {err ? (
            <span className="tm-alert" role="alert">
              {err}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
