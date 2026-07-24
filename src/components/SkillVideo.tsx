'use client';
import { useEffect, useState } from 'react';

/**
 * Teacher-gated lesson video. Mounted on every skill page, so the static HTML is
 * identical for everyone; the URL is fetched at runtime from /api/skill-video and
 * only ever reaches a signed-in teacher. Renders nothing for everyone else — no
 * player, no heading, no trace that a video exists.
 */
function drivePreview(url: string): string | null {
  const m = url.match(/\/d\/([^/]+)/) ?? url.match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

export function SkillVideo({ slug }: { slug: string }) {
  const [video, setVideo] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/skill-video?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : { video: null }))
      .then((d) => {
        if (alive) setVideo(typeof d?.video === 'string' ? d.video : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!video) return null;
  const embed = drivePreview(video);

  return (
    <section className="tm-sec">
      <h2 className="tm-sh">
        Lesson video <span className="tm-teacher-badge">teachers</span>
      </h2>
      {embed && (
        <div className="tm-skvideo">
          <iframe src={embed} title="Lesson video" allow="autoplay; fullscreen" allowFullScreen loading="lazy" />
        </div>
      )}
      <a className="tm-link-inline" href={video} target="_blank" rel="noopener noreferrer">
        Open in Google Drive →
      </a>
    </section>
  );
}
