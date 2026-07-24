'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { smoothPathD, type Pt } from '@/src/lib/radarPath';

// Max tilt in degrees — enough to sell depth, low enough to keep text readable.
const MAX_TILT = 12;

export type CardRec = { name: string; label: string; level: number; reason: string };

export type DancerCardProps = {
  name: string;
  handle: string;
  style: string | null;
  count: number;
  tierName: string | null;
  /** Tier code drives the card frame rarity: b = matte, i = standard, a = full-art. */
  tier: 'b' | 'i' | 'a' | null;
  signature: string;
  /** Of the 4 milestone thresholds (5/10/25/50), how many are reached. */
  milestonesDone: number;
  /** Mint number (1-based, by profile creation) and its year — the season stamp. */
  serial: number;
  mintedYear: number;
  /** Viewer owns this card (enables the milestone confetti). */
  isOwner: boolean;
  /** 13 category pcts in display order, for the radar blob. */
  dna: { label: string; pct: number }[];
  /** Same shape from the ≥30-day-old snapshot, or null — the growth ghost. */
  ghostDna: { label: string; pct: number }[] | null;
  /** Top "what's next" recommendations, shown on the card back. */
  recs: CardRec[];
};

// Radar geometry (viewBox units). The blob uses the app radar's soft tension
// and the same "never fully collapsed" floor so beginners still get a shape.
const C = 100;
const R = 76;

function radarPoints(dna: { pct: number }[], r = R): Pt[] {
  const N = dna.length;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return dna.map((d, i) => ({
    x: C + Math.cos(ang(i)) * r * Math.max(0.08, d.pct / 100),
    y: C + Math.sin(ang(i)) * r * Math.max(0.08, d.pct / 100),
  }));
}

function vertexAt(i: number, n: number, r = R): Pt {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: C + Math.cos(a) * r, y: C + Math.sin(a) * r };
}

const pad4 = (n: number) => String(n).padStart(4, '0');

/**
 * "Holographic" dancer card: front carries the Tango-DNA radar (with a dashed
 * growth ghost from ≥30 days back), tilts toward the pointer/gyroscope with a
 * foil shine and pseudo-parallax layers, and flips to a branded back listing
 * the dancer's next recommended skills. Below it: share (Web Share API),
 * story-image export, and a full-screen QR badge mode for milongas.
 */
