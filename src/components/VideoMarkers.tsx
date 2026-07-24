'use client';
import { useEffect } from 'react';

/**
 * Reveals the teacher-only "video" badge on the /skills index. The badge markup
 * ships hidden inside every card, so the static HTML is identical for everyone;
 * this fetches the teacher-gated slug list at runtime and adds `.has-video` to
 * the matching cards. Non-teachers get an empty list, so nothing is ever shown —
 * no way to tell which skills have videos.
 */
export function VideoMarkers() {
  useEffect(() => {
    let alive = true;
    fetch('/api/teacher-videos')
      .then((r) => (r.ok ? r.json() : { slugs: [] }))
      .then((d) => {
        if (!alive || !Array.isArray(d?.slugs)) return;
        for (const slug of d.slugs) {
          if (typeof slug !== 'string') continue;
          document
            .querySelectorAll(`[data-skill-slug="${CSS.escape(slug)}"]`)
            .forEach((el) => el.classList.add('has-video'));
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
