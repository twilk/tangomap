import { recommend } from '@/src/lib/recommend';
import { iconSvg } from '@/src/lib/dna';
import '@/src/styles/wiring.css';

const KIND_TAG: Record<string, string> = {
  level: 'quick win',
  weak: 'weak spot',
  frontier: 'new ground',
  start: 'start',
  next: 'next up',
};

/**
 * "What's next" — a short, actionable coaching panel on the owner's profile.
 * Turns the tracker into a guide: 3-4 concrete skills to learn next, each with a
 * reason, drawn from the dancer's own level/category gaps. Hidden once every
 * skill is mastered.
 */
export function Recommendations({ mastered }: { mastered: string[] }) {
  const recs = recommend(mastered, 4);
  if (recs.length === 0) return null;

  return (
    <section className="tm-sec">
      <h2 className="tm-sh">What’s next</h2>
      <ul className="tm-recs">
        {recs.map((r) => (
          <li key={r.slug}>
            <a className={`tm-rec k-${r.kind}`} href={`/skill/${r.slug}`}>
              <span className="tm-rec-ico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(r.icon, 18) }} />
              <span className="tm-rec-body">
                <span className="tm-rec-name">{r.name}</span>
                <span className="tm-rec-reason">{r.reason}</span>
              </span>
              <span className="tm-rec-tag">{KIND_TAG[r.kind] ?? r.kind}</span>
              <span className="tm-rec-lvl" aria-label={`Level ${r.level}`}>L{r.level}</span>
            </a>
          </li>
        ))}
      </ul>
      <a className="tm-link-inline" href="/">Open the map and work on these →</a>
    </section>
  );
}
