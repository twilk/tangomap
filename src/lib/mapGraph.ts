import { MAP_NODES, type MapNode } from '@/src/data/mapNodes';

// Static graph helpers for the whole-map view, derived once from the authoritative
// node deps (ids, not slugs). This is the id-space companion to src/lib/skillGraph.ts
// (which walks the slug-space SKILLS projection for the statically-generated /skill
// pages). The map's interactions run on ids, so they read from here — no DOM, no
// slug round-trip. Everything is pure and computed at module load.

/** id -> node, for O(1) lookups. */
export const NODE_BY_ID: Map<string, MapNode> = new Map(MAP_NODES.map((n) => [n.id, n]));

/**
 * Reverse dependency edges: id -> ids of nodes that list it in their `deps`
 * (its DIRECT dependents — what it unlocks). Built once from the forward edges.
 */
export const DEPENDENTS: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const n of MAP_NODES) {
    for (const dep of n.deps) {
      const arr = m.get(dep);
      if (arr) arr.push(n.id);
      else m.set(dep, [n.id]);
    }
  }
  return m;
})();

/** The direct dependents of a node (nodes for which it is a prerequisite). */
export function dependentsOf(id: string): string[] {
  return DEPENDENTS.get(id) ?? [];
}

/**
 * The ids "in relation" to a focused node: itself, its direct prerequisites, and
 * its direct dependents. Used to dim everything else on the map.
 */
export function relatedTo(id: string): Set<string> {
  const node = NODE_BY_ID.get(id);
  return new Set<string>([id, ...(node?.deps ?? []), ...dependentsOf(id)]);
}

/**
 * The longest prerequisite chain ending at `id`, inclusive of `id` itself — a port
 * of the bundle's `longPath`. Deepest root first, `id` last. Memoized and cycle-safe
 * (a back-edge into the active stack terminates that branch instead of looping).
 *
 * `pathSteps` (below) is this chain's length, the "path steps" stat: 1 for a bedrock
 * skill (just itself), growing by one for each prerequisite level beneath it.
 */
const PATH_MEMO = new Map<string, string[]>();
export function longestPrereqPath(id: string): string[] {
  const stack = new Set<string>();
  const go = (i: string): string[] => {
    const cached = PATH_MEMO.get(i);
    if (cached) return cached;
    if (stack.has(i)) return [i]; // cycle guard: don't re-descend into the active path
    stack.add(i);
    const node = NODE_BY_ID.get(i);
    let best: string[] = [];
    for (const dep of node ? node.deps : []) {
      const p = go(dep);
      if (p.length > best.length) best = p;
    }
    const chain = [...best, i];
    PATH_MEMO.set(i, chain);
    stack.delete(i);
    return chain;
  };
  return go(id);
}

/** The "path steps" stat: number of nodes in the longest prerequisite chain (>= 1). */
export function pathSteps(id: string): number {
  return longestPrereqPath(id).length;
}
