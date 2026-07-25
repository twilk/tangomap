import React from 'react';
import { ImageResponse } from 'next/og';
import { getCardData } from '@/src/lib/publicProfile';
import { sanitizeMastered, milestones } from '@/src/lib/progress';
import { perCategory, dnaSignature } from '@/src/lib/dna';
import { smoothPathD } from '@/src/lib/radarPath';

// Portrait card texture for AR — the single image both AR levels drape onto a
// quad (L1 model-viewer, L2 marker overlay). A card-proportioned (5:7) sibling
// of opengraph-image.tsx: same getCardData privacy gate, same Satori renderer,
// re-laid-out vertically so it reads as the card face, not the OG social banner.
// Served as GET /u/<handle>/card/ar-image so any renderer can load it by URL.
export const dynamic = 'force-dynamic';

const SIZE = { width: 800, height: 1120 };

const GROUND = '#0c0906';
const INK = '#F2EADC';
const MUTED = '#9E907E';
const FAINT = '#6C5F50';
const EMBER = '#E58C44';

// Radar geometry matching the card component (viewBox 200, r 76).
const C = 100;
const R = 76;

function Fallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: GROUND,
        color: EMBER,
        fontSize: 44,
        letterSpacing: 10,
      }}
    >
      TANGO MAP
    </div>
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getCardData(handle);

  // Private/unknown handles never resolve to card data — same rule as the page.
  if (!data) {
    return new ImageResponse(<Fallback />, SIZE);
  }

  const mastered = sanitizeMastered(data.mastered);
  const rawName = data.displayName ?? data.handle;
  const name = rawName.length > 22 ? `${rawName.slice(0, 21).trimEnd()}…` : rawName;
  const cats = perCategory(mastered);
  const N = cats.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const blob = smoothPathD(
    cats.map((c, i) => {
      const r = R * Math.max(0.08, c.pct / 100);
      return { x: C + Math.cos(ang(i)) * r, y: C + Math.sin(ang(i)) * r };
    }),
    0.9,
  );
  const stars = milestones(mastered.length).length;
  const RADAR = 460;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: GROUND,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 720,
            height: 1040,
            padding: '56px 48px',
            background: '#191309',
            backgroundImage: 'linear-gradient(160deg, #221B14, #110D09)',
            border: '1px solid rgba(241,233,220,.16)',
            borderRadius: 40,
            boxShadow: '0 40px 80px -30px rgba(0,0,0,.9)',
          }}
        >
          <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, letterSpacing: 9, color: EMBER }}>
            TANGO MAP
          </div>

          <div style={{ display: 'flex', position: 'relative', width: RADAR, height: RADAR, marginTop: 40 }}>
            <svg width={RADAR} height={RADAR} viewBox="0 0 200 200">
              {[0.25, 0.5, 0.75, 1].map((k) => (
                <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke="rgba(241,233,220,.09)" strokeWidth="1" />
              ))}
              <path d={blob} fill="rgba(229,140,68,.30)" stroke={EMBER} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: RADAR,
                height: RADAR,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, color: INK, lineHeight: 1 }}>
                {mastered.length}
              </div>
              <div style={{ display: 'flex', fontSize: 34, color: MUTED, marginTop: 8 }}>/ 62</div>
            </div>
          </div>

          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, color: INK, marginTop: 44, lineHeight: 1.05, textAlign: 'center' }}>
            {name}
          </div>
          <div style={{ display: 'flex', fontSize: 28, color: MUTED, marginTop: 14 }}>
            @{data.handle}{data.style ? ` · ${data.style}` : ''}
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: MUTED, marginTop: 22, fontStyle: 'italic', textAlign: 'center' }}>
            {dnaSignature(mastered)}
          </div>

          {stars > 0 && (
            <div style={{ display: 'flex', gap: 16, marginTop: 26 }}>
              {Array.from({ length: stars }, (_, i) => (
                <svg key={i} width="26" height="26" viewBox="0 0 22 22">
                  <path d="M11 0 L13.5 8.5 L22 11 L13.5 13.5 L11 22 L8.5 13.5 L0 11 L8.5 8.5 Z" fill={EMBER} />
                </svg>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flex: 1 }} />
          <div style={{ display: 'flex', fontSize: 24, color: FAINT, letterSpacing: 5 }}>
            Nº {String(data.serial).padStart(4, '0')} · {data.mintedYear}
          </div>
        </div>
      </div>
    ),
    SIZE,
  );
}
