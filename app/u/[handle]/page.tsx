import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount, perLevel, milestones, sanitizeMastered } from '@/src/lib/progress';
import { perCategory, topStrengths, dnaSignature } from '@/src/lib/dna';
import { LEVELS, TIER_NAME, TIER_SHORT, furthestTier } from '@/src/lib/levels';
import { SKILLS } from '@/src/data/skills';
import { DnaRadar } from '@/src/components/DnaRadar';

// Live DB read: never statically cache, or a profile flipped to private would
// stay visible from the cache (a privacy leak) and progress would go stale.
export const dynamic = 'force-dynamic';

const MILESTONES = [5, 10, 25, 50];

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) notFound();

  const mastered = sanitizeMastered(data.mastered);
  const set = new Set(mastered);
  const count = masteredCount(mastered);
  const cats = perCategory(mastered);
  const levels = perLevel(mastered);
  const badges = new Set(milestones(count));
  const strong = topStrengths(mastered, 1)[0];
  const signature = dnaSignature(mastered);
  const reached = furthestTier(levels);
  const name = data.displayName ?? data.handle;
  const initial = (name.trim()[0] ?? '·').toUpperCase();

  const grid = LEVELS.map((L) => ({
    ...L,
    cells: SKILLS.filter((s) => s.level === L.n).map((s) => set.has(s.slug)),
  }));

  return (
    <div className="tm-profile">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main className="tm-wrap">
        <header className="tm-hero">
          <div className="tm-ava" aria-hidden="true">{initial}</div>
          <div className="tm-who">
            <h1>{name}</h1>
            <p className="tm-meta">
              <span>@{data.handle}</span>
              {data.style && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Style <b>{data.style}</b></span>
                </>
              )}
            </p>
            <p className="tm-sig">
              Signature — <b>{signature}</b>
            </p>
          </div>
        </header>

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
                    <span
                      key={i}
                      className={`tm-cell${on ? ` on tier-${L.tier}` : ''}`}
                      aria-hidden="true"
                    />
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

        <div className="tm-cta-row">
          <a className="tm-cta" href={`/compare?a=${encodeURIComponent(data.handle)}`}>
            Compare with another dancer <span className="tm-ar" aria-hidden="true">→</span>
          </a>
        </div>
      </main>
    </div>
  );
}

