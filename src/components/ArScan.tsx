'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OneEuroFilter } from '@/src/lib/oneEuro';
import { makeProjection, applyProjection, matrix3dForQuad } from '@/src/lib/homography';

// L2 "Scan mode": point the camera at a presented marker, read the id, resolve
// it to a handle, and lock that dancer's card over the marker in the live view.
// Pure-web (getUserMedia + the vendored js-aruco detector, no WebXR) so iOS
// Safari and Android behave the same. The card is a DOM <img> placed with a CSS
// matrix3d built from the marker's four corners (see homography.ts) — no WebGL.
//
// ⚠️ The camera path is device-only: it cannot be verified without a phone
// camera pointed at a real marker. The math (projection/matrix3d/filter) is
// unit-tested; corner winding + placement may need on-device tuning.

type Corner = { x: number; y: number };
type Marker = { id: number; corners: Corner[] };
type Detector = { detect: (img: ImageData) => Marker[] };
type ARNamespace = { Detector: new () => Detector };

const PW = 480; // processing width (downscaled per the AR research)
// Card rectangle in marker-plane units (marker = unit square), centred on the
// marker, ~2.4× its size, 5:7 portrait — the card floats where the marker is.
const CARD_PLANE = [-0.7, -1.18, 1.7, -1.18, 1.7, 2.18, -0.7, 2.18]; // TL,TR,BR,BL
const CARD_W = 200;
const CARD_H = 280;

const SCRIPTS = ['cv.js', 'aruco.js'].map((f) => `/vendor/js-aruco/${f}`);

function loadScripts(): Promise<void> {
  return SCRIPTS.reduce(
    (p, src) =>
      p.then(
        () =>
          new Promise<void>((res, rej) => {
            if (document.querySelector(`script[data-aruco="${src}"]`)) return res();
            const s = document.createElement('script');
            s.src = src;
            s.async = false;
            s.dataset.aruco = src;
            s.onload = () => res();
            s.onerror = () => rej(new Error(`Failed to load ${src}`));
            document.head.appendChild(s);
          }),
      ),
    Promise.resolve(),
  );
}

type Status = 'idle' | 'starting' | 'scanning' | 'error';

