import { eq } from 'drizzle-orm';
import { auth } from '@/auth';
import { db } from '@/db';
import { profile } from '@/db/schema';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount } from '@/src/lib/progress';
import { perCategoryDetailed, dnaSignature } from '@/src/lib/dna';
import { DnaRadar } from '@/src/components/DnaRadar';
import { DnaCompareRadar } from '@/src/components/DnaCompareRadar';
import { CopyButton } from '@/src/components/CopyButton';
import type { PublicProfile } from '@/src/lib/types';

// Live DB read (privacy flag + progress): must not be statically cached.
export const dynamic = 'force-dynamic';

export const metadata = { title: 'Compare — Tango Map' };

const SITE = 'https://partykamap.vercel.app';
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));
const nameOf = (p: PublicProfile) => p.displayName ?? p.handle;

export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
}) {
  const sp = await searchParams;
  // Prefill side A with the signed-in dancer's own public handle when A is empty,
  // so compare isn't a blank form for someone who doesn't know a handle.
  const session = await auth();
  let myHandle: string | null = null;
  if (session?.user?.id) {
    const own = await db.query.profile.findFirst({ where: eq(profile.userId, session.user.id) });
    myHandle = own?.isPublic ? (own.handle ?? null) : null;
  }
  const a = one(sp.a).trim() || (myHandle ?? '');
  const b = one(sp.b).trim();
  const [pa, pb] = await Promise.all([
    a ? getPublicProfile(a) : Promise.resolve(null),
    b ? getPublicProfile(b) : Promise.resolve(null),
  ]);

  const missing = [
    ...(a && !pa ? [a] : []),
    ...(b && !pb ? [b] : []),
  ];

  let verdict: React.ReactNode = null;
  if (pa && pb) {
    const ca = masteredCount(pa.mastered);
    const cb = masteredCount(pb.mastered);
    if (ca === cb) {
      verdict = (
        <p className="tm-verdict">
          Neck and neck — both at <b className="a">{ca}</b>/62.
        </p>
      );
    } else {
      const lead = ca > cb ? pa : pb;
      const cls = ca > cb ? 'a' : 'b';
      const diff = Math.abs(ca - cb);
      verdict = (
        <p className="tm-verdict">
          <b className={cls}>{nameOf(lead)}</b> leads by {diff} skill{diff === 1 ? '' : 's'}.
        </p>
      );
    }
  }

  return (
    <div className="tm-profile">
      <main className="tm-wrap wide">
        <nav className="tm-top">
          <span className="tm-brand"><span className="d" aria-hidden="true" />Tango Map</span>
          <span className="tm-nav">
            <a className="tm-link" href="/">← The map</a>
          </span>
        </nav>

        <h1 className="tm-h1">Compare dancers</h1>
        <p className="tm-lead">Two dancers, one radar — see who’s stronger in each of the 13 categories at a glance.</p>

        <form className="tm-cform" method="get" action="/compare" style={{ marginTop: '22px' }}>
          <label className="tm-inp">
            <span className="pre" aria-hidden="true">@</span>
            <input name="a" aria-label="First dancer’s handle" defaultValue={a} placeholder="handle…" autoComplete="off" spellCheck={false} />
          </label>
          <label className="tm-inp">
            <span className="pre" aria-hidden="true">@</span>
            <input name="b" aria-label="Second dancer’s handle" defaultValue={b} placeholder="handle…" autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit">Compare</button>
        </form>

        {missing.length > 0 && (
          <p className="tm-empty" role="status">
            {missing.map((h) => `@${h}`).join(' and ')} {missing.length === 1 ? 'is' : 'are'} private or don’t exist.
          </p>
        )}

        {pa && pb && (
          <>
            {verdict}
            <DnaCompareRadar
              a={{ name: nameOf(pa), cats: perCategoryDetailed(pa.mastered) }}
              b={{ name: nameOf(pb), cats: perCategoryDetailed(pb.mastered) }}
            />
          </>
        )}

        {((pa && !pb) || (!pa && pb)) && (() => {
          const p = (pa ?? pb) as PublicProfile;
          const cnt = masteredCount(p.mastered);
          return (
            <section className="tm-sec">
              <h2 className="tm-sh">
                {nameOf(p)} · {cnt}/62 · {dnaSignature(p.mastered)}
              </h2>
              <DnaRadar categories={perCategoryDetailed(p.mastered)} />
              <div className="tm-invite">
                <span>Add a second handle above, or send a friend an invite — they just add their handle:</span>
                <CopyButton className="tm-cta ghost" text={`${SITE}/compare?a=${encodeURIComponent(p.handle)}&b=`} label="Copy invite link" />
              </div>
            </section>
          );
        })()}

        {!pa && !pb && missing.length === 0 && (
          <p className="tm-empty">
            Enter two public handles above — e.g. <b>@wilk</b> — to compare their Tango DNA.
          </p>
        )}
      </main>
    </div>
  );
}
