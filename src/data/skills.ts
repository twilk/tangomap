// The app's SKILLS list — a projection of the authoritative map data in
// src/data/mapNodes.ts. Each skill is one map node with a 1-indexed level
// (the map data is 0-indexed; the app displays levels 1..10).
//
// It derives directly from mapNodes.ts, so the map and the app both read from one
// source of truth.
import { MAP_NODES } from '@/src/data/mapNodes';

/** deps = prerequisite slugs (this skill's inbound edges in the map's graph). */
export type Skill = { slug: string; name: string; level: number; tag: string; deps: string[] };

export const SKILLS: Skill[] = MAP_NODES.map((n) => ({
  slug: n.id,
  name: n.name,
  level: n.level + 1, // map data is 0-indexed -> human 1..10
  tag: n.tag,
  deps: n.deps,
}));

export const SKILL_SLUGS: Set<string> = new Set(SKILLS.map((s) => s.slug));
