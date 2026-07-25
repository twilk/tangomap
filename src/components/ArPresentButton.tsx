'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { markerGrid, serialToMarkerId } from '@/src/lib/arMarker';

/**
 * L2 "Show mode": the presenter opens a full-screen ArUco marker for their card
 * (id = mint serial). Someone else scans it with /ar/scan and sees this card
 * rendered over the phone. The marker carries only the id — the card itself is
 * fetched (privacy-gated) by the scanner. Self-contained + inline-styled so it
 * stays clear of the actively-edited DancerCard/tango.css.
 */
export function ArPresentButton({ serial, name }: { serial: number; name: string }) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const markerId = serialToMarkerId(serial);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || markerId === null) return;
    const g = markerGrid(markerId);
    const n = 7, quiet = 1, total = n + quiet * 2, cell = 48;
    cv.width = total * cell;
    cv.height = total * cell;
    const c = cv.getContext('2d');
    if (!c) return;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, cv.width, cv.height); // white quiet zone
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        c.fillStyle = g[y][x] ? '#fff' : '#000';
        c.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
      }
    }
  }, [markerId]);

  useEffect(() => {
    if (open) draw();
  }, [open, draw]);

  // A serial past the ArUco dictionary can't be presented in v1 (see arMarker).
  if (markerId === null) return null;

  return (
    <>
      <button type="button" className="tm-cta ghost" onClick={() => setOpen(true)}>
        Present in AR
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`AR marker for ${name}`}
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: '#fff',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 16,
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            style={{
              position: 'absolute', top: 14, right: 16, width: 40, height: 40, borderRadius: 999,
              border: '1px solid #0002', background: '#0000000d', color: '#110D09', fontSize: 18, cursor: 'pointer',
            }}
          >
            ✕
          </button>
          <canvas
            ref={canvasRef}
            style={{ width: 'min(82vw, 82vh)', height: 'min(82vw, 82vh)', imageRendering: 'pixelated' }}
          />
          <p style={{ color: '#4a4038', fontSize: 13.5, textAlign: 'center', maxWidth: 360, margin: 0 }}>
            Turn brightness to max · have someone point the Tango Map card scanner at this · tap to close
          </p>
        </div>
      )}
    </>
  );
}