export function DancerCard(props: DancerCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [badge, setBadge] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [confetti, setConfetti] = useState<{ dx: number; dy: number; rot: number; delay: number }[]>([]);
  // iOS 13+ gates deviceorientation behind a user-gesture permission prompt.
  const [needsMotionOptIn, setNeedsMotionOptIn] = useState(false);
  const [motionOn, setMotionOn] = useState(false);
  const [shared, setShared] = useState<'idle' | 'copied'>('idle');

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/u/${props.handle}` : `/u/${props.handle}`;
  const cardUrl = `${profileUrl}/card`;

  // Write tilt through CSS vars so pointer + gyro share one render path and
  // React never re-renders per frame. The unitless twins (--rxn/--ryn) drive
  // the pseudo-parallax translations (real translateZ dies under overflow:hidden).
  const setTilt = (rx: number, ry: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const cx = Math.max(-MAX_TILT, Math.min(MAX_TILT, rx));
    const cy = Math.max(-MAX_TILT, Math.min(MAX_TILT, ry));
    el.style.setProperty('--rx', `${cx}deg`);
    el.style.setProperty('--ry', `${cy}deg`);
    el.style.setProperty('--rxn', String(cx));
    el.style.setProperty('--ryn', String(cy));
    // Shine position: opposite the tilt, as if lit from above the viewer.
    el.style.setProperty('--mx', `${50 - cy * 3.5}%`);
    el.style.setProperty('--my', `${50 + cx * 3.5}%`);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (motionOn) return; // gyro owns the card once enabled
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt(-py * 2 * MAX_TILT, px * 2 * MAX_TILT);
  };

  const onPointerLeave = () => {
    if (!motionOn) setTilt(0, 0);
  };

  // One slot for the gyro unsubscribe, whichever path armed it (auto-listen or
  // the iOS opt-in button) — without it the opt-in listener leaked past unmount.
  const gyroCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return;
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    if (typeof DOE.requestPermission === 'function') {
      setNeedsMotionOptIn(true); // iOS: wait for the button
    } else {
      listenToGyro(); // Android / desktops with sensors: listen immediately
    }
    return () => {
      gyroCleanup.current?.();
      gyroCleanup.current = null;
    };
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
    gyroCleanup.current = () => window.removeEventListener('deviceorientation', onOrient);
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

  // Owner confetti: burst once per newly reached milestone (tracked locally).
  useEffect(() => {
    if (!props.isOwner || props.milestonesDone === 0) return;
    try {
      const key = 'tm-card-miles-seen';
      const seen = Number(localStorage.getItem(key) ?? '0');
      if (props.milestonesDone > seen) {
        localStorage.setItem(key, String(props.milestonesDone));
        setConfetti(
          Array.from({ length: 22 }, () => ({
            dx: (Math.random() - 0.5) * 340,
            dy: -60 - Math.random() * 300,
            rot: (Math.random() - 0.5) * 540,
            delay: Math.random() * 0.35,
          })),
        );
      }
    } catch {}
  }, [props.isOwner, props.milestonesDone]);

  // Badge QR: generated on first open, points at the public profile.
  useEffect(() => {
    if (!badge || qr) return;
    QRCode.toDataURL(profileUrl, { width: 480, margin: 4, color: { dark: '#110D09', light: '#F2EADC' } })
      .then(setQr)
      .catch(() => {});
  }, [badge, qr, profileUrl]);

  useEffect(() => {
    if (!badge) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setBadge(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [badge]);

  const share = async () => {
    const data = { title: `${props.name} — Tango Map`, text: `${props.name}: ${props.count}/62 · ${props.signature}`, url: cardUrl };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (e) {
      // Only a user cancel ends the flow; real failures (NotAllowedError,
      // DataError, …) still deserve the clipboard fallback.
      if ((e as DOMException)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(cardUrl);
      setShared('copied');
      setTimeout(() => setShared('idle'), 1600);
    } catch {}
  };

  // 9:16 story image (1080×1920): night gradient, radar blob, identity, QR.
  const downloadStory = useCallback(async () => {
    const W = 1080;
    const H = 1920;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, '#221B14');
    bg.addColorStop(0.6, '#110D09');
    bg.addColorStop(1, '#0c0906');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const halo = ctx.createRadialGradient(W / 2, 700, 60, W / 2, 700, 520);
    halo.addColorStop(0, 'rgba(229,140,68,.30)');
    halo.addColorStop(1, 'rgba(229,140,68,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#9E907E';
    ctx.font = '600 34px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('T A N G O   M A P', W / 2, 170);

    // Radar blob, scaled from viewBox(200) to a 660px stage centred at (540,700).
    const scale = 660 / 200;
    const ox = W / 2 - 100 * scale;
    const oy = 700 - 100 * scale;
    const pts = radarPoints(props.dna).map((p) => ({ x: ox + p.x * scale, y: oy + p.y * scale }));
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(W / 2, 700, R * scale * (k / 4), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(241,233,220,.09)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const blob = new Path2D(smoothPathD(pts, 0.9));
    const fill = ctx.createRadialGradient(W / 2, 640, 40, W / 2, 700, 340);
    fill.addColorStop(0, 'rgba(229,140,68,.5)');
    fill.addColorStop(1, 'rgba(230,65,92,.14)');
    ctx.fillStyle = fill;
    ctx.fill(blob);
    ctx.strokeStyle = '#E58C44';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke(blob);

    ctx.fillStyle = '#F2EADC';
    ctx.font = '600 130px ui-monospace, Menlo, monospace';
    ctx.fillText(String(props.count), W / 2, 745);
    ctx.fillStyle = '#9E907E';
    ctx.font = '400 40px ui-monospace, Menlo, monospace';
    ctx.fillText('/ 62', W / 2, 800);

    ctx.fillStyle = '#F2EADC';
    ctx.font = '600 96px Iowan Old Style, Georgia, serif';
    ctx.fillText(props.name, W / 2, 1210);
    ctx.fillStyle = '#9E907E';
    ctx.font = '400 40px ui-monospace, Menlo, monospace';
    ctx.fillText(`@${props.handle}${props.style ? ` · ${props.style}` : ''}`, W / 2, 1280);
    ctx.font = 'italic 46px Iowan Old Style, Georgia, serif';
    ctx.fillText(props.signature, W / 2, 1370);
    if (props.milestonesDone > 0) {
      ctx.fillStyle = '#E58C44';
      ctx.font = '400 44px serif';
      ctx.fillText('✦ '.repeat(props.milestonesDone).trim(), W / 2, 1445);
    }

    try {
      // Standard dark-on-light with a real quiet zone — inverted QR codes fail
      // in many scanner apps, which defeats the whole point of a story image.
      const qrData = await QRCode.toDataURL(profileUrl, { width: 300, margin: 4, color: { dark: '#110D09', light: '#F2EADC' } });
      const img = new Image();
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
        img.src = qrData;
      });
      ctx.drawImage(img, W / 2 - 90, 1560, 180, 180);
      ctx.fillStyle = '#6C5F50';
      ctx.font = '400 30px ui-monospace, Menlo, monospace';
      ctx.fillText(profileUrl.replace(/^https?:\/\//, ''), W / 2, 1795);
    } catch {}
    ctx.fillStyle = '#6C5F50';
    ctx.font = '400 28px ui-monospace, Menlo, monospace';
    ctx.fillText(`Nº ${pad4(props.serial)} · ${props.mintedYear}`, W / 2, 1855);

    cv.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `${props.handle}-tango-card.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, 'image/png');
  }, [props, profileUrl]);

  const N = props.dna.length;
  const blobD = smoothPathD(radarPoints(props.dna), 0.9);
  const ghostD = props.ghostDna ? smoothPathD(radarPoints(props.ghostDna), 0.9) : null;
  const maxed = props.dna.filter((d) => d.pct >= 100).length;
  const spokes = props.dna.map((_, i) => vertexAt(i, N));
  const stars = props.dna.map((d, i) => (d.pct >= 100 ? vertexAt(i, N) : null));
  const tierClass = props.tier ? ` t-${props.tier}` : '';

  return (
    <div className="tm-cardstage">
      {/* Full text twin of the visual card for screen readers (the pieces below are decorative). */}
      <p className="tm-sr">
        {props.name} (@{props.handle}){props.style ? `, style ${props.style}` : ''} — Tango Map dancer card
        Nº {pad4(props.serial)}, minted {props.mintedYear}. {props.count} of 62 skills mastered
        {props.tierName ? `, furthest tier ${props.tierName}` : ''}, {maxed} of 13 categories complete,
        {' '}{props.milestonesDone} milestones reached. Signature: {props.signature}.
        {props.recs.length > 0 && ` Next up: ${props.recs.map((r) => r.name).join(', ')}.`}
      </p>

      <div ref={wrapRef} className="tm-card3d" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
        <div className={`tm-cardflip${flipped ? ' flipped' : ''}`}>
          {/* FRONT */}
          <article
            className={`tm-card front${tierClass}`}
            aria-hidden={flipped}
            onClick={() => setFlipped(true)}
          >
            <div className="tm-card-shine" aria-hidden="true" />
            <div className="tm-card-grain" aria-hidden="true" />

            <header className="tm-card-top tm-plx1" aria-hidden="true">
              <span className="tm-card-brand"><i /> Tango Map</span>
              {props.tierName && <span className="tm-card-tier">{props.tierName}</span>}
            </header>

            <div className="tm-card-radar tm-plx2" aria-hidden="true">
              <div className="tm-card-halo" />
              <svg viewBox="0 0 200 200">
                <defs>
                  <radialGradient id="tmCardBlob" cx="50%" cy="42%" r="65%">
                    <stop offset="0%" stopColor="#E58C44" stopOpacity=".55" />
                    <stop offset="72%" stopColor="#E58C44" stopOpacity=".22" />
                    <stop offset="100%" stopColor="#E6415C" stopOpacity=".14" />
                  </radialGradient>
                </defs>
                {[0.25, 0.5, 0.75, 1].map((k) => (
                  <circle key={k} cx={C} cy={C} r={R * k} fill="none" stroke="rgba(241,233,220,.09)" strokeWidth="1" />
                ))}
                {spokes.map((p, i) => (
                  <line key={i} x1={C} y1={C} x2={p.x} y2={p.y} stroke="rgba(241,233,220,.05)" strokeWidth="1" />
                ))}
                {ghostD && (
                  <path className="tm-card-ghost" d={ghostD} fill="none" stroke="rgba(241,233,220,.30)" strokeWidth="1.2" strokeDasharray="3 3" strokeLinejoin="round" />
                )}
                <path className="tm-card-blob" d={blobD} pathLength={1} fill="url(#tmCardBlob)" stroke="#E58C44" strokeWidth="1.6" strokeLinejoin="round" />
                {stars.map(
                  (p, i) =>
                    p && (
                      <g key={i} className="tm-card-star" style={{ ['--d' as string]: `${i * 0.35}s` }}>
                        <circle cx={p.x} cy={p.y} r="5.5" fill="rgba(230,65,92,.22)" />
                        <circle cx={p.x} cy={p.y} r="2.1" fill="#E6415C" />
                      </g>
                    ),
                )}
              </svg>
              <div className="tm-card-core">
                <b className="tm-num">{props.count}</b>
                <small>/ 62</small>
              </div>
              {ghostD && <span className="tm-card-ghostkey">− − 30 days ago</span>}
            </div>

            <div className="tm-card-id tm-plx1" aria-hidden="true">
              <h1>{props.name}</h1>
              <p>@{props.handle}{props.style ? ` · ${props.style}` : ''}</p>
            </div>

            <footer className="tm-card-foot" aria-hidden="true">
              <p className="tm-card-sig">{props.signature}</p>
              {props.milestonesDone > 0 && (
                <p className="tm-card-miles">
                  {Array.from({ length: props.milestonesDone }, (_, i) => (
                    <span key={i}>✦</span>
                  ))}
                </p>
              )}
              <p className="tm-card-serial">Nº {pad4(props.serial)} · {props.mintedYear}</p>
            </footer>
          </article>

          {/* BACK */}
          <article className={`tm-card back${tierClass}`} aria-hidden={!flipped} onClick={() => setFlipped(false)}>
            <div className="tm-card-shine" aria-hidden="true" />
            <div className="tm-card-weave" aria-hidden="true" />
            <span className="tm-card-mono" aria-hidden="true">tm</span>
            <header className="tm-card-top">
              <span className="tm-card-brand"><i aria-hidden="true" /> Qué sigue</span>
              <span className="tm-card-tier">what&apos;s next</span>
            </header>
            {props.recs.length > 0 ? (
              <ol className="tm-card-recs">
                {props.recs.map((r) => (
                  <li key={r.name}>
                    <b>{r.name}</b>
                    <span className="cat">{r.label} · L{r.level}</span>
                    <span className="why">{r.reason}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="tm-card-done">All 62 mastered. La pista es tuya.</p>
            )}
            <footer className="tm-card-foot">
              <p className="tm-card-serial">Tango Map · Nº {pad4(props.serial)} · {props.mintedYear}</p>
            </footer>
          </article>
        </div>

        {confetti.length > 0 && (
          <div className="tm-conf" aria-hidden="true" onAnimationEnd={() => setConfetti([])}>
            {confetti.map((c, i) => (
              <span
                key={i}
                style={{
                  ['--dx' as string]: `${c.dx}px`,
                  ['--dy' as string]: `${c.dy}px`,
                  ['--rot' as string]: `${c.rot}deg`,
                  animationDelay: `${c.delay}s`,
                }}
              >
                ✦
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="tm-card-actions">
        <button type="button" className="tm-cta ghost" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
          {flipped ? '↺ Front' : '↻ Flip'}
        </button>
        <button type="button" className="tm-cta ghost" onClick={share}>
          {shared === 'copied' ? '✓ Link copied' : 'Share'}
        </button>
        <button type="button" className="tm-cta ghost" onClick={downloadStory}>
          Story image
        </button>
        <button type="button" className="tm-cta ghost" onClick={() => setBadge(true)}>
          Badge / QR
        </button>
        {needsMotionOptIn && (
          <button type="button" className="tm-cta ghost" onClick={requestMotion}>
            Enable motion
          </button>
        )}
      </div>

      {badge && (
        <div className="tm-badge" role="dialog" aria-modal="true" aria-label={`QR badge for ${props.name}`} onClick={() => setBadge(false)}>
          <p className="tm-badge-name">{props.name}</p>
          <p className="tm-badge-meta">@{props.handle} · {props.count}/62</p>
          {qr ? <img src={qr} alt={`QR code linking to ${props.name}'s Tango Map profile`} /> : <p className="tm-badge-meta">…</p>}
          <p className="tm-badge-hint">Scan to see my Tango DNA — tap anywhere to close</p>
        </div>
      )}
    </div>
  );
}
