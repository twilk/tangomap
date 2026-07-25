'use client';

import { useEffect, useState } from 'react';

// The "Next up" home card — fills the idle Skill Details panel when nothing is
// selected. A native React port of public/map-home.js: instead of a MutationObserver
// appending to the aside, this renders inside the panel's empty slot. Data comes from
// GET /api/next ({ signedIn, mastered, total, next:[{name,slug,level,reason}] }); the
// fetch is guarded, so a pending or errored request falls back to the phase-3 hint
// (never a spinner, never an error). Signed-out visitors get a sign-in invitation.

type NextSkill = { name: string; slug: string; level: number; reason: string };
type NextData = { signedIn: boolean; mastered?: number; total?: number; next?: NextSkill[] };

// Fallback denominator when the API omits `total`. The map is fixed at 62 skills.
const TOTAL = 62;

type Props = {
  /** Select a node on the map (slug === node id) — the shared select+scroll path. */
  onSelect: (id: string) => void;
};

export function MapHomeCard({ onSelect }: Props) {
  // null = pending, false = errored/absent (render the fallback), object = payload.
  const [data, setData] = useState<NextData | null | false>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/next', { credentials: 'same-origin' });
        const d = r.ok ? await r.json() : null;
        if (alive) setData(d && typeof d === 'object' ? (d as NextData) : false);
      } catch {
        if (alive) setData(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Pending or errored → the phase-3 empty hint (graceful fallback, unchanged copy).
  if (!data) {
    return (
      <div className="tsm-panel-empty">
        <span className="tsm-panel-empty-mark" aria-hidden="true" />
        <p>
          Nothing selected yet. Pick a skill to see its level, prerequisites and
          everything it unlocks.
        </p>
      </div>
    );
  }

  if (!data.signedIn) {
    return (
      <div className="tsm-home" data-signed-in="false">
        <div className="tsm-home-kicker">Start your climb</div>
        <p className="tsm-home-lead">
          Sign in to mark what you can already dance — the map then tracks your
          progress and tells you what to learn next.
        </p>
        <div className="tsm-home-actions">
          <a className="tsm-home-btn primary" href="/signin">
            Sign in
          </a>
          <a className="tsm-home-link" href="/skills">
            Browse the guide <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    );
  }

  const done = Math.max(0, data.mastered ?? 0);
  const total = data.total && data.total > 0 ? data.total : TOTAL;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const next = Array.isArray(data.next) ? data.next.slice(0, 3) : [];

  return (
    <div className="tsm-home" data-signed-in="true">
      <div className="tsm-home-kicker">Your climb</div>
      <div className="tsm-home-count">
        <span className="tsm-home-count-num">{done}</span>
        <span className="tsm-home-count-total">/ {total} skills mastered</span>
      </div>
      <div
        className="tsm-home-bar"
        role="progressbar"
        aria-label="Skills mastered"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <i style={{ width: `${pct}%` }} />
      </div>

      {next.length > 0 ? (
        <>
          <div className="tsm-home-sechead">Next up</div>
          <div className="tsm-home-next-list">
            {next.map((s) => (
              <div className="tsm-home-next-row" key={s.slug}>
                <button
                  type="button"
                  className="tsm-home-next"
                  data-id={s.slug}
                  onClick={() => onSelect(s.slug)}
                >
                  <span className="tsm-home-next-top">
                    <span className="tsm-home-next-name">{s.name}</span>
                    <span className="tsm-home-next-lvl">L{s.level}</span>
                  </span>
                  <span className="tsm-home-next-reason">{s.reason}</span>
                </button>
                <a
                  className="tsm-home-next-guide"
                  href={`/skill/${s.slug}`}
                  aria-label={`Read the ${s.name} guide`}
                >
                  Guide <span aria-hidden="true">→</span>
                </a>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="tsm-home-lead">
          Every skill on the map is marked mastered. Pick any node to revisit it.
        </p>
      )}

      <div className="tsm-home-actions">
        <a className="tsm-home-btn primary" href="/me">
          Profile
        </a>
        <a className="tsm-home-btn" href="/me/card">
          Card
        </a>
      </div>
    </div>
  );
}

export default MapHomeCard;
