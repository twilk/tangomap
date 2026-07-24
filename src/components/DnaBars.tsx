import { iconSvg } from '@/src/lib/dna';
import type { Series } from '@/src/components/DnaGenome';
import '@/src/styles/wiring.css';

/**
 * "Strengths" view: category mastery as bars. One series → a ranked ladder
 * (strongest first). Two series → a diverging tornado (A left, B right) sorted
 * by A, so who leads each category reads at a glance.
 */
export function DnaBars({ series }: { series: Series[] }) {
  const cmp = series.length > 1;
  const base = series[0].cats;
  // display order: strongest first by the first series (tie-break by count)
  const order = base.map((_, i) => i).sort((x, y) => base[y].pct - base[x].pct || base[y].done - base[x].done);

  if (!cmp) {
    return (
      <div className="tm-bars">
        {order.map((i) => {
          const c = base[i];
          return (
            <a className="tm-brow" href={`/skills#${c.tag}`} key={c.tag} title={`Learn ${c.label} →`}>
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
    <div className="tm-dbars">
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
