import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount } from '@/src/lib/progress';
import { TangoDNA } from '@/src/components/TangoDNA';
import type { PublicProfile } from '@/src/lib/types';

const ACCENT = '#c67139';

function Column({ handle, profile }: { handle: string; profile: PublicProfile | null }) {
  if (!handle) {
    return <div style={{ flex: 1, color: '#999', padding: '1rem 0' }}>Enter a handle above.</div>;
  }
  if (!profile) {
    return (
      <div style={{ flex: 1, padding: '1rem 0' }}>
        <strong>@{handle}</strong>
        <p style={{ color: '#999' }}>This profile is private or doesn’t exist.</p>
      </div>
    );
  }
  const count = masteredCount(profile.mastered);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <h2 style={{ margin: '0 0 0.1rem' }}>{profile.displayName ?? profile.handle}</h2>
      <p style={{ margin: '0 0 0.75rem', color: '#666' }}>
        @{profile.handle}
        {profile.style ? ` · ${profile.style}` : ''}
      </p>
      <p style={{ fontSize: '1.5rem', margin: '0 0 1rem' }}>
        <strong>{count}</strong> / 62
      </p>
      <TangoDNA mastered={profile.mastered} compact />
    </div>
  );
}

const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? '') : (v ?? ''));

export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ a?: string | string[]; b?: string | string[] }>;
}) {
  const sp = await searchParams;
  const a = one(sp.a);
  const b = one(sp.b);
  const [pa, pb] = await Promise.all([
    a ? getPublicProfile(a) : Promise.resolve(null),
    b ? getPublicProfile(b) : Promise.resolve(null),
  ]);

  const summary =
    pa && pb
      ? (() => {
          const ca = masteredCount(pa.mastered);
          const cb = masteredCount(pb.mastered);
          if (ca === cb) return `Neck and neck — both at ${ca}/62.`;
          const lead = ca > cb ? pa : pb;
          return `${lead.displayName ?? lead.handle} leads, ${Math.abs(ca - cb)} skill${Math.abs(ca - cb) === 1 ? '' : 's'} ahead.`;
        })()
      : null;

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginTop: 0 }}>Compare dancers</h1>

      <form method="get" action="/compare" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        <input name="a" defaultValue={a} placeholder="handle A" aria-label="handle A"
          style={{ flex: '1 1 8rem', padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
        <input name="b" defaultValue={b} placeholder="handle B" aria-label="handle B"
          style={{ flex: '1 1 8rem', padding: '0.5rem', borderRadius: 8, border: '1px solid #ccc' }} />
        <button type="submit"
          style={{ padding: '0.5rem 1rem', borderRadius: 999, border: 0, background: ACCENT, color: '#fff', cursor: 'pointer' }}>
          Compare
        </button>
      </form>

      {summary && <p style={{ color: ACCENT, fontWeight: 600 }}>{summary}</p>}

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <Column handle={a} profile={pa} />
        <Column handle={b} profile={pb} />
      </div>
    </main>
  );
}
