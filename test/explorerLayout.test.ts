import { describe, test, expect } from 'vitest';
import { layeredLayout, radialLayout, type ExplorerNode } from '@/src/lib/explorerLayout';
import { NODE_BY_ID, dependentsOf } from '@/src/lib/mapGraph';

// Deterministic stand-in for canvas measureText: width grows with text length.
// (The engine takes the measurer as an argument so layout is pure/testable.)
const measure = (t: string) => t.length * 8 + 24;

// A viewport wide/tall enough that the radial ring never hits the margin clamp,
// so ported radii stay exact.
const OPTS = { width: 1200, height: 800, measureText: measure };

// 'cross' has 2 direct prerequisites and 5 direct unlocks — a good spread.
const CENTER = 'cross';
const PREREQS = NODE_BY_ID.get(CENTER)!.deps;
const UNLOCKS = dependentsOf(CENTER);

const byId = (nodes: ExplorerNode[]) => new Map(nodes.map((n) => [n.id, n]));
const cx = (n: ExplorerNode) => n.x + n.w / 2;
const cy = (n: ExplorerNode) => n.y + n.h / 2;

describe('layeredLayout', () => {
  test('places the centre node plus every prerequisite and unlock', () => {
    const { nodes, center } = layeredLayout(CENTER, OPTS);
    expect(center).toBe(CENTER);
    const map = byId(nodes);
    expect(map.get(CENTER)!.role).toBe('center');
    expect(nodes.length).toBe(1 + PREREQS.length + UNLOCKS.length);
    for (const id of PREREQS) expect(map.get(id)!.role).toBe('prereq');
    for (const id of UNLOCKS) expect(map.get(id)!.role).toBe('unlock');
    for (const n of nodes) {
      for (const v of [n.x, n.y, n.w, n.h]) expect(Number.isFinite(v)).toBe(true);
      expect(n.w).toBeGreaterThan(0);
      expect(n.h).toBeGreaterThan(0);
    }
  });

  test('prerequisites sit in the left column, unlocks in the right', () => {
    const { nodes } = layeredLayout(CENTER, OPTS);
    const map = byId(nodes);
    const cCenter = cx(map.get(CENTER)!);
    for (const id of PREREQS) expect(cx(map.get(id)!)).toBeLessThan(cCenter);
    for (const id of UNLOCKS) expect(cx(map.get(id)!)).toBeGreaterThan(cCenter);
  });

  test('one directed edge per prereq→centre and centre→unlock, with an arrowhead', () => {
    const { edges } = layeredLayout(CENTER, OPTS);
    expect(edges.length).toBe(PREREQS.length + UNLOCKS.length);

    const prereqEdges = edges.filter((e) => e.kind === 'prereq');
    expect(prereqEdges.length).toBe(PREREQS.length);
    for (const e of prereqEdges) {
      expect(e.to).toBe(CENTER); // prereq → centre
      expect(PREREQS).toContain(e.from);
    }
    const unlockEdges = edges.filter((e) => e.kind === 'unlock');
    expect(unlockEdges.length).toBe(UNLOCKS.length);
    for (const e of unlockEdges) {
      expect(e.from).toBe(CENTER); // centre → unlock
      expect(UNLOCKS).toContain(e.to);
    }
    for (const e of edges) {
      expect(e.d.startsWith('M')).toBe(true);
      expect(e.d).toContain('C'); // layered edges are cubic Béziers
      expect(isValidPath(e.arrow)).toBe(true);
    }
  });

  test('is deterministic (no random, no clock)', () => {
    expect(layeredLayout(CENTER, OPTS)).toEqual(layeredLayout(CENTER, OPTS));
  });
});

describe('radialLayout', () => {
  test('centres the selected node and rings every neighbour at a constant radius', () => {
    const { nodes, center } = radialLayout(CENTER, OPTS);
    expect(center).toBe(CENTER);
    const map = byId(nodes);
    const c = map.get(CENTER)!;
    expect(c.role).toBe('center');

    const neighbours = [...PREREQS, ...UNLOCKS];
    expect(nodes.length).toBe(1 + neighbours.length);

    const ccx = cx(c);
    const ccy = cy(c);
    const radii = neighbours.map((id) => Math.hypot(cx(map.get(id)!) - ccx, cy(map.get(id)!) - ccy));
    const r0 = radii[0];
    expect(r0).toBeGreaterThan(0);
    for (const r of radii) expect(Math.abs(r - r0)).toBeLessThan(0.5); // equidistant
  });

  test('a node with no neighbours yields just the centre and no edges', () => {
    const { nodes, edges } = radialLayout('__no_such_node__', OPTS);
    expect(nodes.length).toBe(1);
    expect(nodes[0].role).toBe('center');
    expect(edges.length).toBe(0);
  });

  test('directed edges carry a valid quadratic path and arrowhead', () => {
    const { edges } = radialLayout(CENTER, OPTS);
    expect(edges.length).toBe(PREREQS.length + UNLOCKS.length);
    for (const e of edges) {
      expect(e.d.startsWith('M')).toBe(true);
      expect(e.d).toContain('Q'); // radial edges are quadratic
      expect(isValidPath(e.arrow)).toBe(true);
    }
  });

  test('is deterministic (no random, no clock)', () => {
    expect(radialLayout(CENTER, OPTS)).toEqual(radialLayout(CENTER, OPTS));
  });
});

/** An arrowhead is a closed triangle: starts M, has two L segments, closes Z, all-finite. */
function isValidPath(d: string): boolean {
  if (!/^M/.test(d) || !/Z$/.test(d)) return false;
  if ((d.match(/L/g) ?? []).length !== 2) return false;
  const nums = d.match(/-?\d+(\.\d+)?/g) ?? [];
  return nums.length >= 6 && nums.every((s) => Number.isFinite(Number(s)));
}
