'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_NODES, LEVELS } from '@/src/data/mapNodes';
import { computeMapLayout, type MapLayout } from '@/src/lib/mapLayout';

// The whole-map view, ported from the decoded bundle's `buildMap` (template.html
// ~L1090–1220) onto the app's --tm-* design tokens. This is the render half; the
// pure geometry lives in src/lib/mapLayout.ts (computeMapLayout). Interactions in
// THIS phase are hover/focus + select only — no detail panel, search, explorer,
// category filter, or mastery yet (those are later phases).

// The pill font. measureText MUST use the SAME size/weight the pill text renders
// with, or the measured widths (and therefore the wrap points) drift from what the
// browser paints. The family is read from the live element so it tracks --sans.
const PILL_FONT_PX = 14;
const PILL_FONT_WEIGHT = 600;

// Density is fixed to the product default ('compact', per the bundle's
// `mapDensity ?? 'compact'`). The left page margin `m` is recomputed here from the
// same formula the layout uses, so the level-band labels sit flush with the pills.
const DENSITY = 'compact' as const;
const pageMargin = (w: number) => Math.max(12, Math.min(22, w * 0.018));

// Fallback width for environments with no layout (jsdom in tests): clientWidth is
// 0 there, so without this every pill would wrap onto its own row.
const FALLBACK_WIDTH = 1024;

// Static graph helpers, derived once from the authoritative node deps (ids, not
// slugs) so highlight logic never has to touch the DOM or the slug projection.
const NODE_BY_ID = new Map(MAP_NODES.map((n) => [n.id, n]));
const KIDS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const n of MAP_NODES) {
    for (const dep of n.deps) (m.get(dep) ?? m.set(dep, []).get(dep)!).push(n.id);
  }
  return m;
})();

/** The set of ids "in relation" to a focused node: itself, its prereqs, its unlocks. */
function relatedTo(id: string): Set<string> {
  const node = NODE_BY_ID.get(id);
  return new Set<string>([id, ...(node?.deps ?? []), ...(KIDS.get(id) ?? [])]);
}

type EdgeKind = 'prereq' | 'unlock' | 'dim' | 'base';

export function TangoMap() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const width = el.clientWidth || el.getBoundingClientRect().width || FALLBACK_WIDTH;

    let ctx = ctxRef.current;
    if (!ctx) {
      ctx = document.createElement('canvas').getContext('2d');
      ctxRef.current = ctx;
    }
    // Resolve --sans to the concrete family the pill actually renders with (a canvas
    // 2d context cannot read `var(--sans)`), so measured widths match painted widths.
    const family = (typeof getComputedStyle === 'function' && getComputedStyle(el).fontFamily) || 'sans-serif';
    const font = `${PILL_FONT_WEIGHT} ${PILL_FONT_PX}px ${family}`;
    const measureText = (text: string): number => {
      if (!ctx) return text.length * 8;
      ctx.font = font;
      return ctx.measureText(text).width;
    };

    setLayout(computeMapLayout(MAP_NODES, LEVELS, { width, measureText, density: DENSITY }));
  }, []);

  useEffect(() => {
    recompute();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  const togglePick = (id: string) => setSelected((cur) => (cur === id ? null : id));
  const clearPick = () => setSelected(null);

  // Hover wins over selection as the highlight focus (a transient preview), exactly
  // as the bundle does: `hover || (sel ? … )`.
  const focus = hover ?? selected;
  const rel = focus ? relatedTo(focus) : null;
  const focusNode = focus ? NODE_BY_ID.get(focus) : null;
  const m = layout ? pageMargin(layout.width) : 0;

  const edgeKind = (from: string, to: string): EdgeKind => {
    if (!focus) return 'base';
    if (to === focus) return 'prereq'; // focus is the dependent → this is a prereq edge (ember)
    if (from === focus) return 'unlock'; // focus is the dependency → this is an unlock edge (verd)
    return 'dim';
  };

  return (
    <div className="tsm-map">
      <div className="tsm-scroll" ref={scrollRef} onClick={clearPick}>
        {layout && (
          <div className="tsm-stage" style={{ height: layout.height }}>
            {/* edge layer — behind the pills, never intercepts pointer events */}
            <svg className="tsm-edges" aria-hidden="true" width="100%" height="100%">
              {layout.edges.map((e) => {
                const kind = edgeKind(e.from, e.to);
                return (
                  <path
                    key={`${e.from}>${e.to}`}
                    className={`tsm-edge tsm-edge-${kind}`}
                    data-from={e.from}
                    data-to={e.to}
                    data-hl={kind}
                    d={e.d}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>

            {/* level-band labels, flush to the left page margin */}
            {layout.bands.map((b) => (
              <div key={b.level} className="tsm-band" style={{ left: m, top: b.y }}>
                {b.label}
              </div>
            ))}

            {/* positioned node pills */}
            {layout.nodes.map((box) => {
              const n = NODE_BY_ID.get(box.id)!;
              const isSel = selected === box.id;
              const isHov = hover === box.id;
              const isPre = focusNode ? focusNode.deps.includes(box.id) : false;
              const isKid = focus ? (KIDS.get(focus) ?? []).includes(box.id) : false;
              const dim = rel ? !rel.has(box.id) : false;
              const cls = ['tsm-node'];
              if (isSel) cls.push('on');
              if (isHov) cls.push('hov');
              if (isPre) cls.push('pre');
              if (isKid) cls.push('kid');
              if (dim) cls.push('dim');
              return (
                <button
                  key={box.id}
                  type="button"
                  className={cls.join(' ')}
                  data-id={box.id}
                  aria-pressed={isSel}
                  aria-label={`${n.name} — ${n.gloss}. Level ${n.level + 1}.`}
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    togglePick(box.id);
                  }}
                  onMouseEnter={() => setHover(box.id)}
                  onMouseLeave={() => setHover((h) => (h === box.id ? null : h))}
                  onFocus={() => setHover(box.id)}
                  onBlur={() => setHover((h) => (h === box.id ? null : h))}
                >
                  <span className="tsm-node-dot" aria-hidden="true" />
                  <span className="tsm-node-name">{n.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default TangoMap;
