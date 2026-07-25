import { NODE_BY_ID, dependentsOf } from '@/src/lib/mapGraph';

// Pure layout engine for the EXPLORER view — the dependency-graph view shown for a
// single selected skill. This is the id-space companion to src/lib/mapLayout.ts
// (which lays out the whole map). Two sub-layouts, both ported from the decoded
// bundle's `buildGraph` (template.html ~L1227–1345):
//
//   • layeredLayout — three columns: direct prerequisites (left) | the selected
//     node (centre) | direct unlocks (right). Column x-positions and the vertical
//     `dist` spacing are ported from template L1292–1299; directed edges flow
//     prereq→centre and centre→unlock as a horizontal cubic Bézier (L1327–1330).
//
//   • radialLayout — the selected node at the centre, every direct neighbour
//     (prereqs + unlocks) placed on a ring of radius R at angle i/n·2π (the trig +
//     radius ported from L1276/L1282), with a slightly bowed quadratic edge whose
//     endpoints sit on the two boxes' boundaries (edgePt, L1310–1315; the Q curve
//     L1320–1325).
//
// Both are deterministic: no DOM, no canvas, no Math.random, no Date. The text
// measurer is injected (as in computeMapLayout) so widths are reproducible. Boxes
// are emitted with a top-left (x,y) origin to match mapLayout's NodeBox and the
// React render (`left: box.x, top: box.y`); edge geometry is computed internally
// from box centres, exactly as the bundle's `pos` map stored them.

export type ExplorerRole = 'center' | 'prereq' | 'unlock';

/** A positioned explorer node. `x,y` is the top-left corner (w×h box). */
export type ExplorerNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  role: ExplorerRole;
  name: string;
};

/** A directed explorer edge with its curve `d` and a filled arrowhead triangle. */
export type ExplorerEdge = {
  from: string;
  to: string;
  kind: 'prereq' | 'unlock';
  d: string;
  arrow: string;
};

export type ExplorerLayout = {
  nodes: ExplorerNode[];
  edges: ExplorerEdge[];
  width: number;
  height: number;
  center: string;
};

export type ExplorerOpts = {
  width: number;
  height: number;
  measureText: (text: string) => number;
};

/** Internal box with a centre origin — the form the bundle's `pos` map stored. */
type Box = { id: string; cx: number; cy: number; w: number; h: number; role: ExplorerRole; name: string };

/**
 * Distribute `n` items across [top, bot], spacing clamped to [minP, maxP] and the
 * whole run centred. Direct port of the bundle's `dist` (template L1078–1085).
 */
function dist(n: number, top: number, bot: number, minP: number, maxP: number): number[] {
  if (!n) return [];
  if (n === 1) return [(top + bot) / 2];
  let p = Math.min(maxP, (bot - top) / (n - 1));
  if (p < minP) p = minP;
  const c = (top + bot) / 2;
  const s = c - (p * (n - 1)) / 2;
  return Array.from({ length: n }, (_, i) => s + p * i);
}

/**
 * A filled arrowhead triangle whose tip is at (x,y), opening back along `ang` (the
 * incoming edge direction). Direct port of the bundle's `arrowPath` (L1086–1088);
 * coordinates rounded to 2 dp for a stable, compact `d`.
 */
function arrowPath(x: number, y: number, ang: number, size: number): string {
  const a1 = ang + 2.6;
  const a2 = ang - 2.6;
  const r = (v: number) => Number(v.toFixed(2));
  return `M${r(x)} ${r(y)} L${r(x + size * Math.cos(a1))} ${r(y + size * Math.sin(a1))} L${r(x + size * Math.cos(a2))} ${r(y + size * Math.sin(a2))} Z`;
}

/**
 * The point on box `a`'s boundary that lies toward box `b`'s centre, nudged out by
 * 3% so the edge visibly clears the pill. Port of the bundle's `edgePt` (L1310–1315).
 */
function edgePt(a: Box, b: Box): { x: number; y: number } {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const t = Math.min(a.w / 2 / Math.max(Math.abs(ux), 0.001), a.h / 2 / Math.max(Math.abs(uy), 0.001));
  return { x: a.cx + ux * t * 1.03, y: a.cy + uy * t * 1.03 };
}

