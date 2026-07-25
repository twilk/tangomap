'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { smoothPathD, type Pt } from '@/src/lib/radarPath';
import { CATEGORIES, iconSvg } from '@/src/lib/dna';
import { ArPlaceCard } from './ArPlaceCard';

// qrcode is only needed after an explicit user action (badge / story export),
// so it stays out of the card's initial bundle.
const loadQR = () => import('qrcode').then((m) => m.default);

// Max tilt in degrees — enough to sell depth, low enough to keep text readable.
const MAX_TILT = 12;
// Stronger in-hand feel once the card is fullscreen ("AR"); still readable.
const MAX_TILT_AR = 18;

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
// Category icons ring the radar just outside the outer grid ring, so each spike
// is legible as a category — the same 13 icons the app's DNA radar shows.
const ICON_R = 90;
// The dark value of the app's --tm-muted, so the card's axis icons read as the
// same treatment as the /me radar and genome icons (and match the card's own
// muted text). The card is dark in both themes, so this stays a fixed literal.
const AXICON = '#9E907E';
// The card's `dna` arrives in CATEGORIES order, but match by label so the icon
// can never end up on the wrong spike if that ever changes.
const ICON_BY_LABEL: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.label, c.icon]));
// Icon as a colour-baked data URL for the canvas story export (canvas can't read
// currentColor). Mirrors the app DNA radar's approach.
const axIconUrl = (inner: string) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(inner, 24).replace(/currentColor/g, AXICON));

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
  const [immersive, setImmersive] = useState(false);
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
  // Current tilt limit, bumped in immersive mode. A ref (not the render value) so
  // the gyro handler — armed once, in a stale closure — still reads today's limit.
  const tiltMaxRef = useRef(MAX_TILT);

  const setTilt = (rx: number, ry: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const lim = tiltMaxRef.current;
    const cx = Math.max(-lim, Math.min(lim, rx));
    const cy = Math.max(-lim, Math.min(lim, ry));
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
    const lim = tiltMaxRef.current;
    setTilt(-py * 2 * lim, px * 2 * lim);
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

  // Badge QR: generated on first open (lazy qrcode), points at the public profile.
  useEffect(() => {
    if (!badge || qr) return;
    loadQR()
      .then((QRCode) => QRCode.toDataURL(profileUrl, { width: 480, margin: 4, color: { dark: '#110D09', light: '#F2EADC' } }))
      .then(setQr)
      .catch(() => {});
  }, [badge, qr, profileUrl]);

  // Badge dialog a11y: focus moves to the close button on open, Tab is trapped
  // inside the dialog, ESC closes, and focus returns to the opener on close.
  const badgeRef = useRef<HTMLDivElement>(null);
  const badgeCloseRef = useRef<HTMLButtonElement>(null);
  const badgeOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!badge) return;
    badgeCloseRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBadge(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = badgeRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      badgeOpenerRef.current?.focus();
    };
  }, [badge]);

  // Immersive ("AR") fullscreen mode: the card takes over the viewport on a dark
  // scrim and keeps tilting to the pointer/gyro. Mirrors the badge dialog for
  // focus + Escape; also locks body scroll. Single focusable (close), so Tab is
  // pinned to it rather than escaping to the controls behind the scrim.
  const arRef = useRef<HTMLDivElement>(null);
  const arCloseRef = useRef<HTMLButtonElement>(null);
  const arOpenerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!immersive) return;
    // Fire-and-forget usage beacon (see /api/ar-open). Never blocks the open.
    try {
      navigator.sendBeacon?.('/api/ar-open');
    } catch {}
    tiltMaxRef.current = MAX_TILT_AR; // stronger tilt while fullscreen
    arCloseRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Trap Tab within the overlay chrome (close + optional "Enable motion").
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setImmersive(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const f = arRef.current?.querySelectorAll<HTMLElement>('button');
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      tiltMaxRef.current = MAX_TILT;
      // Drop the amplified tilt so the card returns flat, not stuck at 18°.
      const el = wrapRef.current;
      if (el) {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rxn', '0');
        el.style.setProperty('--ryn', '0');
      }
      arOpenerRef.current?.focus();
    };
  }, [immersive]);

  // Deep-link: /u/<handle>/card?ar=1 opens the immersive view on load, so an
  // "open my card in AR" link can be shared and land straight in the mode.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('ar') === '1') setImmersive(true);
    } catch {}
  }, []);

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

    // Category icons around the perimeter, matching the on-screen card. Loaded as
    // colour-baked SVG images (canvas has no currentColor); a failed load is
    // skipped so the export never blocks on one bad icon.
    const iconPx = 12 * scale;
    const axImgs = await Promise.all(
      props.dna.map(
        (d) =>
          new Promise<HTMLImageElement | null>((res) => {
            const inner = ICON_BY_LABEL[d.label];
            if (!inner) return res(null);
            const im = new Image();
            im.onload = () => res(im);
            im.onerror = () => res(null);
            im.src = axIconUrl(inner);
          }),
      ),
    );
    axImgs.forEach((im, i) => {
      if (!im) return;
      const v = vertexAt(i, props.dna.length, ICON_R);
      ctx.drawImage(im, ox + v.x * scale - iconPx / 2, oy + v.y * scale - iconPx / 2, iconPx, iconPx);
    });

    ctx.fillStyle = '#F2EADC';
    ctx.font = '600 130px ui-monospace, Menlo, monospace';
    ctx.fillText(String(props.count), W / 2, 745);
    ctx.fillStyle = '#9E907E';
    ctx.font = '400 40px ui-monospace, Menlo, monospace';
    ctx.fillText('/ 62', W / 2, 800);

    // Ellipsize anything wider than the safe column — long display names and
    // three-part signatures overflow 1080px otherwise.
    const fit = (text: string, maxW: number) => {
      if (ctx.measureText(text).width <= maxW) return text;
      let t = text;
      while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
      return `${t.trimEnd()}…`;
    };
    const SAFE_W = W - 120;
    ctx.fillStyle = '#F2EADC';
    ctx.font = '600 96px Iowan Old Style, Georgia, serif';
    ctx.fillText(fit(props.name, SAFE_W), W / 2, 1210);
    ctx.fillStyle = '#9E907E';
    ctx.font = '400 40px ui-monospace, Menlo, monospace';
    ctx.fillText(fit(`@${props.handle}${props.style ? ` · ${props.style}` : ''}`, SAFE_W), W / 2, 1280);
    ctx.font = 'italic 46px Iowan Old Style, Georgia, serif';
    ctx.fillText(fit(props.signature, SAFE_W), W / 2, 1370);
    if (props.milestonesDone > 0) {
      ctx.fillStyle = '#E58C44';
      ctx.font = '400 44px serif';
      ctx.fillText('✦ '.repeat(props.milestonesDone).trim(), W / 2, 1445);
    }

    try {
      // Standard dark-on-light with a real quiet zone — inverted QR codes fail
      // in many scanner apps, which defeats the whole point of a story image.
      const QRCode = await loadQR();
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

      <div ref={wrapRef} className={`tm-card3d${immersive ? ' immersive' : ''}`} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}>
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
                {props.dna.map((d, i) => {
                  const inner = ICON_BY_LABEL[d.label];
                  if (!inner) return null;
                  const p = vertexAt(i, N, ICON_R);
                  const s = 12;
                  return (
                    <g
                      key={`ax-${i}`}
                      transform={`translate(${p.x - s / 2} ${p.y - s / 2})`}
                      style={{ color: AXICON }}
                      dangerouslySetInnerHTML={{ __html: iconSvg(inner, s) }}
                    />
                  );
                })}
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
        <button
          type="button"
          className="tm-cta ghost"
          onClick={(e) => {
            badgeOpenerRef.current = e.currentTarget;
            setBadge(true);
          }}
        >
          Badge / QR
        </button>
        <button
          type="button"
          className="tm-cta ghost"
          aria-haspopup="dialog"
          onClick={(e) => {
            arOpenerRef.current = e.currentTarget;
            setImmersive(true);
          }}
        >
          View in AR
        </button>
        <ArPlaceCard handle={props.handle} onFallback={() => setImmersive(true)} />
        {needsMotionOptIn && (
          <button type="button" className="tm-cta ghost" onClick={requestMotion}>
            Enable motion
          </button>
        )}
      </div>

      {badge && (
        <div ref={badgeRef} className="tm-badge" role="dialog" aria-modal="true" aria-label={`QR badge for ${props.name}`} onClick={() => setBadge(false)}>
          <button
            ref={badgeCloseRef}
            type="button"
            className="tm-badge-close"
            aria-label="Close badge"
            onClick={() => setBadge(false)}
          >
            ✕
          </button>
          <p className="tm-badge-name">{props.name}</p>
          <p className="tm-badge-meta">@{props.handle} · {props.count}/62</p>
          {qr ? <img src={qr} alt={`QR code linking to ${props.name}'s Tango Map profile`} /> : <p className="tm-badge-meta">…</p>}
          <p className="tm-badge-hint">Scan to see my Tango DNA — tap anywhere to close</p>
        </div>
      )}

      {immersive && (
        <>
          <div
            className="tm-card-ar-scrim"
            role="dialog"
            aria-modal="true"
            aria-label={`${props.name}'s card, immersive view`}
            onClick={() => setImmersive(false)}
          />
          <div ref={arRef} className="tm-card-ar-chrome">
            <button
              ref={arCloseRef}
              type="button"
              className="tm-card-ar-close"
              aria-label="Exit immersive view"
              onClick={() => setImmersive(false)}
            >
              ✕
            </button>
            {needsMotionOptIn && !motionOn && (
              <button type="button" className="tm-card-ar-motion" onClick={requestMotion}>
                Enable motion
              </button>
            )}
            <p className="tm-card-ar-hint">
              {motionOn
                ? 'Move your phone to look around'
                : needsMotionOptIn
                  ? 'Enable motion, or drag to look'
                  : 'Drag to look around'}{' '}
              · tap to close
            </p>
          </div>
        </>
      )}
    </div>
  );
}
