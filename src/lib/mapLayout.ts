import type { MapNode } from '@/src/data/mapNodes';

// Pure port of the map bundle's `buildMap` flow layout + edge geometry.
//
// Source of truth: the decoded bundle template, `class Component extends DCLogic`,
// method `buildMap` (template.html ~L1090–1220). Line numbers cited below are that
// file. The port is deterministic — no DOM, no canvas, no Math.random, no Date —
// by injecting the text measurer that the bundle read from a canvas 2d context.
//
// Two deliberate departures from the bundle, both required to make the layout a
// pure function of (nodes, width, measurer, density):
//   1. The desktop (non-touch) constant branch is used. The bundle also has a
//      touch branch (state.vw < 768) that only changes pill height / gaps / font;
//      it is a viewport decision, not part of the core flow layout, so it is out
//      of scope for this decision-free foundation.
//   2. The band stack starts below a fixed HEADER_H (the static title + progress
//      bar, template L1104 + L1114). The bundle's "NEXT UP" chip strip that can
//      follow is driven by per-user mastery state, which a pure layout cannot know;
//      it belongs to a later stateful phase. Relative geometry (pill flow, wrap,
//      band spacing, edges) is unaffected by this constant offset.

export type NodeBox = { id: string; x: number; y: number; w: number; h: number; level: number };
export type EdgePath = { from: string; to: string; d: string; sameLevel: boolean };
export type Band = { level: number; y: number; label: string };
export type MapLayout = {
  nodes: NodeBox[];
  edges: EdgePath[];
  width: number;
  height: number;
  bands: Band[];
};
export type LayoutOpts = {
  width: number;
  measureText: (text: string) => number;
  density?: 'compact' | 'comfortable';
};

/** The desktop layout constants for a density, mirrored from template L1095–1100. */
function constants(width: number, dense: boolean) {
  return {
    // L1095: page margin, clamped and scaled with width.
    m: Math.max(12, Math.min(dense ? 22 : 44, width * (dense ? 0.018 : 0.03))),
    // L1096: pill height (non-touch branch).
    pillH: dense ? 28 : 34,
    // L1097: inter-pill gaps (non-touch branch).
    gapX: dense ? 6 : 8,
    gapY: dense ? 6 : 9,
    // L1099: horizontal padding added to each pill's measured text width.
    pad: dense ? 22 : 30,
    // L1100: level-header height and the gap after each level band.
    headH: dense ? 20 : 26,
    secGap: dense ? 13 : 26,
    // L1104 (sy=16) + L1114 (sy += dense?24:27): static title + progress-bar header.
    // The stateful "NEXT UP" strip (L1120–1138) is intentionally excluded — see note.
    headerH: 16 + (dense ? 24 : 27),
  };
}

/**
 * Build the cubic-Bézier `d` for one edge, dependency (`from`) → dependent (`to`).
 * Port of template L1163–1169:
 *   - same visual row (|centerY diff| < 2): an arc that lifts above both pills
 *     (L1164–1165); control-point rise = min(46, 16 + |Δx|·0.08).
 *   - different rows: a vertical S-curve between the two pills' facing edges
 *     (L1167–1168); control offset c = max(18, (Δy)·0.5).
 * Coordinates are rounded to 1 dp exactly as the bundle does (`.toFixed(1)`).
 */
export function edgePath(from: NodeBox, to: NodeBox): { d: string; sameLevel: boolean } {
  const ax = from.x + from.w / 2; // pill centres (the bundle stores centres in `pos`)
  const ay = from.y + from.h / 2;
  const bx = to.x + to.w / 2;
  const by = to.y + to.h / 2;

  const sameLevel = Math.abs(ay - by) < 2; // L1163
  if (sameLevel) {
    const lift = Math.min(46, 16 + Math.abs(bx - ax) * 0.08); // L1164
    const aTop = ay - from.h / 2;
    const bTop = by - to.h / 2;
    // L1165
    const d = `M${ax.toFixed(1)} ${aTop.toFixed(1)} C${ax.toFixed(1)} ${(aTop - lift).toFixed(1)}, ${bx.toFixed(1)} ${(bTop - lift).toFixed(1)}, ${bx.toFixed(1)} ${bTop.toFixed(1)}`;
    return { d, sameLevel };
  }
  // L1167–1168
  const y1 = ay + from.h / 2; // bottom edge of the upper pill
  const y2 = by - to.h / 2; // top edge of the lower pill
  const c = Math.max(18, (y2 - y1) * 0.5);
  const d = `M${ax.toFixed(1)} ${y1.toFixed(1)} C${ax.toFixed(1)} ${(y1 + c).toFixed(1)}, ${bx.toFixed(1)} ${(y2 - c).toFixed(1)}, ${bx.toFixed(1)} ${y2.toFixed(1)}`;
  return { d, sameLevel };
}

/**
 * Lay the nodes out into level bands (top → bottom), flowing pills left → right
 * and wrapping to a new row when a pill would cross the right margin, then wire
 * every dependency as a cubic-Bézier edge. Pure and deterministic.
 *
 * @param nodes   the map nodes (placed in array order within each level)
 * @param levels  level headings; the array index is the level number
 * @param opts    width, injected `measureText`, and density (default 'compact')
 */
export function computeMapLayout(nodes: MapNode[], levels: string[], opts: LayoutOpts): MapLayout {
  const { width: W, measureText, density = 'compact' } = opts;
  const dense = density === 'compact';
  const { m, pillH, gapX, gapY, pad, headH, secGap, headerH } = constants(W, dense);

  const boxes: NodeBox[] = [];
  const byId = new Map<string, NodeBox>();
  const bands: Band[] = [];

  // --- flow layout: L1139–1153 ---
  let y = headerH;
  for (let level = 0; level < levels.length; level++) {
    bands.push({ level, y, label: `LEVEL ${level + 1} · ${levels[level].toUpperCase()}` }); // L1142
    y += headH; // L1143
    let x = m; // L1144
    for (const n of nodes) {
      if (n.level !== level) continue; // L1146
      const w = Math.round(measureText(n.name)) + pad; // L1147
      // L1148: wrap when the pill crosses the right margin — but never on the
      // first pill of a row (x > m), so an over-wide lone pill still lands.
      if (x + w > W - m && x > m) {
        x = m;
        y += pillH + gapY;
      }
      const box: NodeBox = { id: n.id, x, y, w, h: pillH, level }; // top-left origin
      boxes.push(box);
      byId.set(n.id, box);
      x += w + gapX; // L1150
    }
    y += pillH + secGap; // L1152
  }

  // Total document height: L1155 with no selection (sel ? 96 : 8).
  const height = y + 8;

  // --- edges: L1160–1177 ---
  const edges: EdgePath[] = [];
  for (const n of nodes) {
    for (const dep of n.deps) {
      const a = byId.get(dep); // dependency (edge source)
      const b = byId.get(n.id); // dependent node (edge target)
      if (!a || !b) continue; // L1161
      const { d, sameLevel } = edgePath(a, b);
      edges.push({ from: dep, to: n.id, d, sameLevel });
    }
  }

  return { nodes: boxes, edges, width: W, height, bands };
}
