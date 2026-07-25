'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_NODES, LEVELS } from '@/src/data/mapNodes';
import { computeMapLayout, type MapLayout } from '@/src/lib/mapLayout';
import { NODE_BY_ID, dependentsOf, relatedTo } from '@/src/lib/mapGraph';
import { SkillDetailPanel } from '@/src/components/SkillDetailPanel';
import { MapSearch } from '@/src/components/MapSearch';

// The whole-map view, ported from the decoded bundle's `buildMap` (template.html
// ~L1090–1220) onto the app's --tm-* design tokens. This is the render half; the pure
// geometry lives in src/lib/mapLayout.ts (computeMapLayout), the pure graph helpers in
// src/lib/mapGraph.ts. This phase adds the detail panel, header search, mark-mastered,
// and selection persistence + scroll-to. Explorer / category filter / home-card / auth
// are still later phases.

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

// localStorage contract, shared with the bundle + public/sync.js (which reconciles
// `tsm-mastered` across devices). `tsm-mastered` is a JSON string array of node ids;
// `tsm-sel` is the raw selected node id.
const MASTERED_KEY = 'tsm-mastered';
const SEL_KEY = 'tsm-sel';

type EdgeKind = 'prereq' | 'unlock' | 'dim' | 'base';

/** Read the persisted mastered set, guarded — bad/absent JSON yields an empty set. */
function readMastered(): Set<string> {
  try {
    const raw = localStorage.getItem(MASTERED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) {
      return new Set(arr.filter((x): x is string => typeof x === 'string' && NODE_BY_ID.has(x)));
    }
  } catch {
    /* ignore */
  }
  return new Set();
}

export function TangoMap() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const pendingScroll = useRef<string | null>(null);
  const [layout, setLayout] = useState<MapLayout | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mastered, setMastered] = useState<Set<string>>(() => new Set());

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

  // Restore persisted state on mount: the mastered set, and the last selection
  // (which is then scrolled into view once the layout is ready). Guarded — a
  // storage read must never break the map.
  useEffect(() => {
    setMastered(readMastered());
    try {
      const sel = localStorage.getItem(SEL_KEY);
      if (sel && NODE_BY_ID.has(sel)) {
        setSelected(sel);
        pendingScroll.current = sel;
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Smooth-scroll a pending node into view once the layout can place it. Cleared
  // after use so incidental relayouts (resize) never re-scroll. Port of the bundle's
  // applyPendingScroll (template L904–916).
  useEffect(() => {
    const id = pendingScroll.current;
    if (!id || !layout) return;
    const box = layout.nodes.find((b) => b.id === id);
    pendingScroll.current = null;
    if (!box) return;
    const el = scrollRef.current;
    if (!el || typeof el.scrollTo !== 'function') return;
    const dest = Math.max(0, box.y - el.clientHeight / 2);
    try {
      el.scrollTo({ top: dest, behavior: 'smooth' });
    } catch {
      /* jsdom / unsupported — selection still applies, just no scroll */
    }
  }, [selected, layout]);

  const selectNode = useCallback((id: string) => {
    if (!NODE_BY_ID.has(id)) return;
    pendingScroll.current = id;
    setSelected(id);
    setHover(null);
    try {
      localStorage.setItem(SEL_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelected(null);
    try {
      localStorage.removeItem(SEL_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const togglePick = (id: string) => {
    if (selected === id) clearSelection();
    else selectNode(id);
  };

  const toggleMastered = useCallback((id: string) => {
    setMastered((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(MASTERED_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Hover wins over selection as the highlight focus (a transient preview), exactly
  // as the bundle does: `hover || (sel ? … )`.
  const focus = hover ?? selected;
  const rel = focus ? relatedTo(focus) : null;
  const focusNode = focus ? NODE_BY_ID.get(focus) : null;
  const selectedNode = selected ? NODE_BY_ID.get(selected) ?? null : null;
  const m = layout ? pageMargin(layout.width) : 0;

  const edgeKind = (from: string, to: string): EdgeKind => {
    if (!focus) return 'base';
    if (to === focus) return 'prereq'; // focus is the dependent → this is a prereq edge (ember)
    if (from === focus) return 'unlock'; // focus is the dependency → this is an unlock edge (verd)
    return 'dim';
  };

  return (
    <div className="tsm-map">
      <div className="tsm-header">
        <MapSearch nodes={MAP_NODES} levels={LEVELS} onPick={selectNode} />
      </div>

      <div className="tsm-body">
        <div className="tsm-scroll" ref={scrollRef} onClick={clearSelection}>
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
                const isKid = focus ? dependentsOf(focus).includes(box.id) : false;
                const isDone = mastered.has(box.id);
                const dim = rel ? !rel.has(box.id) : false;
                const cls = ['tsm-node'];
                if (isSel) cls.push('on');
                if (isHov) cls.push('hov');
                if (isPre) cls.push('pre');
                if (isKid) cls.push('kid');
                if (isDone) cls.push('done');
                if (dim) cls.push('dim');
                return (
                  <button
                    key={box.id}
                    type="button"
                    className={cls.join(' ')}
                    data-id={box.id}
                    data-done={isDone}
                    aria-pressed={isSel}
                    aria-label={`${n.name} — ${n.gloss}. Level ${n.level + 1}.${isDone ? ' Mastered.' : ''}`}
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

        <SkillDetailPanel
          node={selectedNode}
          levels={LEVELS}
          mastered={mastered}
          onSelect={selectNode}
          onToggleMastered={toggleMastered}
        />
      </div>
    </div>
  );
}

export default TangoMap;
