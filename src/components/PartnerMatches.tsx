import { danceScore, learnScore } from '@/src/lib/matching';
import type { PublicProfile } from '@/src/lib/types';

const enc = encodeURIComponent;
const nameOf = (p: PublicProfile) => p.displayName ?? p.handle;

function CompareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h13m0 0-4-4m4 4-4 4" />
      <path d="M20 16H7m0 0 4 4m-4-4 4-4" />
    </svg>
  );
}

/**
 * "Find a partner" — suggests dancers from the public directory.
 *   • Dance partners: symmetric score (shared repertoire + level proximity) — the
 *     evidence-backed signal for a real-time joint-coordination task like tango.
 *   • Learn from: dancers a bounded step ahead who can help you level up (framed
 *     for the learner's benefit, per the asymmetric learning evidence).
 * See docs/partner-matching-research.md. Renders nothing when there's no one to match.
 */
export function PartnerMatches({ mastered, meHandle, dancers }: { mastered: string[]; meHandle: string | null; dancers: PublicProfile[] }) {
  const candidates = dancers.filter((d) => d.handle !== meHandle);
  if (candidates.length === 0) return null;

  const dance = candidates
    .map((d) => ({ d, s: danceScore(mastered, d.mastered) }))
    .sort((a, b) => b.s.score - a.s.score)
    .slice(0, 4);

  const learn = candidates
    .map((d) => ({ d, l: learnScore(mastered, d.mastered) }))
    .filter((x) => x.l.eligible)
    .sort((a, b) => b.l.canTeach - a.l.canTeach)
    .slice(0, 3);

  const compareHref = (h: string) => `/compare?a=${enc(meHandle ?? '')}&b=${enc(h)}`;

  return (
    <section className="tm-sec">
      <h2 className="tm-sh">Find a partner</h2>

      <h3 className="tm-msub">
        Dance partners <span className="tm-mhint">shared repertoire + similar level</span>
      </h3>
      <ul className="tm-matches">
        {dance.map(({ d, s }) => (
          <li className="tm-match" key={d.handle}>
            <span className="tm-match-ava" aria-hidden="true">{(nameOf(d).trim()[0] ?? '·').toUpperCase()}</span>
            <span className="tm-match-body">
              <span className="tm-match-name">{nameOf(d)}</span>
              <span className="tm-match-meta">
                @{d.handle} · {s.shared} shared{s.reachGap > 0 ? ` · ${s.reachGap} level${s.reachGap === 1 ? '' : 's'} apart` : ' · same level'}
              </span>
            </span>
            <span className="tm-match-score" title="Dance match" aria-label={`${Math.round(s.score * 100)}% dance match`}>
              {Math.round(s.score * 100)}%
            </span>
            <a className="tm-cbtn" href={compareHref(d.handle)} aria-label={`Compare with ${nameOf(d)}`}>
              <CompareIcon />
              Compare
            </a>
          </li>
        ))}
      </ul>

      {learn.length > 0 && (
        <>
          <h3 className="tm-msub">
            Learn from <span className="tm-mhint">a step ahead — they can help you level up</span>
          </h3>
          <ul className="tm-matches">
            {learn.map(({ d, l }) => (
              <li className="tm-match learn" key={d.handle}>
                <span className="tm-match-ava teach" aria-hidden="true">{(nameOf(d).trim()[0] ?? '·').toUpperCase()}</span>
                <span className="tm-match-body">
                  <span className="tm-match-name">{nameOf(d)}</span>
                  <span className="tm-match-meta">
                    can help with <b>{l.canTeach}</b> skill{l.canTeach === 1 ? '' : 's'} you haven’t reached
                    {l.topSkills.length ? ` — ${l.topSkills.join(', ')}${l.canTeach > l.topSkills.length ? '…' : ''}` : ''}
                  </span>
                </span>
                <a className="tm-cbtn" href={compareHref(d.handle)} aria-label={`Compare with ${nameOf(d)}`}>
                  <CompareIcon />
                  Compare
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
