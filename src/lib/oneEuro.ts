// The 1€ filter (Casiez, Roussel, Vogel 2012) — the standard low-pass for noisy
// interactive signals. L2 runs one per tracked marker-corner coordinate so the
// card sits still when the phone is still, yet snaps when it moves. Every OSS
// fiducial tracker jitters raw; this is the smoothing the AR research called
// mandatory. Pure and deterministic → unit-tested.
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private freq: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(opts: { minCutoff?: number; beta?: number; dCutoff?: number; freq?: number } = {}) {
    this.minCutoff = opts.minCutoff ?? 1.0;
    this.beta = opts.beta ?? 0.0;
    this.dCutoff = opts.dCutoff ?? 1.0;
    this.freq = opts.freq ?? 60;
  }

  private alpha(cutoff: number): number {
    const te = 1 / this.freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }

  /** Filter one sample. `t` is seconds; when given, the sample rate is derived from it. */
  filter(x: number, t?: number): number {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = t ?? null;
      return x;
    }
    if (t != null && this.tPrev != null && t > this.tPrev) {
      this.freq = 1 / (t - this.tPrev);
    }
    if (t != null) this.tPrev = t;

    const dx = (x - this.xPrev) * this.freq;
    const aD = this.alpha(this.dCutoff);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff);
    const xHat = a * x + (1 - a) * this.xPrev;

    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}
