import React from 'react';
import { ImageResponse } from 'next/og';
import { getPublicProfile } from '@/src/lib/publicProfile';
import { masteredCount } from '@/src/lib/progress';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Tango Map profile';

const CREAM = '#f5ead8';
const ACCENT = '#c67139';
const INK = '#2b2118';

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
            background: CREAM,
            color: INK,
          }}
        >
          <div style={{ display: 'flex', fontSize: 96, fontWeight: 700, color: ACCENT }}>
            Tango Map
          </div>
          <div style={{ display: 'flex', fontSize: 36, marginTop: 16 }}>
            Master the dance, one skill at a time
          </div>
        </div>
      ),
      { ...size },
    );
  }

  const count = masteredCount(p.mastered);
  const pct = (count / 62) * 100;
  const name = p.displayName || p.handle;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: CREAM,
          color: INK,
          padding: 80,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 700, color: ACCENT }}>
            Tango Map
          </div>
          <div style={{ display: 'flex', fontSize: 84, fontWeight: 700, marginTop: 16 }}>
            {name}
          </div>
          {p.style ? (
            <div style={{ display: 'flex', fontSize: 40, marginTop: 8, color: ACCENT }}>
              {p.style}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, color: ACCENT }}>
              {count}
            </div>
            <div style={{ display: 'flex', fontSize: 56, marginLeft: 12, marginBottom: 20 }}>
              / 62
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: 32,
              background: '#e2d3b8',
              borderRadius: 16,
              marginTop: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${pct}%`,
                height: '100%',
                background: ACCENT,
                borderRadius: 16,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
