'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { iconSvg, type CategoryDetail } from '@/src/lib/dna';
import { traceSmooth } from '@/src/lib/radarPath';

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.028 } } };
const ITEM = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

/**
 * Tango DNA radar: an animated canvas fingerprint (13 axes) paired with an
 * interactive legend. Hovering a legend row lights its axis on the radar;
 * clicking a row expands it (accordion — one open at a time) to reveal the
 * individual skills in that category and their mastery.
 */
export function DnaRadar({ categories }: { categories: CategoryDetail[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progRef = useRef(0);
  const hiRef = useRef(-1);
  const hoverRef = useRef(-1);
  const iconsRef = useRef<{ key: string; imgs: HTMLImageElement[]; imgsHi: HTMLImageElement[] }>({ key: '', imgs: [], imgsHi: [] });
  const redrawRef = useRef<() => void>(() => {});
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(-1);
  const count = categories.reduce((n, c) => n + c.done, 0);
  const total = categories.reduce((n, c) => n + c.total, 0);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const size = cv.clientWidth || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size * dpr;
    cv.height = size * dpr;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const N = categories.length;
    const pct = categories.map((c) => (c.total ? c.done / c.total : 0));
    const cx = size / 2;
    const cy = size / 2;
    const rad = size / 2 - Math.max(28, size * 0.12);
    const p = progRef.current;
    const hiI = hiRef.current;
    const gv = (n: string) => getComputedStyle(cv).getPropertyValue(n).trim() || '#888';
    const line = gv('--tm-line');
    const faint = gv('--tm-faint');
    const ember = gv('--tm-ember');
    const carm = gv('--tm-carmine');
    const muted = gv('--tm-muted');
    const focus = gv('--tm-focus');
    // Build (once per theme) two icon sets: muted for idle axes, focus-coloured
    // for the hovered/pinned axis so its icon pops in the highlight colour.
    const iconKey = muted + '|' + focus;
    if (iconsRef.current.key !== iconKey) {
      iconsRef.current.key = iconKey;
      const build = (col: string) =>
        categories.map((c) => {
          const img = new Image();
          img.onload = () => redrawRef.current();
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(c.icon, 24).replace(/currentColor/g, col));
          return img;
        });
      iconsRef.current.imgs = build(muted);
      iconsRef.current.imgsHi = build(focus);
    }
    const hexA = (hex: string, a: number) => {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    };
    const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const a = ang(i);
        const r = (rad * k) / 4;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const a = ang(i);
      const on = i === hiI;
      ctx.strokeStyle = on ? focus : line;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      ctx.stroke();
      // category icon (replaces the axis number); highlight = focus disc + ring behind it
      const lr = rad + Math.max(15, size * 0.055);
      const ex = cx + Math.cos(a) * lr;
      const ey = cy + Math.sin(a) * lr;
      if (on) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(12, size * 0.043), 0, 7);
        ctx.fillStyle = hexA(focus, 0.2);
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = focus;
        ctx.stroke();
        ctx.restore();
      }
      const img = on ? iconsRef.current.imgsHi[i] : iconsRef.current.imgs[i];
      const is = Math.max(15, size * (on ? 0.062 : 0.052));
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, ex - is / 2, ey - is / 2, is, is);
    }
    // Soft "blob": a gently smoothed spline through the vertices (not a spiky
    // polygon), a thin stroke, and a light fill.
    const poly = [];
    for (let i = 0; i < N; i++) {
      const a = ang(i);
      const r = rad * pct[i] * p;
      poly.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    ctx.beginPath();
    traceSmooth(ctx, poly, 0.4);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, hexA(ember, 0.22));
    g.addColorStop(1, hexA(ember, 0.04));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = ember;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // Vertices stay quiet: tiny idle dots (carmine marks a maxed category), and
    // only the hovered vertex grows and gets a moonlight ring.
    for (let i = 0; i < N; i++) {
      const a = ang(i);
      const pt = pct[i];
      if (!pt) continue;
      const r = rad * pt * p;
      const on = i === hiI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      if (on) {
        ctx.save();
        ctx.shadowColor = ember;
        ctx.shadowBlur = 12;
        ctx.fillStyle = pt >= 1 ? carm : ember;
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, 7);
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.strokeStyle = focus;
        ctx.lineWidth = 1.5;
        ctx.arc(x, y, 8, 0, 7);
        ctx.stroke();
      } else {
        ctx.fillStyle = pt >= 1 ? carm : hexA(ember, 0.85);
        ctx.beginPath();
        ctx.arc(x, y, pt >= 1 ? 2.2 : 1.5, 0, 7);
        ctx.fill();
      }
    }
  }, [categories]);

  useEffect(() => {
    redrawRef.current = draw;
  }, [draw]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    let raf = 0;
    if (reduce) {
      progRef.current = 1;
      draw();
    } else {
      const start = performance.now();
      const step = (ts: number) => {
        const k = Math.min(1, (ts - start) / 1000);
        progRef.current = 1 - Math.pow(1 - k, 3);
        draw();
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    const ro = new ResizeObserver(() => {
      if (progRef.current === 0) progRef.current = reduce ? 1 : progRef.current;
      draw();
    });
    ro.observe(cv);
    const mq = window.matchMedia('(prefers-color-scheme:dark)');
    const onTheme = () => draw();
    mq.addEventListener('change', onTheme);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      mq.removeEventListener('change', onTheme);
    };
  }, [draw]);

  // Expanding a row pins its axis on the radar; collapsing falls back to the
  // currently-hovered row (so collapsing without moving the pointer keeps the
  // hover highlight rather than clearing it).
  useEffect(() => {
    hiRef.current = open >= 0 ? open : hoverRef.current;
    draw();
  }, [open, draw]);

  return (
    <div className="tm-dnablock">
      <div className="tm-radarwrap">
        <span className="tm-halo" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="tm-radar"
          role="img"
          aria-label={`Tango DNA radar: ${count} of ${total} skills mastered across ${categories.length} categories`}
        />
        <div className="tm-core" aria-hidden="true">
          <div className="tm-big">
            {count}
            <small>/{total}</small>
          </div>
          <div className="tm-cap">Tango DNA</div>
        </div>
      </div>
      <motion.ul className="tm-legend" variants={LIST} initial={reduce ? false : 'hidden'} animate={reduce ? false : 'show'}>
        {categories.map((c, i) => (
          <motion.li key={c.tag} className="tm-lgroup" variants={reduce ? undefined : ITEM}>
            <motion.button
              type="button"
              className={`tm-lrow${c.done >= c.total && c.total ? ' max' : ''}${c.done === 0 ? ' zero' : ''}${open === i ? ' open' : ''}`}
              aria-expanded={open === i}
              whileTap={reduce ? undefined : { scale: 0.99 }}
              onMouseEnter={() => {
                hoverRef.current = i;
                if (open < 0) {
                  hiRef.current = i;
                  draw();
                }
              }}
              onMouseLeave={() => {
                hoverRef.current = -1;
                if (open < 0) {
                  hiRef.current = -1;
                  draw();
                }
              }}
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <span className="tm-ix">{String(i + 1).padStart(2, '0')}</span>
              <span className="tm-lab"><span className="tm-cicon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 15) }} />{c.label}</span>
              <span className="tm-track">
                <span className="tm-fill" style={{ width: `${c.pct}%` }} />
              </span>
              <span className="tm-val">
                <b>{c.done}</b>/{c.total}
              </span>
              <span className="tm-chev" aria-hidden="true">{open === i ? '▾' : '▸'}</span>
            </motion.button>
            <div
              className={`tm-acc${open === i ? ' open' : ''}`}
              style={{ height: open === i ? c.skills.length * 22 + 16 : 0 }}
              aria-hidden={open !== i}
            >
              <ul className="tm-detail">
                {c.skills.map((s) => (
                  <li key={s.slug} className={`tm-skill${s.on ? ' on' : ''}`}>
                    <span className="tm-dot" aria-hidden="true" />
                    <span>{s.name}</span>
                    {s.on && <span className="tm-check" aria-label="mastered">✓</span>}
                  </li>
                ))}
              </ul>
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}
