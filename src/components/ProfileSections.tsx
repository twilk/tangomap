import { masteredCount, perLevel, milestones, sanitizeMastered } from '@/src/lib/progress';
import { perCategoryDetailed, topStrengths } from '@/src/lib/dna';
import { LEVELS, TIER_NAME, TIER_SHORT, furthestTier } from '@/src/lib/levels';
import { SKILLS } from '@/src/data/skills';
import { DnaRadar } from '@/src/components/DnaRadar';

const MILESTONES = [5, 10, 25, 50];

/**
 * The shared body of a dancer's profile: stats strip, Tango DNA radar, the level
 * climb, the 62-skill grid, and milestone badges. Used by both the public profile
 * (/u/[handle]) and the owner's private profile (/me) so the two never drift.
 */
export function ProfileSections({ mastered: raw }: { mastered: string[] }) {
  const mastered = sanitizeMastered(raw);
  const set = new Set(mastered);
  const count = masteredCount(mastered);
  const cats = perCategoryDetailed(mastered);
  const levels = perLevel(mastered);
  const badges = new Set(milestones(count));
  const strong = topStrengths(mastered, 1)[0];
  const reached = furthestTier(levels);

  const grid = LEVELS.map((L) => ({
    ...L,
    cells: SKILLS.filter((s) => s.level === L.n).map((s) => set.has(s.slug)),
  }));

  return (
    <>
      <div className="tm-strip">
        <div className="tm-s">
          <div className="tm-k">Mastered</div>
          <div className="tm-v">
            {count}
            <small>/62</small>
          </div>
        </div>
        <div className="tm-s">
          <div className="tm-k">Furthest reach</div>
          <div className="tm-v tm-sm">{reached ? TIER_NAME[reached] : '—'}</div>
        </div>
        <div className="tm-s">
          <div className="tm-k">Strongest</div>
          <div className="tm-v tm-sm">{strong ? strong.label : '—'}</div>
        </div>
        <div className="tm-s">
          <div className="tm-k">Milestones</div>
          <div className="tm-v">
            {badges.size}
            <small>/4</small>
          </div>
        </div>
      </div>

      <section className="tm-sec">
        <h2 className="tm-sh">Tango DNA</h2>
        <DnaRadar categories={cats} />
      </section>

      <section className="tm-sec">
        <h2 className="tm-sh">The climb</h2>
        <div className="tm-spine">
          {LEVELS.map((L) => {
            const lv = levels[L.n];
            const pct = lv.total ? Math.round((lv.done / lv.total) * 100) : 0;
            return (
              <div className={`tm-lv${lv.done === 0 ? ' done0' : ''}`} key={L.n}>
                <span className="tm-no">L{L.n}</span>
                <span className={`tm-tier tier-${L.tier}`}>{TIER_SHORT[L.tier]}</span>
                <span className="tm-name">
                  {L.title}
                  <span className="tm-bar">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </span>
                <span className="tm-ct">
                  <b>{lv.done}</b>/{lv.total}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="tm-sec">
        <h2 className="tm-sh">All 62 · what’s mastered</h2>
        <div className="tm-grid">
          {grid.map((L) => (
            <div className="tm-grow" key={L.n}>
              <span className="tm-gl">L{L.n}</span>
              <div className="tm-cells">
                {L.cells.map((on, i) => (
                  <span key={i} className={`tm-cell${on ? ` on tier-${L.tier}` : ''}`} aria-hidden="true" />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="tm-sr">
          {count} of 62 skills mastered. {strong ? `Strongest category: ${strong.label}.` : ''}
        </p>
      </section>

      {badges.size > 0 && (
        <div className="tm-miles" aria-label="Milestones reached">
          {MILESTONES.map((m) => {
            const on = badges.has(m);
            return (
              <span className={`tm-mile${on ? ' on' : ''}`} key={m}>
                <i aria-hidden="true" />
                {m} mastered{on ? ' ✓' : ''}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
