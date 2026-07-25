import { describe, test, expect } from 'vitest';
import { computeMapLayout, edgePath, type NodeBox } from '@/src/lib/mapLayout';
import { MAP_NODES, LEVELS } from '@/src/data/mapNodes';

// Deterministic stand-in for canvas measureText: width grows with text length.
// (The real engine takes the measurer as an argument so layout is pure/testable.)
const measure = (t: string) => t.length * 8 + 24;

const layoutAt = (width: number, density: 'compact' | 'comfortable' = 'compact') =>
  computeMapLayout(MAP_NODES, LEVELS, { width, measureText: measure, density });

/** Group boxes into rows keyed by their (level, y) — same y === same visual row. */
function rows(nodes: NodeBox[]): NodeBox[][] {
  const byRow = new Map<string, NodeBox[]>();
  for (const b of nodes) {
    const key = `${b.level}@${b.y}`;
    (byRow.get(key) ?? byRow.set(key, []).get(key)!).push(b);
  }
  return [...byRow.values()];
}

describe('computeMapLayout — node boxes', () => {
  test('every node gets exactly one finite box', () => {
    const { nodes } = layoutAt(1200);
    expect(nodes.length).toBe(MAP_NODES.length); // 62
    expect(new Set(nodes.map((n) => n.id)).size).toBe(MAP_NODES.length);
    for (const b of nodes) {
      for (const v of [b.x, b.y, b.w, b.h]) expect(Number.isFinite(v)).toBe(true);
      expect(b.w).toBeGreaterThan(0);
      expect(b.h).toBeGreaterThan(0);
    }
  });

  test('boxes within the same row never overlap horizontally', () => {
    const { nodes } = layoutAt(1000);
    for (const row of rows(nodes)) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].x, 'boxes overlap within a row').toBeGreaterThanOrEqual(
          sorted[i - 1].x + sorted[i - 1].w,
        );
      }
    }
  });

  test('non-leading pills stay within the right margin (the wrap rule holds)', () => {
    const width = 1000;
    const { nodes } = layoutAt(width);
    for (const row of rows(nodes)) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      const margin = sorted[0].x; // leading pill sits at the left margin
      // Every pill after the first fits inside width - margin; only a lone
      // leading pill wider than the row is allowed to overflow.
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].x + sorted[i].w).toBeLessThanOrEqual(width - margin);
      }
    }
  });

  test('a narrower width wraps bands into more rows', () => {
    const wide = layoutAt(1600);
    const narrow = layoutAt(640);
    expect(rows(narrow.nodes).length).toBeGreaterThan(rows(wide.nodes).length);
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  test('y increases with level: every band sits strictly below the one above', () => {
    const { nodes } = layoutAt(1200);
    const maxYByLevel = new Map<number, number>();
    const minYByLevel = new Map<number, number>();
    for (const b of nodes) {
      maxYByLevel.set(b.level, Math.max(maxYByLevel.get(b.level) ?? -Infinity, b.y));
      minYByLevel.set(b.level, Math.min(minYByLevel.get(b.level) ?? Infinity, b.y));
    }
    for (let l = 1; l < LEVELS.length; l++) {
      expect(minYByLevel.get(l)!, `level ${l} must start below level ${l - 1}`).toBeGreaterThan(
        maxYByLevel.get(l - 1)!,
      );
    }
  });

  test('total height bounds the lowest node', () => {
    const { nodes, height } = layoutAt(1200);
    const lowest = Math.max(...nodes.map((b) => b.y + b.h));
    expect(height).toBeGreaterThanOrEqual(lowest);
  });

  test('bands: one per level, labelled and strictly descending', () => {
    const { bands } = layoutAt(1200);
    expect(bands.length).toBe(LEVELS.length); // 10
    for (let i = 0; i < bands.length; i++) {
      expect(bands[i].level).toBe(i);
      expect(bands[i].label).toBe(`LEVEL ${i + 1} · ${LEVELS[i].toUpperCase()}`);
      if (i > 0) expect(bands[i].y).toBeGreaterThan(bands[i - 1].y);
    }
  });

  test('reported width echoes the requested width', () => {
    expect(layoutAt(1234).width).toBe(1234);
  });
});

describe('computeMapLayout — edges', () => {
  test('one edge per dependency (110 across the real data)', () => {
    const totalDeps = MAP_NODES.reduce((n, node) => n + node.deps.length, 0);
    expect(totalDeps).toBe(110);
    expect(layoutAt(1200).edges.length).toBe(110);
  });

  test('from/to reference real nodes and a real prerequisite edge', () => {
    const { edges } = layoutAt(1200);
    const byId = new Map(MAP_NODES.map((n) => [n.id, n]));
    for (const e of edges) {
      const to = byId.get(e.to);
      expect(to, `edge to unknown node ${e.to}`).toBeDefined();
      expect(to!.deps, `edge ${e.from}->${e.to} is not a real prerequisite`).toContain(e.from);
    }
  });

  test('every path string is a valid cubic-Bézier (starts M, has one C)', () => {
    for (const e of layoutAt(1200).edges) {
      expect(e.d.startsWith('M')).toBe(true);
      expect(e.d).toContain('C');
    }
  });

  test('sameLevel classification matches same-row geometry, and both kinds occur', () => {
    const { nodes, edges } = layoutAt(1200);
    const box = new Map(nodes.map((b) => [b.id, b]));
    for (const e of edges) {
      const a = box.get(e.from)!;
      const b = box.get(e.to)!;
      const sameRow = Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)) < 2;
      expect(e.sameLevel).toBe(sameRow);
    }
    expect(edges.some((e) => e.sameLevel), 'expected at least one same-level arc').toBe(true);
    expect(edges.some((e) => !e.sameLevel), 'expected at least one cross-level curve').toBe(true);
  });
});

describe('edgePath helper', () => {
  const A: NodeBox = { id: 'a', x: 100, y: 100, w: 80, h: 28, level: 0 };

  test('same-row boxes produce the arc-lift path (control points above)', () => {
    const B: NodeBox = { id: 'b', x: 300, y: 100, w: 80, h: 28, level: 0 };
    const { d, sameLevel } = edgePath(A, B);
    expect(sameLevel).toBe(true);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('C');
  });

  test('boxes on different rows produce the S-curve path', () => {
    const B: NodeBox = { id: 'b', x: 300, y: 400, w: 80, h: 28, level: 3 };
    const { d, sameLevel } = edgePath(A, B);
    expect(sameLevel).toBe(false);
    expect(d.startsWith('M')).toBe(true);
    expect(d).toContain('C');
  });
});

describe('computeMapLayout — determinism', () => {
  test('identical inputs yield identical output (no random, no clock)', () => {
    expect(layoutAt(1100)).toEqual(layoutAt(1100));
  });

  test('compact vs comfortable density change the layout deterministically', () => {
    const a = layoutAt(1100, 'compact');
    const b = layoutAt(1100, 'comfortable');
    expect(a).toEqual(layoutAt(1100, 'compact')); // still deterministic per-density
    expect(a).not.toEqual(b); // density actually matters
  });
});
