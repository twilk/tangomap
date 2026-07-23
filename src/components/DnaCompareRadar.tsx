'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { iconSvg, type CategoryDetail } from '@/src/lib/dna';

const LIST = { hidden: {}, show: { transition: { staggerChildren: 0.028 } } };
const ITEM = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

type Side = { name: string; cats: CategoryDetail[] };

/**
 * Head-to-head Tango DNA: two mastery polygons overlaid on one radar (side A in
 * ember, side B in verdigris), plus a "tape" reading every category. Hovering a
 * tape row lights that axis on the radar; clicking expands it (accordion — one
 * open at a time) to reveal the per-skill comparison between the two dancers.
 */
export function DnaCompareRadar({ a, b }: { a: Side; b: Side }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progRef = useRef(0);
  const hiRef = useRef(-1);
  const hoverRef = useRef(-1);
  const iconsRef = useRef<{ color: string; imgs: HTMLImageElement[] }>({ color: '', imgs: [] });
  const redrawRef = useRef<() => void>(() => {});
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(-1);
  const cats = a.cats;
  const aCount = a.cats.reduce((n, c) => n + c.done, 0);
  const bCount = b.cats.reduce((n, c) => n + c.done, 0);
  const total = a.cats.reduce((n, c) => n + c.total, 0);

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

    const N = cats.length;
    const cx = size / 2;
    const cy = size / 2;
    const rad = size / 2 - Math.max(28, size * 0.12);
    const p = progRef.current;
    const hiI = hiRef.current;
    const gv = (n: string) => getComputedStyle(cv).getPropertyValue(n).trim() || '#888';
    const line = gv('--tm-line');
    const faint = gv('--tm-faint');
    const ember = gv('--tm-ember');
    const verd = gv('--tm-verd');
    const muted = gv('--tm-muted');
    if (iconsRef.current.color !== muted) {
      iconsRef.current.color = muted;
      iconsRef.current.imgs = cats.map((c) => {
        const img = new Image();
        img.onload = () => redrawRef.current();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(iconSvg(c.icon, 24).replace(/currentColor/g, muted));
        return img;
      });
    }
    const hexA = (hex: string, al: number) => {
      let h = hex.replace('#', '');
      if (h.length === 3) h = h.split('').map((x) => x + x).join('');
      const n = parseInt(h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`;
    };
    const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;

    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const an = ang(i);
        const r = (rad * k) / 4;
        const x = cx + Math.cos(an) * r;
        const y = cy + Math.sin(an) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < N; i++) {
      const an = ang(i);
      const on = i === hiI;
      ctx.strokeStyle = on ? ember : line;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad);
      ctx.stroke();
      // category icon (replaces the axis number); highlight = ember disc behind it
      const lr = rad + Math.max(15, size * 0.055);
      const ex = cx + Math.cos(an) * lr;
      const ey = cy + Math.sin(an) * lr;
      if (on) {
        ctx.save();
        ctx.fillStyle = hexA(ember, 0.18);
        ctx.beginPath();
        ctx.arc(ex, ey, Math.max(12, size * 0.043), 0, 7);
        ctx.fill();
        ctx.restore();
      }
      const img = iconsRef.current.imgs[i];
      const is = Math.max(15, size * (on ? 0.062 : 0.052));
      if (img && img.complete && img.naturalWidth) ctx.drawImage(img, ex - is / 2, ey - is / 2, is, is);
    }

    const series: [CategoryDetail[], string][] = [
      [b.cats, verd],
      [a.cats, ember],
    ];
    for (const [scats, col] of series) {
      const pct = scats.map((c) => (c.total ? c.done / c.total : 0));
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const ii = i % N;
        const an = ang(ii);
        const r = rad * pct[ii] * p;
        const x = cx + Math.cos(an) * r;
        const y = cy + Math.sin(an) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = hexA(col, 0.16);
      ctx.fill();
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      for (let i = 0; i < N; i++) {
        const an = ang(i);
        const pt = pct[i];
        const r = rad * pt * p;
        const on = i === hiI;
        const x = cx + Math.cos(an) * r;
        const y = cy + Math.sin(an) * r;
        ctx.save();
        ctx.shadowColor = col;
        ctx.shadowBlur = pt ? (on ? 12 : 6) : 0;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, pt ? (on ? 4 : 2.2 + 1.8 * pt) : 1.4, 0, 7);
        ctx.fill();
        ctx.restore();
      }
    }
  }, [a.cats, b.cats, cats.length]);

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

  useEffect(() => {
    hiRef.current = open >= 0 ? open : hoverRef.current;
    draw();
  }, [open, draw]);

  return (
    <div className="tm-cmpwrap">
      <div>
        <div className="tm-radarwrap" style={{ maxWidth: 340 }}>
          <span className="tm-halo" aria-hidden="true" />
          <canvas
            ref={canvasRef}
            className="tm-radar"
            role="img"
            aria-label={`Comparison radar: ${a.name} ${aCount} of ${total} versus ${b.name} ${bCount} of ${total}`}
          />
        </div>
        <div className="tm-keys">
          <span className="tm-key">
            <i style={{ background: 'var(--tm-ember)' }} />
            {a.name} · <b>{aCount}</b>
          </span>
          <span className="tm-key">
            <i style={{ background: 'var(--tm-verd)' }} />
            {b.name} · <b>{bCount}</b>
          </span>
        </div>
      </div>

      <motion.div className="tm-tape" variants={LIST} initial={reduce ? false : 'hidden'} animate={reduce ? false : 'show'}>
        <div className="tm-th">
          <span />
          <span>Category</span>
          <span className="rt">{a.name}</span>
          <span className="ct2" />
          <span>{b.name}</span>
        </div>
        {cats.map((c, i) => {
          const bc = b.cats[i];
          if (!bc) return null;
          const aw = c.done > bc.done;
          const bw = bc.done > c.done;
          return (
            <motion.div className="tm-trg" key={c.tag} variants={reduce ? undefined : ITEM}>
              <motion.button
                type="button"
                className={`tm-tr${open === i ? ' open' : ''}`}
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
                <span className="ix">{String(i + 1).padStart(2, '0')}</span>
                <span className="lab">
                  <span className="tm-cicon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 15) }} />{c.label}
                  <span className="tm-chev" aria-hidden="true">{open === i ? ' ▾' : ' ▸'}</span>
                </span>
                <span className={`a${aw ? ' win' : ''}`}>
                  <b>{c.done}</b>/{c.total}
                  <span className="tm-minibar">
                    <i style={{ width: `${c.pct}%`, background: 'var(--tm-ember)' }} />
                  </span>
                </span>
                <span className="mid">{c.done === bc.done ? '=' : aw ? '◂' : '▸'}</span>
                <span className={`b${bw ? ' win' : ''}`}>
                  <span className="tm-minibar">
                    <i style={{ width: `${bc.pct}%`, background: 'var(--tm-verd)' }} />
                  </span>
                  <b>{bc.done}</b>/{bc.total}
                </span>
              </motion.button>
              <div className={`tm-acc${open === i ? ' open' : ''}`} aria-hidden={open !== i}>
                <div className="tm-accwrap">
                <div className="tm-detail cmp">
                  {c.skills.map((s, k) => {
                    const bOn = bc.skills[k]?.on ?? false;
                    return (
                      <div className="tm-cskill" key={s.slug}>
                        <span className={`tm-dot a${s.on ? ' on' : ''}`} aria-hidden="true" />
                        <span className="tm-cskill-name">{s.name}</span>
                        <span className={`tm-dot b${bOn ? ' on' : ''}`} aria-hidden="true" />
                      </div>
                    );
                  })}
                </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
