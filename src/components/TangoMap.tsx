'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAP_NODES, LEVELS } from '@/src/data/mapNodes';
import { computeMapLayout, type MapLayout } from '@/src/lib/mapLayout';
import { NODE_BY_ID, dependentsOf, relatedTo } from '@/src/lib/mapGraph';
import { SkillDetailPanel } from '@/src/components/SkillDetailPanel';
import { MapSearch } from '@/src/components/MapSearch';
import { MapExplorer } from '@/src/components/MapExplorer';
import { MapCategoryNav } from '@/src/components/MapCategoryNav';
import { MapOnboarding } from '@/src/components/MapOnboarding';
import { MASTERED_CHANGE_EVENT, MASTERED_ADOPTED_EVENT } from '@/src/components/MapSync';

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

/** Pointer type that needs 44px tap targets (finger, stylus) rather than a cursor. */
const COARSE_POINTER = '(pointer: coarse)';
const pageMargin = (w: number) => Math.max(12, Math.min(22, w * 0.018));

// Fallback width for environments with no layout (jsdom in tests): clientWidth is
// 0 there, so without this every pill would wrap onto its own row.
const FALLBACK_WIDTH = 1024;

// localStorage contract, shared with MapSync (which reconciles `tsm-mastered` across
// devices). `tsm-mastered` is a JSON string array of node ids; `tsm-sel` is the raw
// selected node id.
const MASTERED_KEY = 'tsm-mastered';
const SEL_KEY = 'tsm-sel';

// The explorer (dependency-graph) view is desktop-only, matching the bundle's
// `explorerOn = !!sel && !showMap && !isMobile` (template L1454). Below this width
// the whole map is the only view.
const EXPLORER_MIN_WIDTH = 768;

// The map is fixed at 62 skills — the top progress bar's denominator.
const TOTAL_SKILLS = 62;

// How long the "Marked …" toast stays up. Purely a display timer; the mastered set is
// already persisted by the time it shows.
const TOAST_MS = 2800;

// Member-node count per category tag, computed once from the authoritative node data —
// the trailing count chip in the category navigator. Each node carries exactly one tag.
const CAT_COUNTS: Record<string, number> = (() => {
  const m: Record<string, number> = {};
  for (const n of MAP_NODES) m[n.tag] = (m[n.tag] ?? 0) + 1;
  return m;
})();

