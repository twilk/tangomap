import React from 'react';
import { ImageResponse } from 'next/og';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount } from '@/src/lib/progress';
import { perCategory, dnaSignature } from '@/src/lib/dna';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tango Map profile';

// Live DB read: never statically cache, or a profile flipped to private would
// keep serving its old public share-card from the cache.
export const dynamic = 'force-dynamic';

// Milonga-night palette (matches the app's dark theme / share surface).
const GROUND = '#14100C';
const PANEL = '#211A13';
const INK = '#F2EADC';
const MUTED = '#9E907E';
const FAINT = '#6C5F50';
const EMBER = '#E58C44';
const CARMINE = '#E6415C';

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const p = await getPublicProfile(handle);

  if (!p) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: GROUND,
            color: INK,
          }}
        >
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 700, letterSpacing: 6, color: EMBER }}>
            TANGO MAP
          </div>
          <div style={{ display: 'flex', fontSize: 40, marginTop: 20, color: MUTED }}>
            Master the dance, one skill at a time
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const count = masteredCount(p.mastered);
  const cats = perCategory(p.mastered);
  const signature = dnaSignature(p.mastered);
  const name = p.displayName || p.handle;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: GROUND,
          color: INK,
          padding: 72,
        }}
      >
        {/* left: identity */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 6, color: EMBER }}>
            TANGO MAP
          </div>
          <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, marginTop: 18, lineHeight: 1 }}>
            {name}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 26 }}>
            <div style={{ display: 'flex', fontSize: 92, fontWeight: 800, color: EMBER, lineHeight: 1 }}>
              {count}
            </div>
            <div style={{ display: 'flex', fontSize: 40, color: FAINT, marginLeft: 10, marginBottom: 8 }}>
              / 62 mastered
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 22, maxWidth: 560 }}>
            {p.style ? `${p.style} · ` : ''}Signature — {signature}
          </div>
        </div>

        {/* right: DNA as bars */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 40 }}>
          {cats.map((c) => (
            <div key={c.tag} style={{ display: 'flex', alignItems: 'center', marginBottom: 9 }}>
              <div
                style={{
                  display: 'flex',
                  width: 150,
                  fontSize: 18,
                  color: c.done > 0 ? INK : FAINT,
                  justifyContent: 'flex-end',
                  marginRight: 14,
                }}
              >
                {c.label}
              </div>
              <div style={{ display: 'flex', width: 200, height: 14, background: PANEL, borderRadius: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    width: `${Math.max(c.pct, c.done > 0 ? 4 : 0)}%`,
                    height: '100%',
                    background: c.pct >= 100 ? CARMINE : EMBER,
                    borderRadius: 8,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