const CSS = `
.tm-profile{
  --serif:"Iowan Old Style",Georgia,"Times New Roman",serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono","Cascadia Mono",Menlo,Consolas,monospace;
  --tm-ground:#E7E1D6; --tm-panel:#F0EBE2; --tm-panel2:#F6F1EA; --tm-hi:rgba(255,255,255,.6);
  --tm-ink:#1C1611; --tm-muted:#6C6252; --tm-faint:#968B79;
  --tm-line:rgba(28,22,17,.14); --tm-line2:rgba(28,22,17,.07);
  --tm-ember:#B95C24; --tm-ember-s:rgba(185,92,36,.15);
  --tm-verd:#2C7869; --tm-verd-s:rgba(44,120,105,.15);
  --tm-carmine:#A6172E; --tm-chip:rgba(28,22,17,.05);
  --tm-elev:0 1px 0 var(--tm-hi),0 2px 6px -2px rgba(28,22,17,.12),0 26px 52px -32px rgba(28,22,17,.5);
  color-scheme:light dark;
  background:var(--tm-ground); color:var(--tm-ink); font-family:var(--sans); line-height:1.5; min-height:100vh;
}
@media (prefers-color-scheme:dark){.tm-profile{
  --tm-ground:#110D09; --tm-panel:#1A1510; --tm-panel2:#221B14; --tm-hi:rgba(241,233,220,.045);
  --tm-ink:#F2EADC; --tm-muted:#9E907E; --tm-faint:#6C5F50;
  --tm-line:rgba(241,233,220,.11); --tm-line2:rgba(241,233,220,.05);
  --tm-ember:#E58C44; --tm-ember-s:rgba(229,140,68,.14);
  --tm-verd:#61AB95; --tm-verd-s:rgba(97,171,149,.15);
  --tm-carmine:#E6415C; --tm-chip:rgba(241,233,220,.05);
  --tm-elev:0 0 0 1px rgba(241,233,220,.04),0 34px 66px -34px rgba(0,0,0,.9);
}}
.tm-profile *{box-sizing:border-box}
.tm-wrap{max-width:760px; margin:0 auto; padding:clamp(24px,5vw,56px) clamp(16px,4vw,32px) 72px;
  padding-left:max(clamp(16px,4vw,32px),env(safe-area-inset-left)); padding-right:max(clamp(16px,4vw,32px),env(safe-area-inset-right))}
.tm-profile h1,.tm-profile h2{margin:0; text-wrap:balance}
.tm-num,.tm-v,.tm-val,.tm-ct{font-variant-numeric:tabular-nums; font-feature-settings:"tnum"}

.tm-hero{display:flex; align-items:center; gap:18px; flex-wrap:wrap}
.tm-ava{width:66px; height:66px; border-radius:50%; flex:none; display:grid; place-items:center; font-family:var(--serif);
  font-size:28px; color:#fff; background:radial-gradient(circle at 32% 28%,var(--tm-ember),var(--tm-carmine));
  box-shadow:0 0 0 4px var(--tm-ember-s),0 10px 24px -10px var(--tm-carmine)}
.tm-who{min-width:0}
.tm-who h1{font-family:var(--serif); font-weight:600; font-size:clamp(28px,6vw,44px); line-height:1; letter-spacing:-.015em; overflow-wrap:anywhere}
.tm-meta{font-family:var(--mono); font-size:12.5px; color:var(--tm-muted); margin:10px 0 0; display:flex; gap:9px; flex-wrap:wrap}
.tm-meta b{color:var(--tm-ink); text-transform:capitalize}
.tm-sig{font-family:var(--serif); font-style:italic; font-size:clamp(15px,2.2vw,18px); color:var(--tm-muted); margin:8px 0 0}
.tm-sig b{color:var(--tm-ink); font-style:normal}

.tm-strip{display:flex; margin:26px 0 8px; border:1px solid var(--tm-line); border-radius:14px; overflow:hidden;
  background:var(--tm-panel2); box-shadow:var(--tm-elev)}
.tm-s{flex:1; padding:15px 16px; border-right:1px solid var(--tm-line); min-width:0}
.tm-s:last-child{border-right:0}
.tm-k{font-family:var(--mono); font-size:9.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--tm-faint)}
.tm-v{font-family:var(--mono); font-size:clamp(19px,2.6vw,26px); font-weight:600; margin-top:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.tm-v.tm-sm{font-size:clamp(14px,2vw,18px)}
.tm-v small{color:var(--tm-faint); font-size:.55em; font-weight:400}

.tm-sec{margin-top:34px}
.tm-sh{font-family:var(--mono); font-size:10px; letter-spacing:.22em; text-transform:uppercase; color:var(--tm-faint);
  padding-bottom:10px; border-bottom:1px solid var(--tm-line2); margin-bottom:18px; font-weight:600}

/* DNA block (radar + legend) */
.tm-dnablock{display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.05fr); gap:clamp(20px,4vw,36px); align-items:center}
@media(max-width:640px){.tm-dnablock{grid-template-columns:1fr}}
.tm-radarwrap{position:relative; width:100%; max-width:360px; margin-inline:auto}
.tm-halo{position:absolute; inset:6%; border-radius:50%; z-index:0; filter:blur(20px); opacity:.75;
  background:conic-gradient(from 200deg,transparent,var(--tm-ember-s),transparent 48%,var(--tm-verd-s),transparent 78%);
  animation:tm-spin 22s linear infinite}
.tm-radar{position:relative; z-index:1; width:100%; aspect-ratio:1/1; display:block}
.tm-core{position:absolute; inset:0; z-index:2; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none}
.tm-big{font-family:var(--mono); font-variant-numeric:tabular-nums; font-size:clamp(26px,7vw,40px); font-weight:600; line-height:1; letter-spacing:-.03em}
.tm-big small{color:var(--tm-faint); font-size:.48em; font-weight:400}
.tm-cap{font-family:var(--mono); font-size:9px; letter-spacing:.22em; text-transform:uppercase; color:var(--tm-faint); margin-top:6px}
@keyframes tm-spin{to{transform:rotate(360deg)}}

.tm-legend{list-style:none; margin:0; padding:0; display:flex; flex-direction:column}
.tm-lrow{display:grid; grid-template-columns:24px 1fr 74px; grid-template-rows:auto auto; align-items:center; gap:0 12px;
  padding:6px 8px; margin:0 -8px; border-bottom:1px solid var(--tm-line2); border-radius:8px; transition:background .15s}
.tm-lrow:hover{background:var(--tm-chip)}
.tm-ix{grid-row:1/3; font-family:var(--mono); font-size:10px; color:var(--tm-faint)}
.tm-lrow:hover .tm-ix{color:var(--tm-ember)}
.tm-lab{grid-row:1; grid-column:2; font-size:13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis}
.tm-track{grid-row:2; grid-column:2; height:6px; border-radius:4px; background:var(--tm-chip); overflow:hidden; margin-top:6px}
.tm-fill{display:block; height:100%; border-radius:4px; background:var(--tm-ember)}
.tm-lrow.max .tm-fill{background:linear-gradient(90deg,var(--tm-ember),var(--tm-carmine))}
.tm-lrow.max .tm-lab::after{content:"✦"; color:var(--tm-carmine); margin-left:7px; font-size:11px}
.tm-val{grid-row:1/3; grid-column:3; text-align:right; font-family:var(--mono); font-size:12px; color:var(--tm-muted)}
.tm-val b{color:var(--tm-ink); font-weight:600}
.tm-lrow.zero .tm-val b{color:var(--tm-faint)}

/* spine */
.tm-spine{display:flex; flex-direction:column}
.tm-lv{display:grid; grid-template-columns:28px 44px 1fr 52px; align-items:center; gap:12px; padding:10px 0; border-top:1px solid var(--tm-line2)}
.tm-no{font-family:var(--mono); font-size:12px; color:var(--tm-muted)}
.tm-tier{font-family:var(--mono); font-size:9px; letter-spacing:.1em; text-transform:uppercase; padding:3px 0; border-radius:999px; text-align:center}
.tier-b{color:var(--tm-ember); background:var(--tm-ember-s)}
.tier-i{color:var(--tm-verd); background:var(--tm-verd-s)}
.tier-a{color:var(--tm-carmine); background:color-mix(in srgb,var(--tm-carmine) 15%,transparent)}
.tm-name{font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap}
.tm-bar{display:block; height:5px; border-radius:3px; background:var(--tm-chip); margin-top:6px; overflow:hidden}
.tm-bar i{display:block; height:100%; border-radius:3px; background:var(--tm-ink); opacity:.8}
.tm-ct{text-align:right; font-family:var(--mono); font-size:12px; color:var(--tm-muted)}
.tm-ct b{color:var(--tm-ink)}
.tm-lv.done0 .tm-ct b{color:var(--tm-faint)}

/* 62 grid */
.tm-grid{display:flex; flex-direction:column; gap:8px}
.tm-grow{display:grid; grid-template-columns:34px 1fr; gap:12px; align-items:center}
.tm-gl{font-family:var(--mono); font-size:11px; color:var(--tm-muted)}
.tm-cells{display:flex; gap:5px; flex-wrap:wrap}
.tm-cell{width:15px; height:15px; border-radius:4px; background:var(--tm-chip); box-shadow:inset 0 0 0 1px var(--tm-line2)}
.tm-cell.on{background:var(--tm-ember); box-shadow:0 0 8px -2px var(--tm-ember)}
.tm-cell.on.tier-i{background:var(--tm-verd); box-shadow:0 0 8px -2px var(--tm-verd)}
.tm-cell.on.tier-a{background:var(--tm-carmine); box-shadow:0 0 8px -2px var(--tm-carmine)}
.tm-sr{position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap}

/* milestones */
.tm-miles{display:flex; gap:10px; flex-wrap:wrap; margin-top:30px}
.tm-mile{display:flex; align-items:center; gap:8px; font-family:var(--mono); font-size:12px; padding:8px 13px; border-radius:999px; border:1px solid var(--tm-line); color:var(--tm-muted)}
.tm-mile i{width:9px; height:9px; border-radius:50%; background:var(--tm-faint)}
.tm-mile.on{color:var(--tm-ink); border-color:transparent; background:var(--tm-ember-s)}
.tm-mile.on i{background:var(--tm-ember); box-shadow:0 0 0 3px var(--tm-ember-s)}

.tm-cta-row{margin-top:34px; padding-top:22px; border-top:1px solid var(--tm-line)}
.tm-cta{display:inline-flex; align-items:center; gap:9px; font-weight:600; font-size:14px; color:var(--tm-ink); text-decoration:none;
  padding:12px 18px; border:1px solid var(--tm-line); border-radius:11px; transition:border-color .15s}
.tm-cta:hover{border-color:var(--tm-ember)}
.tm-cta:focus-visible{outline:2px solid var(--tm-ember); outline-offset:2px}
.tm-ar{color:var(--tm-ember)}

@media (prefers-reduced-motion:reduce){.tm-profile *{animation:none!important; transition:none!important}}
`;
