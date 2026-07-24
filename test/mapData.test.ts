import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Parity lock for the three places tango skill data lives.
 *
 *   (a) public/tango-data.js   — the ES-module fallback the bundle `import()`s
 *                                when window.__TANGO_DATA is absent.
 *   (b) public/tangomap.html   — the generated SPA bundle; its inline script sets
 *                                window.__TANGO_DATA = { LEVELS, TAGS, NODES }.
 *   (c) src/data/skills.ts     — the Next app's own SKILLS list (1-indexed levels).
 *
 * Everything is read from disk at test time and parsed textually on purpose:
 * the bundle payload is a JSON-encoded HTML document, and tango-data.js is only
 * ever loaded by the browser. If a regeneration of any one source drifts, this
 * fails loudly instead of shipping a map that disagrees with the app.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EXPECTED_COUNT = 62;

/** Level offset: skills.ts is 1-indexed, the map data is 0-indexed. */
const LEVEL_OFFSET = 1;

type MapNode = { id: string; name: string; level: number; tag: string };
type SkillEntry = { slug: string; name: string; level: number; tag: string };

function readRepoFile(relPath: string): string {
  return readFileSync(join(REPO_ROOT, relPath), 'utf8');
}

/**
 * Parse `{ id:'x', name:'X', level:0, tag:'TAG', ... }` object literals
 * (single quotes, unquoted keys) from the region after the `NODES = [` marker.
 */
function parseNodes(source: string, label: string): MapNode[] {
  const marker = /\bNODES\s*=\s*\[/.exec(source);
  if (!marker) throw new Error(`${label}: no "NODES = [" marker found`);

  const region = source.slice(marker.index);
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'([^']*)'\s*,\s*level:\s*(\d+)\s*,\s*tag:\s*'([^']+)'/g;

  const nodes: MapNode[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(region)) !== null) {
    nodes.push({ id: m[1], name: m[2], level: Number(m[3]), tag: m[4] });
  }
  return nodes;
}

/** Pull the inline SPA source out of the generated bundle's JSON template payload. */
function decodeBundleTemplate(html: string): string {
  const TAG = '<script type="__bundler/template">';
  const start = html.indexOf(TAG);
  if (start < 0) throw new Error('tangomap.html: no <script type="__bundler/template"> tag');

  const payloadStart = start + TAG.length;
  // Nested </script> occurrences inside the payload are escaped as </script>,
  // so the first literal </script> is the real closing tag.
  const payloadEnd = html.indexOf('</script>', payloadStart);
  if (payloadEnd < 0) throw new Error('tangomap.html: unterminated __bundler/template payload');

  const decoded = JSON.parse(html.slice(payloadStart, payloadEnd).trim());
  if (typeof decoded !== 'string') {
    throw new Error('tangomap.html: template payload did not decode to a string');
  }
  return decoded;
}

/** Parse `{ slug: "x", name: "X", level: 1, tag: "TAG" }` entries from skills.ts. */
function parseSkills(source: string): SkillEntry[] {
  const re =
    /\{\s*slug:\s*"([^"]+)"\s*,\s*name:\s*"([^"]*)"\s*,\s*level:\s*(\d+)\s*,\s*tag:\s*"([^"]+)"\s*\}/g;

  const skills: SkillEntry[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    skills.push({ slug: m[1], name: m[2], level: Number(m[3]), tag: m[4] });
  }
  return skills;
}

const dataFileNodes = parseNodes(readRepoFile('public/tango-data.js'), 'public/tango-data.js');
const bundleNodes = parseNodes(
  decodeBundleTemplate(readRepoFile('public/tangomap.html')),
  'public/tangomap.html (inline bundle)',
);
const skills = parseSkills(readRepoFile('src/data/skills.ts'));

const byId = (nodes: MapNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe('map data parity', () => {
  test('all three sources have exactly 62 entries', () => {
    expect(dataFileNodes.length, 'public/tango-data.js NODES').toBe(EXPECTED_COUNT);
    expect(bundleNodes.length, 'tangomap.html inline NODES').toBe(EXPECTED_COUNT);
    expect(skills.length, 'src/data/skills.ts SKILLS').toBe(EXPECTED_COUNT);
  });

  test('ids are unique within each source', () => {
    expect(new Set(dataFileNodes.map((n) => n.id)).size, 'public/tango-data.js ids').toBe(
      dataFileNodes.length,
    );
    expect(new Set(bundleNodes.map((n) => n.id)).size, 'tangomap.html inline ids').toBe(
      bundleNodes.length,
    );
    expect(new Set(skills.map((s) => s.slug)).size, 'src/data/skills.ts slugs').toBe(skills.length);
  });

  test('public/tango-data.js NODES match the bundle inline NODES exactly', () => {
    expect(
      dataFileNodes.map((n) => n.id),
      'id order/content differs between public/tango-data.js and the inline bundle NODES',
    ).toEqual(bundleNodes.map((n) => n.id));

    const fileById = byId(dataFileNodes);
    for (const node of bundleNodes) {
      const fileNode = fileById.get(node.id);
      expect(fileNode, `"${node.id}" is in the bundle but missing from public/tango-data.js`).toBeDefined();
      expect(fileNode, `"${node.id}" differs between public/tango-data.js and the inline bundle`).toEqual(
        node,
      );
    }
  });

  test('bundle node ids and skills.ts slugs are the same set', () => {
    const bundleIds = new Set(bundleNodes.map((n) => n.id));
    const skillSlugs = new Set(skills.map((s) => s.slug));

    const missingFromSkills = [...bundleIds].filter((id) => !skillSlugs.has(id));
    const extraInSkills = [...skillSlugs].filter((slug) => !bundleIds.has(slug));

    expect(missingFromSkills, `map node ids with no src/data/skills.ts slug: ${missingFromSkills.join(', ')}`).toEqual(
      [],
    );
    expect(extraInSkills, `src/data/skills.ts slugs with no map node: ${extraInSkills.join(', ')}`).toEqual([]);
  });

  test('per-id name and tag match between the map data and skills.ts', () => {
    const nodes = byId(bundleNodes);
    for (const skill of skills) {
      const node = nodes.get(skill.slug);
      expect(node, `"${skill.slug}" has no matching map node`).toBeDefined();
      if (!node) continue;

      expect(skill.name, `name drift for "${skill.slug}"`).toBe(node.name);
      expect(skill.tag, `tag drift for "${skill.slug}"`).toBe(node.tag);
    }
  });

  test(`skills.ts level === map data level + ${LEVEL_OFFSET} for every id`, () => {
    const nodes = byId(bundleNodes);
    for (const skill of skills) {
      const node = nodes.get(skill.slug);
      expect(node, `"${skill.slug}" has no matching map node`).toBeDefined();
      if (!node) continue;

      expect(
        skill.level,
        `level offset broken for "${skill.slug}": skills.ts has ${skill.level}, map data has ${node.level}, ` +
          `expected ${node.level + LEVEL_OFFSET} (skills.ts is 1-indexed, map data is 0-indexed)`,
      ).toBe(node.level + LEVEL_OFFSET);
    }
  });
});
