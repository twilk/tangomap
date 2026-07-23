import { perCategory, dnaSignature } from '@/src/lib/dna';

const ACCENT = '#c67139';

// Server-safe (no client hooks). Renders the dancer's "Tango DNA": strength per category.
export function TangoDNA({ mastered, compact = false }: { mastered: string[]; compact?: boolean }) {
  const cats = perCategory(mastered);
  return (
    <section aria-label="Tango DNA">
      <h2 style={{ fontSize: '1rem', margin: '0 0 0.25rem' }}>Tango DNA</h2>
      {!compact && (
        <p style={{ margin: '0 0 0.75rem', color: '#666' }}>
          Signature: <strong>{dnaSignature(mastered)}</strong>
        </p>
      )}
      <div>
        {cats.map((c) => (
          <div
            key={c.tag}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '0.35rem 0' }}
          >
            <span style={{ width: '7.5rem', flexShrink: 0, fontSize: '0.85rem' }}>{c.label}</span>
            <div
              style={{
                flex: 1,
                height: '0.6rem',
                background: '#eee',
                borderRadius: '0.375rem',
                overflow: 'hidden',
              }}
            >
              <div style={{ width: `${c.pct}%`, height: '100%', background: ACCENT }} />
            </div>
            <span style={{ width: '3rem', flexShrink: 0, textAlign: 'right', fontSize: '0.8rem' }}>
              {c.done}/{c.total}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
