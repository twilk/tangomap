export type Pt = { x: number; y: number };

/**
 * Trace a smooth CLOSED curve through `pts` onto the current canvas path using a
 * Catmull-Rom spline expressed as cubic béziers. `k` is the softening tension:
 * 0 = straight polygon (spiky), ~0.4 = gently rounded, 1 = very blobby. Caller
 * does beginPath()/fill()/stroke() around it.
 */
export function traceSmooth(ctx: CanvasRenderingContext2D, pts: Pt[], k: number): void {
  const n = pts.length;
  if (n < 3 || k <= 0) {
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    return;
  }
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    ctx.bezierCurveTo(
      p1.x + ((p2.x - p0.x) * k) / 6,
      p1.y + ((p2.y - p0.y) * k) / 6,
      p2.x - ((p3.x - p1.x) * k) / 6,
      p2.y - ((p3.y - p1.y) * k) / 6,
      p2.x,
      p2.y,
    );
  }
  ctx.closePath();
}
