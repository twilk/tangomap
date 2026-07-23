'use client';

import { useState } from 'react';

/** Copies `text` to the clipboard and confirms inline. Falls back gracefully. */
export function CopyButton({
  text,
  label = 'Copy link',
  className = 'tm-cta',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / blocked clipboard: select-and-prompt fallback.
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