/** Box width fitted to its label, clamped to [min, cap]. Uses the injected measurer. */
function fit(name: string, cap: number, pad: number, min: number, measure: (t: string) => number): number {
  return Math.max(min, Math.min(cap, Math.round(measure(name)) + pad));
}

/** Resolve a node id to its display name (falls back to the id for unknown ids). */
function nameOf(id: string): string {
  return NODE_BY_ID.get(id)?.name ?? id;
}

function toNode(b: Box): ExplorerNode {
  return { id: b.id, x: b.cx - b.w / 2, y: b.cy - b.h / 2, w: b.w, h: b.h, role: b.role, name: b.name };
}

/** The centre node + its direct prerequisites and unlocks (defensive for unknown ids). */
function neighbourhood(centerId: string): { name: string; prereqs: string[]; unlocks: string[] } {
  const node = NODE_BY_ID.get(centerId);
  return { name: node?.name ?? centerId, prereqs: node?.deps ?? [], unlocks: dependentsOf(centerId) };
}

/**
 * Three-column layered layout: prerequisites left, the selected node centre, unlocks
 * right. Port of the bundle's non-radial `buildGraph` branch (template L1291–1308),
 * reduced from its four columns (foundations/direct/selected/unlocks) to the three
 * the explorer view needs.
 */
export function layeredLayout(centerId: string, opts: ExplorerOpts): ExplorerLayout {
  const { width: W, height: H, measureText } = opts;
  const { name, prereqs, unlocks } = neighbourhood(centerId);

  const top = 58; // L1251
  const bot = H - 22;
  const m = Math.max(14, Math.min(44, W * 0.025)); // L1251

  // Column widths/heights (desktop branch, L1258–1260).
  const sc = Math.max(0.78, Math.min(1, W / 950));
  const wD = Math.round(186 * sc);
  const hD = 60;
  const wS = Math.round(218 * sc);
  const hS = 94;
  const wU = Math.round(184 * sc);
  const hU = 52;

  // Horizontal placement, adapted from L1292–1295 to three columns (two gaps).
  const totalW = wD + wS + wU;
  let gap = (W - 2 * m - totalW) / 2;
  let x0 = m;
  if (gap > 150) {
    gap = 150;
    x0 = (W - totalW - 2 * gap) / 2;
  }
  const xD = x0 + wD / 2;
  const xS = x0 + wD + gap + wS / 2;
  const xU = x0 + wD + gap + wS + gap + wU / 2;
  const midY = (top + bot) / 2;

  const boxes: Box[] = [];
  boxes.push({ id: centerId, cx: xS, cy: midY, w: fit(name, wS, 30, 150, measureText), h: hS, role: 'center', name });

  // L1297 / L1299: vertically distributed columns.
  dist(prereqs.length, top, bot, hD + 8, 84).forEach((y, i) => {
    const id = prereqs[i];
    const nm = nameOf(id);
    boxes.push({ id, cx: xD, cy: y, w: fit(nm, wD, 24, 96, measureText), h: hD, role: 'prereq', name: nm });
  });
  dist(unlocks.length, top, bot, hU + 4, 76).forEach((y, i) => {
    const id = unlocks[i];
    const nm = nameOf(id);
    boxes.push({ id, cx: xU, cy: y, w: fit(nm, wU, 24, 96, measureText), h: hU, role: 'unlock', name: nm });
  });

  const pos = new Map(boxes.map((b) => [b.id, b]));
  const center = pos.get(centerId)!;
  const edges: ExplorerEdge[] = [];
  for (const id of prereqs) {
    const a = pos.get(id);
    if (a) edges.push(layeredEdge(a, center, id, centerId, 'prereq'));
  }
  for (const id of unlocks) {
    const b = pos.get(id);
    if (b) edges.push(layeredEdge(center, b, centerId, id, 'unlock'));
  }

  return { nodes: boxes.map(toNode), edges, width: W, height: H, center: centerId };
}

