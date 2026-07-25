// 2D projective transform → CSS `matrix3d`, so a flat card image can be locked
// onto the four detected marker corners in correct perspective with zero WebGL.
// Classic adjugate method for the general 2D projection (after Steven Wittens'
// acko.net "matrix3d from a quad"); pure math → unit-tested against known quads.

/** 3×3 adjugate (transpose of cofactors). */
function adj(m: number[]): number[] {
  return [
    m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3],
  ];
}

/** 3×3 · 3×3. */
function multmm(a: number[], b: number[]): number[] {
  const c = new Array<number>(9);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[3 * i + k] * b[3 * k + j];
      c[3 * i + j] = s;
    }
  }
  return c;
}

/** 3×3 · vec3. */
function multmv(m: number[], v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

/** Projection mapping the unit basis to four points. */
function basisToPoints(p: number[]): number[] {
  const m = [p[0], p[2], p[4], p[1], p[3], p[5], 1, 1, 1];
  const v = multmv(adj(m), [p[6], p[7], 1]);
  return multmm(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

/** 3×3 projection taking the four `from` points to the four `to` points. */
function general2DProjection(from: number[], to: number[]): number[] {
  return multmm(basisToPoints(to), adj(basisToPoints(from)));
}

/**
 * A 3×3 projection mapping the `from` quad to the `to` quad. Both are 8-arrays
 * `[x1,y1,x2,y2,x3,y3,x4,y4]` in the SAME corner order. Feed the result to
 * {@link applyProjection} to place points expressed in the `from` frame (e.g. a
 * card rectangle in marker-plane units) into the `to` frame (image pixels).
 */
export function makeProjection(from: number[], to: number[]): number[] {
  return general2DProjection(from, to);
}

/** Map one point through a projection from {@link makeProjection}. */
export function applyProjection(h: number[], x: number, y: number): [number, number] {
  const v = multmv(h, [x, y, 1]);
  return [v[0] / v[2], v[1] / v[2]];
}

/**
 * A CSS `matrix3d(...)` string that maps a `w`×`h` element (top-left origin)
 * onto the destination quad. Corners are given in order: top-left, top-right,
 * bottom-right, bottom-left — the winding js-aruco reports marker corners in.
 */
export function matrix3dForQuad(w: number, h: number, tl: number[], tr: number[], br: number[], bl: number[]): string {
  // Source element corners in TL, TR, BL, BR order (basisToPoints' expected layout).
  const from = [0, 0, w, 0, 0, h, w, h];
  const to = [tl[0], tl[1], tr[0], tr[1], bl[0], bl[1], br[0], br[1]];
  const t = general2DProjection(from, to);
  for (let i = 0; i < 9; i++) t[i] = t[i] / t[8];
  // Column-major 4×4 with the projective z row dropped in.
  const m = [t[0], t[3], 0, t[6], t[1], t[4], 0, t[7], 0, 0, 1, 0, t[2], t[5], 0, t[8]];
  return `matrix3d(${m.join(',')})`;
}