export function ArScan() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [seen, setSeen] = useState<string | null>(null); // handle currently shown

  const videoRef = useRef<HTMLVideoElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const detectorRef = useRef<Detector | null>(null);
  const procRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const filters = useRef<OneEuroFilter[]>([]);
  const lastId = useRef<number | null>(null);
  const cache = useRef<Map<number, string | null | 'pending'>>(new Map());
  const missSince = useRef<number>(0);

  const resetFilters = () => {
    filters.current = Array.from({ length: 8 }, () => new OneEuroFilter({ minCutoff: 1.1, beta: 0.02 }));
  };

  const resolve = useCallback((id: number) => {
    if (cache.current.has(id)) return;
    cache.current.set(id, 'pending');
    fetch(`/api/ar-resolve?id=${id}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { handle?: string } | null) => {
        const handle = j?.handle ?? null;
        cache.current.set(id, handle);
        if (handle && imgRef.current) imgRef.current.src = `/u/${encodeURIComponent(handle)}/card/ar-image`;
      })
      .catch(() => cache.current.set(id, null));
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const loop = useCallback(
    (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const video = videoRef.current;
      const img = imgRef.current;
      const det = detectorRef.current;
      const proc = procRef.current;
      if (!video || !img || !det || !proc || video.readyState < 2) return;

      const ph = Math.round((PW * video.videoHeight) / video.videoWidth) || Math.round((PW * 3) / 4);
      if (proc.width !== PW) {
        proc.width = PW;
        proc.height = ph;
      }
      const pctx = proc.getContext('2d', { willReadFrequently: true });
      if (!pctx) return;
      pctx.drawImage(video, 0, 0, PW, ph);

      let markers: Marker[] = [];
      try {
        markers = det.detect(pctx.getImageData(0, 0, PW, ph));
      } catch {
        /* transient frame — skip */
      }

      if (!markers.length) {
        // brief grace so a one-frame dropout doesn't flicker the card away
        if (!missSince.current) missSince.current = t;
        if (t - missSince.current > 250) {
          img.style.opacity = '0';
          lastId.current = null;
        }
        return;
      }
      missSince.current = 0;

      const m = markers[0];
      if (m.id !== lastId.current) {
        lastId.current = m.id;
        resetFilters();
        resolve(m.id);
      }
      const handle = cache.current.get(m.id);
      if (!handle || handle === 'pending') {
        img.style.opacity = '0';
        return;
      }

      // Marker corners: proc px → displayed video px, then One-Euro smoothed.
      const cw = video.clientWidth || PW;
      const ch = video.clientHeight || ph;
      const sx = cw / PW;
      const sy = ch / ph;
      const disp: number[] = [];
      for (let i = 0; i < 4; i++) {
        disp.push(filters.current[i * 2].filter(m.corners[i].x * sx, t / 1000));
        disp.push(filters.current[i * 2 + 1].filter(m.corners[i].y * sy, t / 1000));
      }

      // marker unit square → smoothed display corners, then project the card plane.
      const H = makeProjection([0, 0, 1, 0, 1, 1, 0, 1], disp);
      const pts: number[][] = [];
      for (let i = 0; i < 4; i++) pts.push(applyProjection(H, CARD_PLANE[i * 2], CARD_PLANE[i * 2 + 1]));
      img.style.transform = matrix3dForQuad(CARD_W, CARD_H, pts[0], pts[1], pts[2], pts[3]);
      img.style.opacity = '1';
      if (handle !== seen) setSeen(handle);
    },
    [resolve, seen],
  );

  const start = useCallback(async () => {
    setStatus('starting');
    setError('');
    try {
      await loadScripts();
      const AR = (window as unknown as { AR?: ARNamespace }).AR;
      if (!AR?.Detector) throw new Error('marker detector unavailable');
      detectorRef.current = new AR.Detector();
      procRef.current = document.createElement('canvas');
      resetFilters();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus('scanning');
      rafRef.current = requestAnimationFrame(loop);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      setError(
        `${err.name === 'NotAllowedError' ? 'Camera permission denied' : err.message || 'Could not start the camera'}. ` +
          'Needs HTTPS + camera access; on iOS the permission resets often — reload and re-allow.',
      );
      setStatus('error');
    }
  }, [loop]);

  useEffect(() => () => stop(), [stop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0c0906', color: '#F2EADC', overflow: 'hidden' }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }}
      />
      {/* The card, locked to the marker via matrix3d. Hidden until a marker resolves. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute', top: 0, left: 0, width: CARD_W, height: CARD_H,
          transformOrigin: '0 0', opacity: 0, pointerEvents: 'none', willChange: 'transform',
          filter: 'drop-shadow(0 12px 30px rgba(0,0,0,.55))',
        }}
      />

      {status !== 'scanning' && (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>Scan a dancer&rsquo;s card</h1>
          <p style={{ color: '#9E907E', maxWidth: 340, margin: 0, fontSize: 14.5 }}>
            Point your camera at a card shown in <b>Present</b> mode on another phone. Their card appears over the marker.
          </p>
          {status === 'error' && (
            <p style={{ color: '#ffb4b4', maxWidth: 340, fontSize: 13.5 }}>{error}</p>
          )}
          <button
            type="button"
            onClick={start}
            disabled={status === 'starting'}
            style={{
              border: '1px solid #E58C44', background: '#E58C44', color: '#1a1206',
              borderRadius: 14, padding: '13px 22px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {status === 'starting' ? 'Starting…' : 'Start camera'}
          </button>
          <a href="javascript:history.back()" style={{ color: '#9E907E', fontSize: 13 }}>← Back</a>
        </div>
      )}

      {status === 'scanning' && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 18px', background: 'linear-gradient(transparent, rgba(12,9,6,.85))', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 13.5, color: seen ? '#F2EADC' : '#9E907E' }}>
            {seen ? `Showing @${seen}` : 'Looking for a marker…'}
          </p>
        </div>
      )}
    </div>
  );
}
