import { notFound } from 'next/navigation';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount, perLevel, milestones } from '@/src/lib/progress';
import { TangoDNA } from '@/src/components/TangoDNA';

// Live DB read: never statically cache, or a profile flipped to private would
// stay visible from the cache (a privacy leak) and progress would go stale.
export const dynamic = 'force-dynamic';

// Public, read-only profile page. Renders ONLY allow-listed fields.
// Never renders dates or `sel` — those never leave getPublicProfile.
export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getPublicProfile(handle);
  if (!data) notFound();

  const count = masteredCount(data.mastered);
  const levels = perLevel(data.mastered);
  const badges = milestones(count);
  const name = data.displayName ?? data.handle;

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>{name}</h1>
        <p style={{ margin: '0.25rem 0', color: '#666' }}>@{data.handle}</p>
        {data.style && (
          <p style={{ margin: '0.25rem 0' }}>
            Style: <strong>{data.style}</strong>
          </p>
        )}
      </header>

      <p style={{ fontSize: '1.25rem', margin: '0 0 1.5rem' }}>
        <strong>{count}</strong> / 62 mastered
      </p>

      <section aria-label="Progress by level" style={{ marginBottom: '1.5rem' }}>
        {Object.entries(levels).map(([lvl, { done, total }]) => (
          <div
            key={lvl}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.4rem 0' }}
          >
            <span style={{ width: '2.5rem', flexShrink: 0 }}>L{lvl}</span>
            <div
              style={{
                flex: 1,
                height: '0.75rem',
                background: '#eee',
                borderRadius: '0.375rem',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: total > 0 ? `${Math.round((done / total) * 100)}%` : '0%',
                  height: '100%',
                  background: '#4f46e5',
                }}
              />
            </div>
            <span style={{ width: '3rem', flexShrink: 0, textAlign: 'right' }}>
              {done} / {total}
            </span>
          </div>
        ))}
      </section>

      <div style={{ margin: '0 0 1.5rem' }}>
        <TangoDNA mastered={data.mastered} />
      </div>

      {badges.length > 0 && (
        <section aria-label="Milestones">
          <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>Milestones</h2>
          <ul style={{ display: 'flex', gap: '0.5rem', listStyle: 'none', padding: 0, margin: 0 }}>
            {badges.map((m) => (
              <li
                key={m}
                style={{
                  padding: '0.25rem 0.6rem',
                  borderRadius: '999px',
                  background: '#4f46e5',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              >
                {m} mastered
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer style={{ marginTop: '2rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        <a href={`/compare?a=${encodeURIComponent(data.handle)}`} style={{ color: ACCENT }}>
          Compare with another dancer →
        </a>
      </footer>
    </main>
  );
}

const ACCENT = '#c67139';
