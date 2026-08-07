'use client';

import { useEffect, useRef } from 'react';
import { track } from '@/src/lib/track';

/**
 * Emits `skill_page_view` once per mount.
 *
 * Renders nothing. It exists because the 62 skill pages are statically generated —
 * there is no server request per view to hook, so the view has to be reported from
 * the client or not at all.
 *
 * `props.src` records how the reader arrived, which is the whole point: Gate 2's
 * entry condition is "at least one skill_page_view from an organic-search session",
 * and that is unanswerable without it. Derived from `document.referrer`, bucketed to
 * three coarse values — never the referrer string itself, which can carry a query.
 */
function sourceBucket(): 'organic' | 'internal' | 'direct' {
  try {
    const ref = document.referrer;
    if (!ref) return 'direct';
    const host = new URL(ref).host;
    if (host === window.location.host) return 'internal';
    return 'organic';
  } catch {
    return 'direct';
  }
}

export function TrackPageView({ slug }: { slug: string }): null {
  // StrictMode mounts effects twice in development; one view means one event.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track('skill_page_view', { slug, props: { src: sourceBucket() } });
  }, [slug]);

  return null;
}
