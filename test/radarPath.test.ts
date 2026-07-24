import { test, expect } from 'vitest';
import { traceSmooth, type Pt } from '@/src/lib/radarPath';

// Record the path ops without a real canvas.
function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    calls,
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    bezierCurveTo: () => calls.push('bezier'),
    closePath: () => calls.push('close'),
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

const ring = (n: number): Pt[] => Array.from({ length: n }, (_, i) => ({ x: Math.cos(i), y: Math.sin(i) }));

test('tension 0 draws a straight closed polygon (no béziers)', () => {
  const c = fakeCtx();
  traceSmooth(c, ring(5), 0);
  expect((c as unknown as { calls: string[] }).calls.filter((x) => x === 'bezier')).toHaveLength(0);
  expect((c as unknown as { calls: string[] }).calls).toContain('close');
});

test('smooth path emits exactly one bézier per point, then closes', () => {
  const c = fakeCtx();
  const n = 6;
  traceSmooth(c, ring(n), 0.5);
  const calls = (c as unknown as { calls: string[] }).calls;
  expect(calls.filter((x) => x === 'bezier')).toHaveLength(n);
  expect(calls[0]).toBe('moveTo');
  expect(calls.at(-1)).toBe('close');
});

test('fewer than 3 points falls back to straight segments', () => {
  const c = fakeCtx();
  traceSmooth(c, ring(2), 0.5);
  expect((c as unknown as { calls: string[] }).calls.filter((x) => x === 'bezier')).toHaveLength(0);
});
