import { describe, test, expect } from 'vitest';
import { MAP_NODES, LEVELS, TAGS, type MapNode } from '@/src/data/mapNodes';
import { SKILLS } from '@/src/data/skills';

// src/data/mapNodes.ts is the authoritative map data. These tests guard its
// internal integrity and the SKILLS projection derived from it. Parity with the
// legacy public/tango-data.js and the bundle lives in test/mapData.test.ts.

describe('mapNodes data integrity', () => {
  test('exactly 62 nodes with unique ids', () => {
    expect(MAP_NODES.length).toBe(62);
    expect(new Set(MAP_NODES.map((n) => n.id)).size).toBe(62);
  });

  test('every dep points at a real node id', () => {
    const ids = new Set(MAP_NODES.map((n) => n.id));
    for (const n of MAP_NODES) {
      for (const d of n.deps) {
        expect(ids.has(d), `"${n.id}" depends on unknown id "${d}"`).toBe(true);
      }
    }
  });

  test('levels are integers in 0..9 and every level is populated', () => {
    const seen = new Set<number>();
    for (const n of MAP_NODES) {
      expect(Number.isInteger(n.level), `"${n.id}" level not an integer`).toBe(true);
      expect(n.level, `"${n.id}" level out of range`).toBeGreaterThanOrEqual(0);
      expect(n.level, `"${n.id}" level out of range`).toBeLessThanOrEqual(9);
      seen.add(n.level);
    }
    for (let l = 0; l <= 9; l++) expect(seen.has(l), `no node at level ${l}`).toBe(true);
  });

  test('every node tag is one of the 13 TAGS', () => {
    expect(Object.keys(TAGS).length).toBe(13);
    for (const n of MAP_NODES) {
      expect(Object.prototype.hasOwnProperty.call(TAGS, n.tag), `"${n.id}" has unknown tag "${n.tag}"`).toBe(true);
    }
  });

  test('LEVELS has 10 non-empty labels', () => {
    expect(LEVELS.length).toBe(10);
    for (const l of LEVELS) expect(typeof l === 'string' && l.length > 0).toBe(true);
  });

  test('role, when present, is only L or F', () => {
    for (const n of MAP_NODES) {
      if (n.role !== undefined) expect(['L', 'F']).toContain(n.role);
    }
  });
});

describe('SKILLS projection of mapNodes', () => {
  // Guards that src/data/skills.ts stays a faithful 1-indexed projection of the
  // map data — the exact shape every SKILLS consumer (dna, skillGraph, knowledge)
  // depends on. If the projection drifts, this fails loudly.
  test('SKILLS is MAP_NODES mapped to { slug, name, level+1, tag, deps }', () => {
    const expected = MAP_NODES.map((n: MapNode) => ({
      slug: n.id,
      name: n.name,
      level: n.level + 1,
      tag: n.tag,
      deps: n.deps,
    }));
    expect(SKILLS).toEqual(expected);
  });

  test('projection is 1-indexed: SKILLS levels span 1..10', () => {
    const levels = new Set(SKILLS.map((s) => s.level));
    for (let l = 1; l <= 10; l++) expect(levels.has(l)).toBe(true);
    expect(Math.min(...levels)).toBe(1);
    expect(Math.max(...levels)).toBe(10);
  });
});
