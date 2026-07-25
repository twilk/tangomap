import { iconSvg, catAnchor } from '@/src/lib/dna';
import type { Series } from '@/src/components/DnaGenome';
import '@/src/styles/wiring.css';

/**
 * "Strengths" view: category mastery as bars. One series → a ranked ladder
 * (strongest first). Two series → a diverging tornado (A left, B right) sorted
 * by A, so who leads each category reads at a glance.
 *
 * Per-half theming (optional): `aColor`/`bColor` override the two series accents
 * (`.s0`/`.s1`, which resolve `--tm-ember`/`--tm-verd`) with reconciled, mutually
 * legible strokes. Each defaults to its current `--tm-*` var, so an omitted prop is
 * byte-identical (frozen default for two themeless dancers).
 */
export function DnaBars({ series, aColor, bColor }: { series: Series[]; aColor?: string; bColor?: string }) {
  const cmp = series.length > 1;
  const base = series[0].cats;
  // display order: strongest first by the first series (tie-break by count)
  const order = base.map((_, i) => i).sort((x, y) => base[y].pct - base[x].pct || base[y].done - base[x].done);

  // Override only the series accents, and only when themed — the shared ground/ink
  // stay the page palette (the two series interleave in one tornado). Omitted props
  // leave the frozen --tm-* untouched.
  const accent =
    aColor !== undefined || bColor !== undefined
      ? ({
          ...(aColor !== undefined ? { '--tm-ember': aColor } : {}),
          ...(bColor !== undefined ? { '--tm-verd': bColor } : {}),
        } as React.CSSProperties)
      : undefined;

  if (!cmp) {
    return (
      <div className="tm-bars" style={accent}>
        {order.map((i) => {
          const c = base[i];
          return (
            <a className="tm-brow" href={`/skills#${catAnchor(c.tag)}`} key={c.tag} title={`Learn ${c.label} →`}>
              <span className="tm-bico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 15) }} />
              <span className="tm-blab">{c.label}</span>
              <span className="tm-btrack">
                <i className="s0" style={{ width: `${c.pct}%` }} />
              </span>
              <span className="tm-bval">
                <b>{c.done}</b>/{c.total}
              </span>
            </a>
          );
        })}
      </div>
    );
  }

  const A = series[0].cats;
  const B = series[1].cats;
  return (
    <div className="tm-dbars" style={accent}>
      <div className="tm-dhead">
        <span className="s0">{series[0].name}</span>
        <span />
        <span className="s1">{series[1].name}</span>
      </div>
      {order.map((i) => {
        const a = A[i];
        const b = B[i];
        return (
          <div className="tm-drow" key={a.tag}>
            <span className="tm-dval s0">
              <b>{a.done}</b>/{a.total}
            </span>
            <span className="tm-dbar l">
              <i className="s0" style={{ width: `${a.pct}%` }} />
            </span>
            <span className="tm-dlab">
              <span className="tm-bico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(a.icon, 14) }} />
              {a.label}
            </span>
            <span className="tm-dbar r">
              <i className="s1" style={{ width: `${b.pct}%` }} />
            </span>
            <span className="tm-dval s1">
              <b>{b.done}</b>/{b.total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
