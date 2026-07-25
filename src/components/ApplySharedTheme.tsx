'use client';

// The "apply their theme" button on a public dancer's profile (/u/[handle]). The
// server passes the already-validated shared seeds (getSharedTheme); clicking
// re-validates them one more time through applyCustomTheme (the client trust
// boundary re-parses) before applying live and mirroring across devices. On the
// rare re-validation failure, a small note replaces the silent no-op.

import React, { useState } from 'react';
import type { Theme } from '@/src/lib/theme';
import { applyCustomTheme } from '@/src/lib/customTheme';
import { pushCustomTheme } from '@/src/lib/themeSync';

type Props = { theme: Theme; name: string; handle: string };

export default function ApplySharedTheme({ theme, name, handle }: Props): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const [applied, setApplied] = useState(false);

  function onApply(): void {
    if (!applyCustomTheme(theme)) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setApplied(true);
    // Mirror to the server so the theme follows the viewer across devices.
    void pushCustomTheme();
  }

  return (
    <div className="tm-apply-shared">
      <button type="button" className="tm-cta ghost" onClick={onApply}>
        Apply {name} — @{handle}&rsquo;s theme <span className="tm-ar" aria-hidden="true">→</span>
      </button>
      {applied && !failed && (
        <p className="tm-community-note" role="status">✓ Applied — this theme is live across the app.</p>
      )}
      {failed && (
        <p className="tm-community-note" role="alert">Couldn&rsquo;t apply this theme.</p>
      )}
    </div>
  );
}
