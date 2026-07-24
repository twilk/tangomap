'use client';

import { useEffect, useRef, useState } from 'react';

// Max tilt in degrees — enough to sell depth, low enough to keep text readable.
const MAX_TILT = 12;

export type DancerCardProps = {
  name: string;
  handle: string;
  style: string | null;
  initial: string;
  count: number;
  tierName: string | null;
  signature: string;
  /** 13 category pcts in display order, for the mini genome strip. */
  dna: { label: string; pct: number }[];
};

/**
 * Tier-1 "holographic" dancer card: a CSS-3D card that tilts toward the
 * pointer on desktop and follows the gyroscope on mobile, with a foil shine
 * that tracks the light angle. No WebGL, no dependencies — the same card
 * face can later be rendered to a texture for the AR (GLB/USDZ) tier.
 */
export function DancerCard(props: DancerCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  // iOS 13+ gates deviceorientation behind a user-gesture permission prompt.
  const [needsMotionOptIn, setNeedsMotionOptIn] = useState(false);
  const [motionOn, setMotionOn] = useState(false);

  // Write tilt through CSS vars so pointer + gyro share one render path and
  // React never re-renders per frame.
  const setTilt = (rx: number, ry: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const cx = Math.max(-MAX_TILT, Math.min(MAX_TILT, rx));
    const cy = Math.max(-MAX_TILT, Math.min(MAX_TILT, ry));
    el.style.setProperty('--rx', `${cx}deg`);
    el.style.setProperty('--ry', `${cy}deg`);
    // Shine position: opposite the tilt, as if lit from above the viewer.
    el.style.setProperty('--mx', `${50 - cy * 3.5}%`);
    el.style.setProperty('--my', `${50 + cx * 3.5}%`);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    // Gyro owns the card once enabled; pointer would fight it on touch.
    if (motionOn) return;
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt(-py * 2 * MAX_TILT, px * 2 * MAX_TILT);
  };

  const onPointerLeave = () => {
    if (!motionOn) setTilt(0, 0);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      setNeedsMotionOptIn(true); // iOS: wait for the button
      return;
    }
    return listenToGyro(); // Android / desktops with sensors: listen immediately
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listenToGyro = () => {
    // Neutral pose: phone held at ~45° (beta 45). Tilt is the delta from it.
    let active = false;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return;
      if (!active) {
        active = true;
        setMotionOn(true);
      }
      setTilt((e.beta - 45) * 0.6, e.gamma * 0.6);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  };

  const requestMotion = async () => {
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      const res = await DOE.requestPermission?.();
      if (res === 'granted') {
        setNeedsMotionOptIn(false);
        listenToGyro();
      }
    } catch {
      // Denied or unavailable — pointer tilt still works.
    }
  };

  return (
    <div className="tm-cardstage">
      <div
        ref={wrapRef}
        className="tm-card3d"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <article className="tm-card" aria-label={`${props.name}'s dancer card`}>
          <div className="tm-card-shine" aria-hidden="true" />
          <div className="tm-card-grain" aria-hidden="true" />

          <header className="tm-card-top">
            <span className="tm-card-brand">
              <i aria-hidden="true" /> Tango Map
            </span>
            {props.tierName && <span className="tm-card-tier">{props.tierName}</span>}
          </header>

          <div className="tm-card-id">
            <div className="tm-card-ava" aria-hidden="true">{props.initial}</div>
            <div className="tm-card-who">
              <h1>{props.name}</h1>
              <p>@{props.handle}{props.style ? ` · ${props.style}` : ''}</p>
            </div>
          </div>

          <div className="tm-card-count">
            <b className="tm-num">{props.count}</b>
            <small>/ 62 mastered</small>
          </div>

          <div className="tm-card-dna" role="img" aria-label={`Tango DNA: ${props.dna.map((d) => `${d.label} ${d.pct}%`).join(', ')}`}>
            {props.dna.map((d) => (
              <i key={d.label} style={{ height: `${Math.max(8, d.pct)}%` }} className={d.pct > 0 ? 'on' : undefined} />
            ))}
          </div>

          <footer className="tm-card-sig">{props.signature}</footer>
        </article>
      </div>

      {needsMotionOptIn && (
        <button type="button" className="tm-cta ghost tm-card-motion" onClick={requestMotion}>
          Enable motion tilt
        </button>
      )}
    </div>
  );
}