type ViewMode = 'map' | 'explorer';

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
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [isDesktop, setIsDesktop] = useState(true);

  // Category navigator (MapCategoryNav): pinned = the persistent filter,
  // catHover = the transient hover preview. The pinned category always wins, matching
  // the bundle (hovering another row while one is pinned does nothing).
  const [catPinned, setCatPinned] = useState<string | null>(null);
  const [catHover, setCatHover] = useState<string | null>(null);

  // Slugs the viewer may see a lesson video for (the SkillDetailPanel badges). Empty until
  // /api/teacher-videos resolves, and stays empty for non-teachers or on error.
  const [videoSlugs, setVideoSlugs] = useState<Set<string>>(() => new Set());

  // Transient "Marked <name> ✓" toast (template inline glue), shown when a skill is
  // newly marked mastered. null = hidden.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track whether the viewport is wide enough for the explorer. Read once on mount
  // and on resize; the explorer guard (below) folds this in so a narrow viewport
  // always falls back to the whole map.
  useEffect(() => {
    const check = () =>
      setIsDesktop((typeof window !== 'undefined' ? window.innerWidth : EXPLORER_MIN_WIDTH) >= EXPLORER_MIN_WIDTH);
    check();
    if (typeof window === 'undefined') return;
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const width = el.clientWidth || el.getBoundingClientRect().width || FALLBACK_WIDTH;
    // Finger or mouse? The pills are the map's primary control, so on a coarse
    // pointer they lay out at the 44px tap-target size. Guarded: no matchMedia
    // (jsdom/older browsers) simply means the mouse layout, as before.
    let touch = false;
    try {
      touch = typeof matchMedia === 'function' && matchMedia(COARSE_POINTER).matches;
    } catch {
      /* no matchMedia — keep the mouse layout */
    }

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

    setLayout(computeMapLayout(MAP_NODES, LEVELS, { width, measureText, density: DENSITY, touch }));
  }, []);

  useEffect(() => {
    recompute();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recompute());
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  // Re-lay-out if the pointer type itself changes (2-in-1 detaching its keyboard,
  // a tablet picking up a mouse) so tap targets follow the input device. Guarded:
  // no matchMedia, or the legacy no-addEventListener form, is simply a no-op.
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    let mq: MediaQueryList;
    try {
      mq = matchMedia(COARSE_POINTER);
    } catch {
      return;
    }
    if (typeof mq.addEventListener !== 'function') return;
    const onChange = () => recompute();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
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

  // Stay live when the mastered set changes OUTSIDE this component — so the map never
  // shows a stale count and nothing ever needs a manual refresh. Two sources:
  //   • `storage` — another TAB of this browser wrote the shared key (the browser only
  //     fires this in the *other* tabs, so it can never echo our own write).
  //   • MASTERED_ADOPTED_EVENT — MapSync pulled newer state from another DEVICE and
  //     adopted it. (This replaced a location.reload().)
  // Both just re-read the single source of truth, so they are idempotent and order-free.
  useEffect(() => {
    const resync = () => setMastered(readMastered());
    const onStorage = (e: StorageEvent) => {
      // A null key means the whole store was cleared — that concerns us too.
      if (e.key === null || e.key === MASTERED_KEY) resync();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(MASTERED_ADOPTED_EVENT, resync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(MASTERED_ADOPTED_EVENT, resync);
    };
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
      const adding = !next.has(id);
      if (adding) next.add(id);
      else next.delete(id);
      try {
        localStorage.setItem(MASTERED_KEY, JSON.stringify([...next]));
        // Deterministically wake MapSync on BOTH mark and unmark. The old bundle
        // relied on the map's incidental DOM churn (a childList mutation) to trip a
        // MutationObserver — which an unmark (attribute-only re-render, no toast)
        // never produced, silently dropping the unmark from cross-device sync.
        window.dispatchEvent(new Event(MASTERED_CHANGE_EVENT));
      } catch {
        /* ignore */
      }
      // Confirm only the positive action (marking), matching the bundle's toast.
      if (adding) setToast(`Marked ${NODE_BY_ID.get(id)?.name ?? 'skill'} ✓`);
      return next;
    });
  }, []);

  // Fetch once the slugs the viewer may see a lesson video for. Guarded — a failed or
  // absent response simply means no video badges (never an error surfaced to the panel).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/teacher-videos', { credentials: 'same-origin' });
        const d = r.ok ? await r.json() : null;
        const slugs: unknown = d && typeof d === 'object' ? (d as { slugs?: unknown }).slugs : null;
        if (alive && Array.isArray(slugs)) {
          setVideoSlugs(new Set(slugs.filter((s): s is string => typeof s === 'string')));
        }
      } catch {
        /* no badges */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Auto-dismiss the toast. The timer is display-only; the mastered set is already
  // persisted, so nothing is lost if the component unmounts first.
  useEffect(() => {
    if (!toast) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [toast]);

  // Hover wins over selection as the highlight focus (a transient preview), exactly
  // as the bundle does: `hover || (sel ? … )`.
  const focus = hover ?? selected;
  const rel = focus ? relatedTo(focus) : null;
  const focusNode = focus ? NODE_BY_ID.get(focus) : null;
  const selectedNode = selected ? NODE_BY_ID.get(selected) ?? null : null;
  const m = layout ? pageMargin(layout.width) : 0;

  // The category lens: a pinned category always wins over a hover preview (bundle
  // behaviour). When active it drives the dimming — matching-tag nodes light, the rest
  // dim — taking precedence over the relation-based dimming.
  const catActive = catPinned ?? catHover;

  // The explorer shows only when the user is in explorer mode, a node is selected,
  // and the viewport is desktop-width. Otherwise the whole map renders (so an empty
  // selection in explorer mode falls back to the map — where a skill can be picked).
  const explorerOn = viewMode === 'explorer' && !!selected && isDesktop;
  const exitExplorer = useCallback(() => {
    setViewMode('map');
    setHover(null);
  }, []);

  const edgeKind = (from: string, to: string): EdgeKind => {
    if (!focus) return 'base';
    if (to === focus) return 'prereq'; // focus is the dependent → this is a prereq edge (ember)
    if (from === focus) return 'unlock'; // focus is the dependency → this is an unlock edge (verd)
    return 'dim';
  };

  const masteredCount = mastered.size;

  return (
    <div className="tsm-map">
      {/* Top progress bar — mastered / 62 (template inline glue). */}
      <div
        className="tsm-progress"
        role="progressbar"
        aria-label="Skills mastered"
        aria-valuemin={0}
        aria-valuemax={TOTAL_SKILLS}
        aria-valuenow={masteredCount}
      >
        <i style={{ width: `${(masteredCount / TOTAL_SKILLS) * 100}%` }} />
      </div>

      <div className="tsm-header">
        <MapSearch nodes={MAP_NODES} levels={LEVELS} onPick={selectNode} />
        {isDesktop && (
          <div className="tsm-view" role="group" aria-label="View mode">
            <button
              type="button"
              className={`tsm-view-btn${!explorerOn ? ' on' : ''}`}
              aria-pressed={!explorerOn}
              data-view="map"
              onClick={() => setViewMode('map')}
            >
              Map
            </button>
            <button
              type="button"
              className={`tsm-view-btn${explorerOn ? ' on' : ''}`}
              aria-pressed={explorerOn}
              data-view="explorer"
              title={selected ? undefined : 'Select a skill to explore its graph'}
              onClick={() => setViewMode('explorer')}
            >
              Explorer
            </button>
          </div>
        )}
      </div>

      <div className="tsm-body">
        {explorerOn ? (
          <MapExplorer
            centerId={selected!}
            mastered={mastered}
            onSelect={selectNode}
            onExitToMap={exitExplorer}
          />
        ) : (
          <>
          {isDesktop && (
            <MapCategoryNav
              counts={CAT_COUNTS}
              pinned={catPinned}
              onHover={setCatHover}
              onPin={(tag) => setCatPinned((p) => (p === tag ? null : tag))}
            />
          )}
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
                const catMatch = catActive ? n.tag === catActive : false;
                // Category filter (when active) overrides relation dimming.
                const dim = catActive ? !catMatch : rel ? !rel.has(box.id) : false;
                const cls = ['tsm-node'];
                if (isSel) cls.push('on');
                if (isHov) cls.push('hov');
                if (isPre) cls.push('pre');
                if (isKid) cls.push('kid');
                if (isDone) cls.push('done');
                if (catMatch) cls.push('cat');
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
          </>
        )}

        <SkillDetailPanel
          node={selectedNode}
          levels={LEVELS}
          mastered={mastered}
          videoSlugs={videoSlugs}
          onSelect={selectNode}
          onToggleMastered={toggleMastered}
        />
      </div>

      {/* Transient "Marked <name> ✓" confirmation (template inline glue). */}
      {toast && (
        <div className="tsm-toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* First-visit welcome (MapOnboarding), self-gated on localStorage. */}
      <MapOnboarding />
    </div>
  );
}

export default TangoMap;
