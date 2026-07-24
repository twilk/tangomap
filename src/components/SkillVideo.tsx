'use client';
import { useEffect, useState } from 'react';

/**
 * Gated lesson videos. Mounted on every skill page, so the static HTML is
 * identical for everyone; the URLs are fetched at runtime from /api/skill-video
 * and only ever reach a viewer allowed to see them (a teacher, or one of the
 * first 50 accounts). Renders nothing for everyone else — no player, no heading,
 * no trace that a video exists.
 *
 * A lesson is usually filmed in several takes, so this is a playlist: one iframe
 * for the selected part plus a row of part buttons. Mounting every clip at once
 * would put a dozen Drive players on a single page.
 */
function drivePreview(url: string): string | null {
  const m = url.match(/\/d\/([^/]+)/) ?? url.match(/[?&]id=([^&]+)/);
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null;
}

export function SkillVideo({ slug }: { slug: string }) {
  const [videos, setVideos] = useState<string[]>([]);
  const [part, setPart] = useState(0);

  useEffect(() => {
    let alive = true;
    setPart(0);
    fetch(`/api/skill-video?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => {
        if (!alive) return;
        const list = Array.isArray(d?.videos) ? d.videos.filter((u: unknown) => typeof u === 'string' && u) : [];
        setVideos(list as string[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (videos.length === 0) return null;
  const current = videos[Math.min(part, videos.length - 1)];
  const embed = drivePreview(current);

  return (
    <section className="tm-sec">
      <h2 className="tm-sh">
        Lesson video <span className="tm-teacher-badge">teachers</span>
        {videos.length > 1 && <span className="tm-vidcount">{videos.length} parts</span>}
      </h2>

      {videos.length > 1 && (
        <div className="tm-vidparts" role="tablist" aria-label="Lesson parts">
          {videos.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === part}
              className={`tm-vidpart${i === part ? ' on' : ''}`}
              onClick={() => setPart(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {embed && (
        <div className="tm-skvideo">
          <iframe
            key={current}
            src={embed}
            title={videos.length > 1 ? `Lesson video, part ${part + 1}` : 'Lesson video'}
            allow="autoplay; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        </div>
      )}
      <a className="tm-link-inline" href={current} target="_blank" rel="noopener noreferrer">
        Open in Google Drive →
      </a>
    </section>
  );
}
