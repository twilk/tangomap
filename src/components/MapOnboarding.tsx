'use client';

import { useEffect, useRef, useState } from 'react';

// First-visit welcome modal — a native React port of the bundle's first-visit overlay.
// Shows once, gated by localStorage['tsm-onboarded'] (the exact key the bundle used, so a
// visitor who already dismissed the injected version is not shown it again). Dismissing (button,
// backdrop, or Escape) sets the flag. Focus moves to the primary action on open, Tab is
// trapped inside the dialog, and Escape closes — the standard modal a11y contract.

const KEY = 'tsm-onboarded';

export function MapOnboarding() {
  const [open, setOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);

  // Read the flag once on mount (guarded — a storage failure must not break the map).
  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(KEY);
    } catch {
      seen = true; // storage unavailable → treat as already seen; never trap the user
    }
    if (!seen) setOpen(true);
  }, []);

  // Move focus to the primary action when the dialog opens.
  useEffect(() => {
    if (open) goRef.current?.focus();
  }, [open]);

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  if (!open) return null;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
      return;
    }
    if (e.key === 'Tab') {
      // Focus trap: keep Tab / Shift+Tab cycling within the dialog's focusables.
      const focusables = cardRef.current?.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div
      className="tsm-onboard"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tsm-onboard-title"
      onKeyDown={onKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <div className="tsm-onboard-card" ref={cardRef}>
        <div className="tsm-onboard-brand">
          <span className="tsm-onboard-dot" aria-hidden="true" />
          Tango Map
        </div>
        <h2 id="tsm-onboard-title" className="tsm-onboard-title">
          Welcome
        </h2>
        <p className="tsm-onboard-lead">
          62 Argentine tango skills, from your first steps to mastery. Here&rsquo;s how
          it works:
        </p>
        <ol className="tsm-onboard-steps">
          <li>
            <span className="tsm-onboard-num">1</span>
            <span>
              Tap any skill to mark it <b>mastered</b>.
            </span>
          </li>
          <li>
            <span className="tsm-onboard-num">2</span>
            <span>
              Watch your <b>Tango DNA</b> take shape.
            </span>
          </li>
          <li>
            <span className="tsm-onboard-num">3</span>
            <span>
              Sign in to <b>save</b> your progress and share your profile.
            </span>
          </li>
        </ol>
        <button ref={goRef} type="button" className="tsm-onboard-go" onClick={dismiss}>
          Start exploring
        </button>
      </div>
    </div>
  );
}

export default MapOnboarding;
