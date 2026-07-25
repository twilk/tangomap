import { describe, test, expect } from 'vitest';
import { markerGrid, serialToMarkerId, MARKER_MAX } from '@/src/lib/arMarker';
import { OneEuroFilter } from '@/src/lib/oneEuro';
import { matrix3dForQuad, makeProjection, applyProjection } from '@/src/lib/homography';

const parseM = (s: string): number[] =>
  s.replace(/^matrix3d\(|\)$/g, '').split(',').map(Number);

describe('arMarker', () => {
  test('serial maps to a marker id only inside the dictionary', () => {
    expect(serialToMarkerId(1)).toBe(1);
    expect(serialToMarkerId(0)).toBe(0);
    expect(serialToMarkerId(MARKER_MAX)).toBe(1023);
    expect(serialToMarkerId(MARKER_MAX + 1)).toBeNull();
    expect(serialToMarkerId(-1)).toBeNull();
    expect(serialToMarkerId(1.5)).toBeNull();
  });

  test('marker grid has a black border and codeword interior', () => {
    const g = markerGrid(0);
    // 7×7, black (0) border on all edges.
    expect(g.length).toBe(7);
    for (let i = 0; i < 7; i++) {
      expect(g[0][i]).toBe(0);
      expect(g[6][i]).toBe(0);
      expect(g[i][0]).toBe(0);
      expect(g[i][6]).toBe(0);
    }
    // id 0 → every interior row is the '00' codeword [1,0,0,0,0].
    for (let row = 1; row <= 5; row++) {
      expect(g[row].slice(1, 6)).toEqual([1, 0, 0, 0, 0]);
    }
  });

  test('different ids produce different grids', () => {
    expect(markerGrid(42)).not.toEqual(markerGrid(0));
  });
});

describe('OneEuroFilter', () => {
  test('a constant signal passes through unchanged', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.01 });
    let y = 0;
    for (let i = 0; i < 10; i++) y = f.filter(100, i / 60);
    expect(y).toBeCloseTo(100, 3);
  });

  test('a step is smoothed, not passed through instantly', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0 });
    f.filter(0, 0);
    const y = f.filter(100, 1 / 60);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(100); // lag ⇒ below the target on the first jump
  });
});

describe('matrix3dForQuad', () => {
  test('a translated same-size quad yields a pure translation', () => {
    const m = parseM(matrix3dForQuad(100, 140, [10, 20], [110, 20], [110, 160], [10, 160]));
    expect(m[0]).toBeCloseTo(1, 6); // scale x
    expect(m[5]).toBeCloseTo(1, 6); // scale y
    expect(m[12]).toBeCloseTo(10, 6); // translate x
    expect(m[13]).toBeCloseTo(20, 6); // translate y
    expect(m[3]).toBeCloseTo(0, 6); // no perspective
    expect(m[7]).toBeCloseTo(0, 6);
  });

  test('a doubled quad yields a 2× scale', () => {
    const m = parseM(matrix3dForQuad(100, 140, [0, 0], [200, 0], [200, 280], [0, 280]));
    expect(m[0]).toBeCloseTo(2, 6);
    expect(m[5]).toBeCloseTo(2, 6);
    expect(m[12]).toBeCloseTo(0, 6);
    expect(m[13]).toBeCloseTo(0, 6);
  });
});

describe('makeProjection / applyProjection', () => {
  const UNIT = [0, 0, 1, 0, 1, 1, 0, 1]; // TL, TR, BR, BL

  test('identity projection maps points to themselves', () => {
    const h = makeProjection(UNIT, UNIT);
    expect(applyProjection(h, 0.5, 0.5).map((n) => +n.toFixed(6))).toEqual([0.5, 0.5]);
    expect(applyProjection(h, 0.3, 0.7).map((n) => +n.toFixed(6))).toEqual([0.3, 0.7]);
  });

  test('unit square → a translated, scaled rect maps corners and centre', () => {
    const h = makeProjection(UNIT, [10, 20, 110, 20, 110, 160, 10, 160]);
    const [x0, y0] = applyProjection(h, 0, 0);
    const [x1, y1] = applyProjection(h, 1, 1);
    const [cx, cy] = applyProjection(h, 0.5, 0.5);
    expect([x0, y0].map((n) => +n.toFixed(4))).toEqual([10, 20]);
    expect([x1, y1].map((n) => +n.toFixed(4))).toEqual([110, 160]);
    expect([cx, cy].map((n) => +n.toFixed(4))).toEqual([60, 90]);
  });
});
