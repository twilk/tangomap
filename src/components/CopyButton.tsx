'use client';

import { useState } from 'react';
import { track } from '@/src/lib/track';

/** Copies `text` to the clipboard and confirms inline. Falls back gracefully. */
export function CopyButton({
  text,
  label = 'Copy link',
  className = 'tm-cta',
  trackAs,
}: {
  text: string;
  label?: string;
  className?: string;
  /** Opt-in telemetry. Only the /compare invite sets this — copying your own
   *  profile link on /me is not an invite and must not inflate the funnel. */
  trackAs?: 'invite_copied';
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      if (trackAs) track(trackAs);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / blocked clipboard: select-and-prompt fallback.
      // The fallback still counts as an invite: the user asked for the link.
      if (trackAs) track(trackAs);
      window.prompt('Copy this link:', text);
    }
  }

  return (
    <button type="button" className={className} onClick={copy} aria-live="polite">
      {copied ? (
        <>
          <span aria-hidden="true">✓</span> Copied
        </>
      ) : (
        label
      )}
    </button>
  );
}
