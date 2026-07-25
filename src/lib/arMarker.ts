// Marker identity for L2 "card over the phone". A dancer's mint serial IS the
// original-ArUco marker id (0–1023): the presenter shows the marker for their
// serial, the scanner reads the id and resolves it back to a handle via
// /api/ar-resolve. Serials past the dictionary can't be presented until the
// composite ArUco+QR scheme (see docs/superpowers/plans/2026-07-25-two-tier-ar.md)
// lands; that's a deliberate v1 limit, surfaced to the user, not a silent cap.
export const MARKER_MAX = 1023;

/** The serial as a marker id, or null when it's outside the dictionary. */
export function serialToMarkerId(serial: number): number | null {
  return Number.isInteger(serial) && serial >= 0 && serial <= MARKER_MAX ? serial : null;
}

// Each inner row is one of the 4 valid original-ArUco codewords, so any in-range
// id renders a marker the detector accepts AND reads back at the same id
// (verified in-browser: gen0→0, gen42→42, gen1023→1023).
const WORDS: Record<string, number[]> = {
  '00': [1, 0, 0, 0, 0],
  '01': [1, 0, 1, 1, 1],
  '10': [0, 1, 0, 0, 1],
  '11': [0, 1, 1, 1, 0],
};

/**
 * The 7×7 marker as a grid of 1 (white cell) / 0 (black). Black border, 5×5
 * data interior. Isomorphic — the presenter draws it to a canvas, tests assert
 * on it. Returns an all-black border with the interior rows set to the codewords.
 */
export function markerGrid(id: number): number[][] {
  let bits = (id & MARKER_MAX).toString(2);
  while (bits.length < 10) bits = '0' + bits;
  const g: number[][] = Array.from({ length: 7 }, () => Array(7).fill(0));
  for (let row = 0; row < 5; row++) {
    const w = WORDS[bits.slice(row * 2, row * 2 + 2)];
    for (let col = 0; col < 5; col++) g[row + 1][col + 1] = w[col];
  }
  return g;
}
