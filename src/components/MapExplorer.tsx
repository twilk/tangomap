'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NODE_BY_ID } from '@/src/lib/mapGraph';
import { layeredLayout, radialLayout, type ExplorerLayout } from '@/src/lib/explorerLayout';

// The EXPLORER canvas — the dependency-graph view for one selected skill, a sibling
// of the whole-map canvas under the same shell (TangoMap). The pure geometry lives
// in src/lib/explorerLayout.ts; this is the render half. It mirrors TangoMap's
// measurement pattern (a ResizeObserver + a canvas 2d measureText resolved from the
// live font) so the injected layout is a pure function of (centre, width, height).
//
// Two sub-layouts, switched by a small in-canvas control: 'layered' (three columns)
// and 'radial' (a ring). Clicking a neighbour re-centres the explorer by selecting
// that node (the shell owns selection, so the detail panel stays in sync); clicking
// the centre node returns to the whole map. Edges draw in via a stroke-dashoffset
// keyframe (respecting prefers-reduced-motion, handled in app/tangomap.css).

const PILL_FONT_PX = 13.5;
const PILL_FONT_WEIGHT = 700;

// jsdom / SSR fallbacks: clientWidth/Height are 0 with no layout engine, so without
// these the layout would collapse. Desktop-ish so the ring never hits the clamp.
const FALLBACK_WIDTH = 1024;
const FALLBACK_HEIGHT = 720;

type SubMode = 'layered' | 'radial';

type Props = {
  /** The centre skill id (the shell's current selection). */
  centerId: string;
  /** Select another node — re-centres the explorer and updates the detail panel. */
  onSelect: (id: string) => void;
  /** Invoked when the centre node is clicked: leave the explorer for the whole map. */
  onExitToMap: () => void;
  /** The mastered set, for the ✓ badge on nodes. */
  mastered: Set<string>;
};

export function MapExplorer({ centerId, onSelect, onExitToMap, mastered }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [subMode, setSubMode] = useState<SubMode>('layered');
  const [layout, setLayout] = useState<ExplorerLayout | null>(null);

  const recompute = useCallback(() => {
    const el = hostRef.current;
    if (!el) return;
    const width = el.clientWidth || el.getBoundingClientRect().width || FALLBACK_WIDTH;
    const height = el.clientHeight || el.getBoundingClientRect().height || FALLBACK_HEIGHT;

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = document.createElement('canvas').getContext('2d');
      ctxRef.current = ctx;
    }
    const family = (typeof getComputedStyle === 'function' && getComputedStyle(el).fontFamily) || 'sans-serif';
    const font = `${PILL_FONT_WEIGHT} ${PILL_FONT_PX}px ${family}`;
    const measureText = (text: string): number => {
      if (!ctx) return text.length * 8;
      ctx.font = font;
      return ctx.measureText(text).width;
    };

    const opts = { width, height, measureText };
    setLayout(subMode === 'radial' ? radialLayout(centerId, opts) : layeredLayout(centerId, opts));
  }, [centerId, subMode]);

  useEffect(() => {
    recompute();
    const el = hostRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  return (
    <div className="tsm-ex" ref={hostRef} data-submode={subMode}>
      <div className="tsm-ex-modes" role="group" aria-label="Explorer layout">
        <button
          type="button"
          className={`tsm-ex-mode${subMode === 'layered' ? ' on' : ''}`}
          aria-pressed={subMode === 'layered'}
          data-mode="layered"
          onClick={() => setSubMode('layered')}
        >
          Layered
        </button>
        <button
          type="button"
          className={`tsm-ex-mode${subMode === 'radial' ? ' on' : ''}`}
          aria-pressed={subMode === 'radial'}
          data-mode="radial"
          onClick={() => setSubMode('radial')}
        >
          Radial
        </button>
      </div>

      {layout && (
        <>
          <svg className="tsm-ex-edges" aria-hidden="true" width="100%" height="100%">
            {layout.edges.map((e) => (
              <path
                key={`${e.from}>${e.to}`}
                className={`tsm-ex-edge tsm-ex-edge-${e.kind}`}
                data-from={e.from}
                data-to={e.to}
                data-kind={e.kind}
                d={e.d}
                pathLength={1}
                fill="none"
                strokeLinecap="round"
              />
            ))}
            {layout.edges.map((e) => (
              <path
                key={`arrow:${e.from}>${e.to}`}
                className={`tsm-ex-arrow tsm-ex-arrow-${e.kind}`}
                data-kind={e.kind}
                d={e.arrow}
              />
            ))}
          </svg>

          {layout.nodes.map((box) => {
            const n = NODE_BY_ID.get(box.id);
            const isCenter = box.role === 'center';
            const isDone = mastered.has(box.id);
            const cls = ['tsm-ex-node', box.role];
            if (isDone) cls.push('done');
            const label = n
              ? `${n.name} — ${n.gloss}. Level ${n.level + 1}.${isDone ? ' Mastered.' : ''}`
              : box.name;
            return (
              <button
                key={box.id}
                type="button"
                className={cls.join(' ')}
                data-id={box.id}
                data-role={box.role}
                data-done={isDone}
                aria-label={isCenter ? `${label} Back to the full map.` : label}
                title={isCenter ? 'Back to the full map' : undefined}
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                onClick={() => (isCenter ? onExitToMap() : onSelect(box.id))}
              >
                {isDone && (
                  <span className="tsm-ex-badge" aria-hidden="true">
                    ✓
                  </span>
                )}
                <span className="tsm-ex-name">{box.name}</span>
                {n && (isCenter || box.role === 'prereq') && (
                  <span className="tsm-ex-meta">
                    L{n.level + 1}
                    {n.tag ? ` · ${n.tag}` : ''}
                  </span>
                )}
              </button>
            );
          })}
        </>
      )}
    </div>
  );
}

export default MapExplorer;