/** Horizontal cubic Bézier from `a`'s right edge to `b`'s left edge (L1327–1330). */
function layeredEdge(a: Box, b: Box, from: string, to: string, kind: 'prereq' | 'unlock'): ExplorerEdge {
  const p1 = { x: a.cx + a.w / 2, y: a.cy };
  const p2 = { x: b.cx - b.w / 2, y: b.cy };
  const c = (p2.x - p1.x) * 0.46;
  const d = `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} C${(p1.x + c).toFixed(1)} ${p1.y.toFixed(1)}, ${(p2.x - c).toFixed(1)} ${p2.y.toFixed(1)}, ${(p2.x - 1).toFixed(1)} ${p2.y.toFixed(1)}`;
  const arrow = arrowPath(p2.x + 1, p2.y, 0, 7);
  return { from, to, kind, d, arrow };
}

/**
 * Radial layout: the selected node centred, its direct neighbours on a ring of
 * radius R at angle i/n·2π. Radius ported from the bundle's R1 (template L1282);
 * the trig from the `place` helper (L1276). Prereq edges point into the centre,
 * unlock edges point out of it.
 */
export function radialLayout(centerId: string, opts: ExplorerOpts): ExplorerLayout {
  const { width: W, height: H, measureText } = opts;
  const { name, prereqs, unlocks } = neighbourhood(centerId);

  const top = 58;
  const bot = H - 22;
  const m = Math.max(14, Math.min(44, W * 0.025));
  const wS = 202; // L1256 (radial branch)
  const hS = 88;
  const wN = 152;
  const hN = 50;

  const cx = W * 0.5; // L1269
  const cy = top + (bot - top) / 2;
  const R = Math.max(185, Math.min(W * 0.28, (bot - top) * 0.44, 330)); // L1282

  const boxes: Box[] = [];
  boxes.push({ id: centerId, cx, cy, w: fit(name, wS, 30, 150, measureText), h: hS, role: 'center', name });

  const neighbours: Array<{ id: string; role: 'prereq' | 'unlock' }> = [
    ...prereqs.map((id) => ({ id, role: 'prereq' as const })),
    ...unlocks.map((id) => ({ id, role: 'unlock' as const })),
  ];
  const n = neighbours.length;
  neighbours.forEach((nb, i) => {
    const a = (i / n) * Math.PI * 2; // angle = i/n·2π
    const nm = nameOf(nb.id);
    const w = fit(nm, wN, 22, 90, measureText);
    // Ring position (L1276), then clamp inside the page margins (L1277–1278).
    let x = cx + R * Math.cos(a);
    let y = cy + R * Math.sin(a);
    x = Math.max(m + w / 2, Math.min(W - m - w / 2, x));
    y = Math.max(top + hN / 2, Math.min(bot - hN / 2, y));
    boxes.push({ id: nb.id, cx: x, cy: y, w, h: hN, role: nb.role, name: nm });
  });

  const pos = new Map(boxes.map((b) => [b.id, b]));
  const center = pos.get(centerId)!;
  const edges: ExplorerEdge[] = [];
  for (const id of prereqs) {
    const a = pos.get(id);
    if (a) edges.push(radialEdge(a, center, id, centerId, 'prereq', H, top));
  }
  for (const id of unlocks) {
    const b = pos.get(id);
    if (b) edges.push(radialEdge(center, b, centerId, id, 'unlock', H, top));
  }

  return { nodes: boxes.map(toNode), edges, width: W, height: H, center: centerId };
}

/** Slightly bowed quadratic edge between two boxes' boundaries (L1320–1325). */
function radialEdge(a: Box, b: Box, from: string, to: string, kind: 'prereq' | 'unlock', H: number, top: number): ExplorerEdge {
  const p1 = edgePt(a, b);
  const p2 = edgePt(b, a);
  const mx = (p1.x + p2.x) / 2 + (H / 2 + top / 2 - (p1.y + p2.y) / 2) * 0.1;
  const my = (p1.y + p2.y) / 2;
  const d = `M${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  const ang = Math.atan2(p2.y - my, p2.x - mx);
  const arrow = arrowPath(p2.x, p2.y, ang, 7);
  return { from, to, kind, d, arrow };
}
