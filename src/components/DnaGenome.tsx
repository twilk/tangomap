import { iconSvg, catAnchor, type CategoryDetail } from '@/src/lib/dna';
import '@/src/styles/wiring.css';

export type Series = { name?: string; cats: CategoryDetail[] };

/**
 * "Genome" view: the 62 skills laid out as a sequence of category columns, one
 * bar per skill. Bar height encodes the skill's level (1–10), fill encodes
 * mastery. One series → a single strip; two series → stacked A/B bands sharing
 * the same columns, so a head-to-head reads as two aligned sequences.
 */
export function DnaGenome({ series }: { series: Series[] }) {
  const cmp = series.length > 1;
  const cats = series[0].cats;

  return (
    <div className={`tm-genome${cmp ? ' cmp' : ''}`}>
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
