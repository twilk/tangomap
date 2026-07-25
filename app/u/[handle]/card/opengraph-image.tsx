import React from 'react';
import { ImageResponse } from 'next/og';
import { getCardData } from '@/src/lib/publicProfile';
import { sanitizeMastered, milestones } from '@/src/lib/progress';
import { perCategory, dnaSignature } from '@/src/lib/dna';
import { smoothPathD } from '@/src/lib/radarPath';
import { cardPaletteFor } from '@/src/lib/cardTheme';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tango Map dancer card';

// Live DB read — same privacy rule as the page itself.
export const dynamic = 'force-dynamic';

// Radar geometry matching the card component (viewBox 200, r 76).
const C = 100;
const R = 76;

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const data = await getCardData(handle);

  // The card's palette: the owner's theme when they opted the card in (getCardData
  // has already gated + re-validated it), otherwise the frozen default that renders
  // byte-identical to the pre-theme card. The not-found branch is always frozen.
  const P = cardPaletteFor(data?.customTheme ?? null);

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.ground, color: P.ember, fontSize: 40, letterSpacing: 8 }}>
          TANGO MAP
        </div>
      ),
      { ...size },
    );
  }

  const mastered = sanitizeMastered(data.mastered);
  const rawName = data.displayName ?? data.handle;
  // Satori has no ellipsis/overflow handling worth trusting at this size —
  // clamp long display names so they never collide with the radar column.
  const name = rawName.length > 24 ? `${rawName.slice(0, 23).trimEnd()}…` : rawName;
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

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: P.ground }}>
        {/* the card, landscape-composed: radar left, identity right */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: P.panel,
            backgroundImage: `linear-gradient(160deg, ${P.gradFrom}, ${P.gradMid})`,
            border: `1px solid ${P.border}`,
            borderRadius: 28,
            padding: '48px 72px',
            gap: 56,
            boxShadow: '0 40px 80px -30px rgba(0,0,0,.9)',
          }}
        >
          <div style={{ display: 'flex', position: 'relative', width: 440, height: 440 }}>
            <svg width="440" height="440" viewBox="0 0 200 200">
              {[0.25, 0.5, 0.75, 1].map((k) => (
                <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke={P.ring} strokeWidth="1" />
              ))}
              <path d={blob} fill={P.emberSoft} stroke={P.ember} strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 440,
                height: 440,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: P.ink, lineHeight: 1 }}>{mastered.length}</div>
              <div style={{ display: 'flex', fontSize: 30, color: P.muted, marginTop: 6 }}>/ 62</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 480 }}>
            <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 8, color: P.ember }}>TANGO MAP</div>
            <div style={{ display: 'flex', fontSize: 76, fontWeight: 800, color: P.ink, marginTop: 16, lineHeight: 1.05 }}>{name}</div>
            <div style={{ display: 'flex', fontSize: 28, color: P.muted, marginTop: 14 }}>
              @{data.handle}{data.style ? ` · ${data.style}` : ''}
            </div>
            <div style={{ display: 'flex', fontSize: 30, color: P.muted, marginTop: 26, fontStyle: 'italic' }}>
              {dnaSignature(mastered)}
            </div>
            {stars > 0 && (
              <div style={{ display: 'flex', gap: 14, marginTop: 24 }}>
                {Array.from({ length: stars }, (_, i) => (
                  <svg key={i} width="22" height="22" viewBox="0 0 22 22">
                    <path d="M11 0 L13.5 8.5 L22 11 L13.5 13.5 L11 22 L8.5 13.5 L0 11 L8.5 8.5 Z" fill={P.ember} />
                  </svg>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', fontSize: 22, color: P.faint, marginTop: 26, letterSpacing: 4 }}>
              Nº {String(data.serial).padStart(4, '0')} · {data.mintedYear}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
