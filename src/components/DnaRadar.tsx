'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CategoryDetail } from '@/src/lib/dna';

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
    const rad = size / 2 - Math.max(22, size * 0.09);
    const p = progRef.current;
    const hiI = hiRef.current;
    const gv = (n: string) => getComputedStyle(cv).getPropertyValue(n).trim() || '#888';
    const line = gv('--tm-line');
    const faint = gv('--tm-faint');
    const ember = gv('--tm-ember');
    const carm = gv('--tm-carmine');
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
      ctx.strokeStyle = on ? ember : line;
      ctx.lineWidth = on ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      ctx.stroke();
      ctx.fillStyle = on ? ember : faint;
      ctx.font = `${on ? 700 : 600} ${Math.max(8, size * 0.026)}px ui-monospace,Menlo,monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lr = rad + Math.max(12, size * 0.05);
      ctx.fillText(String(i + 1).padStart(2, '0'), cx + Math.cos(a) * lr, cy + Math.sin(a) * lr);
    }
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const ii = i % N;
      const a = ang(ii);
      const r = rad * pct[ii] * p;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, hexA(ember, 0.34));
    g.addColorStop(1, hexA(ember, 0.05));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = ember;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
    for (let i = 0; i < N; i++) {
      const a = ang(i);
      const pt = pct[i];
      const r = rad * pt * p;
      const on = i === hiI;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      ctx.save();
      ctx.shadowColor = ember;
      ctx.shadowBlur = pt ? (on ? 14 : 8) : 0;
      ctx.fillStyle = pt >= 1 ? carm : ember;
      ctx.beginPath();
      ctx.arc(x, y, pt ? (on ? 4.5 : 2.4 + 2.2 * pt) : 1.6, 0, 7);
      ctx.fill();
      ctx.restore();
      if (pt >= 1) {
        ctx.beginPath();
        ctx.strokeStyle = carm;
        ctx.lineWidth = 1.5;
        ctx.arc(x, y, on ? 9 : 7, 0, 7);
        ctx.stroke();
      }
    }
  }, [categories]);

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
      <ul className="tm-legend">
        {categories.map((c, i) => (
          <li key={c.tag} className="tm-lgroup">
            <button
              type="button"
              className={`tm-lrow${c.done >= c.total && c.total ? ' max' : ''}${c.done === 0 ? ' zero' : ''}${open === i ? ' open' : ''}`}
              aria-expanded={open === i}
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
              <span className="tm-lab">{c.label}</span>
              <span className="tm-track">
                <span className="tm-fill" style={{ width: `${c.pct}%` }} />
              </span>
              <span className="tm-val">
                <b>{c.done}</b>/{c.total}
              </span>
              <span className="tm-chev" aria-hidden="true">{open === i ? '▾' : '▸'}</span>
            </button>
            {open === i && (
              <ul className="tm-detail">
                {c.skills.map((s) => (
                  <li key={s.slug} className={`tm-skill${s.on ? ' on' : ''}`}>
                    <span className="tm-dot" aria-hidden="true" />
                    <span>{s.name}</span>
                    {s.on && <span className="tm-check" aria-label="mastered">✓</span>}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
