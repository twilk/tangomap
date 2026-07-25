import { iconSvg, catAnchor, type CategoryDetail } from '@/src/lib/dna';
import '@/src/styles/wiring.css';

export type Series = { name?: string; cats: CategoryDetail[] };

/**
 * "Genome" view: the 62 skills laid out as a sequence of category columns, one
 * bar per skill. Bar height encodes the skill's level (1–10), fill encodes
 * mastery. One series → a single strip; two series → stacked A/B bands sharing
 * the same columns, so a head-to-head reads as two aligned sequences.
 *
 * Per-half theming (optional): `aColor`/`bColor` override the two series accents
 * (`.s0`/`.s1`, which resolve `--tm-ember`/`--tm-verd`) with reconciled, mutually
 * legible strokes. Each defaults to its current `--tm-*` var, so an omitted prop is
 * byte-identical (frozen default for two themeless dancers).
 */
export function DnaGenome({ series, aColor, bColor }: { series: Series[]; aColor?: string; bColor?: string }) {
  const cmp = series.length > 1;
  const cats = series[0].cats;

  // Override only the series accents, and only when themed — the shared ground/ink
  // stay the page palette (the two series interleave in one strip, so there is no
  // separable "A panel" to scope). Omitted props leave the frozen --tm-* untouched.
  const accent =
    aColor !== undefined || bColor !== undefined
      ? ({
          ...(aColor !== undefined ? { '--tm-ember': aColor } : {}),
          ...(bColor !== undefined ? { '--tm-verd': bColor } : {}),
        } as React.CSSProperties)
      : undefined;

  return (
    <div className={`tm-genome${cmp ? ' cmp' : ''}`} style={accent}>
      {cmp && (
        <div className="tm-ghead">
          {series.map((s, si) => (
            <span className={`tm-gk s${si}`} key={si}>
              <i />
              {s.name}
            </span>
          ))}
        </div>
      )}

      <div className="tm-gseq" role="img" aria-label={`Tango DNA sequence across ${cats.length} categories`}>
        {cats.map((c, ci) => (
          <a className="tm-gcol" href={`/skills#${catAnchor(c.tag)}`} key={c.tag} title={`Learn ${c.label} → · ${c.done}/${c.total}`}>
            {series.map((s, si) => {
              const col = s.cats[ci];
              return (
                <div className="tm-gbars" key={si}>
                  {col.skills.map((sk) => (
                    <span
                      key={sk.slug}
                      className={`tm-gbar s${si}${sk.on ? ' on' : ''}`}
                      style={{ height: `${34 + sk.level * 6}%` }}
                      title={`${sk.name} · L${sk.level}${sk.on ? ' · mastered' : ''}`}
                    />
                  ))}
                </div>
              );
            })}
            <span className="tm-gaxc" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 15) }} />
          </a>
        ))}
      </div>

      <p className="tm-glegend">
        {!cmp && (
          <span className="tm-gk s0">
            <i />
            mastered
          </span>
        )}
        <span className="tm-gk off">
          <i />
          not yet
        </span>
        <span className="tm-ghint">bar height = level 1–10</span>
      </p>
    </div>
  );
}
