'use client';

import type { MapNode } from '@/src/data/mapNodes';
import { NODE_BY_ID, dependentsOf, pathSteps } from '@/src/lib/mapGraph';

// The skill detail panel — the aside beside the map that opens when a node is
// selected. Ported from the decoded bundle's detail column (template.html ~L766–853)
// onto the app's --tm-* tokens. Presentational: all state (selection, mastery) lives
// in TangoMap; this renders it and calls back. A later phase adds the "in the course"
// list, the full-path timeline and the mark-with-prerequisites action; this phase
// carries the essentials — identity, stats, and the two relation lists.

// role code -> the badge label shown when a skill is role-typical.
const ROLE_LABEL: Record<'L' | 'F', string> = { L: 'Leader', F: 'Follower' };

type RelKind = 'prereq' | 'unlock';

type Props = {
  /** The selected node, or null for the empty state. */
  node: MapNode | null;
  /** Level headings; `levels[node.level]` is this node's band label. */
  levels: string[];
  /** The set of mastered node ids (drives the ✓ affordance + button state). */
  mastered: Set<string>;
  /** Select another node (used by the prerequisite / unlock buttons). */
  onSelect: (id: string) => void;
  /** Toggle the selected node's mastered flag. */
  onToggleMastered: (id: string) => void;
};

/** One row in the Prerequisites / Unlocks lists — a button that selects that node. */
function RelRow({
  id,
  kind,
  mastered,
  onSelect,
}: {
  id: string;
  kind: RelKind;
  mastered: Set<string>;
  onSelect: (id: string) => void;
}) {
  const n = NODE_BY_ID.get(id);
  if (!n) return null;
  const done = mastered.has(id);
  return (
    <button
      type="button"
      className="tsm-rel"
      data-rel={kind}
      data-id={id}
      onClick={() => onSelect(id)}
    >
      <span className={`tsm-rel-check${done ? ' done' : ''}`} aria-hidden="true">
        {done ? '✓' : ''}
      </span>
      <span className="tsm-rel-lvl">L{n.level + 1}</span>
      <span className="tsm-rel-name">{n.name}</span>
      <span className="tsm-rel-arr" aria-hidden="true">
        ›
      </span>
    </button>
  );
}

export function SkillDetailPanel({ node, levels, mastered, onSelect, onToggleMastered }: Props) {
  if (!node) {
    return (
      <aside className="tsm-panel" role="dialog" aria-label="Skill details">
        <div className="tsm-panel-empty">
          <span className="tsm-panel-empty-mark" aria-hidden="true" />
          <p>
            Nothing selected yet. Pick a skill to see its level, prerequisites and
            everything it unlocks.
          </p>
        </div>
      </aside>
    );
  }

  const titleId = `tsm-panel-title-${node.id}`;
  const prereqs = node.deps;
  const unlocks = dependentsOf(node.id);
  const done = mastered.has(node.id);

  return (
    <aside className="tsm-panel" role="dialog" aria-labelledby={titleId}>
      <div className="tsm-panel-body">
        <div className="tsm-panel-kicker">
          LEVEL {node.level + 1} · {(levels[node.level] ?? '').toUpperCase()}
        </div>
        <h2 id={titleId} className="tsm-panel-name">
          {node.name}
        </h2>
        <div className="tsm-panel-gloss">&ldquo;{node.gloss}&rdquo;</div>
        {node.role && (
          <div className="tsm-panel-role">{ROLE_LABEL[node.role]}</div>
        )}
        <p className="tsm-panel-desc">{node.desc}</p>

        <button
          type="button"
          className={`tsm-master${done ? ' done' : ''}`}
          aria-pressed={done}
          data-mastered={done}
          onClick={() => onToggleMastered(node.id)}
        >
          <span className="tsm-master-check" aria-hidden="true">
            ✓
          </span>
          {done ? 'Mastered' : 'Mark mastered'}
        </button>

        <div className="tsm-panel-stats">
          <div className="tsm-stat" data-stat="requires">
            <div className="tsm-stat-num">{prereqs.length}</div>
            <div className="tsm-stat-label">requires</div>
          </div>
          <div className="tsm-stat" data-stat="path">
            <div className="tsm-stat-num">{pathSteps(node.id)}</div>
            <div className="tsm-stat-label">path steps</div>
          </div>
          <div className="tsm-stat" data-stat="unlocks">
            <div className="tsm-stat-num">{unlocks.length}</div>
            <div className="tsm-stat-label">unlocks</div>
          </div>
        </div>

        <div className="tsm-panel-sechead">PREREQUISITES · {prereqs.length}</div>
        {prereqs.length === 0 ? (
          <p className="tsm-panel-note">Bedrock — this skill has no prerequisites.</p>
        ) : (
          <div className="tsm-rel-list" data-rel-list="prereq">
            {prereqs.map((id) => (
              <RelRow key={id} id={id} kind="prereq" mastered={mastered} onSelect={onSelect} />
            ))}
          </div>
        )}

        <div className="tsm-panel-sechead">UNLOCKS · {unlocks.length}</div>
        {unlocks.length === 0 ? (
          <p className="tsm-panel-note">The frontier — nothing builds on this yet.</p>
        ) : (
          <div className="tsm-rel-list" data-rel-list="unlock">
            {unlocks.map((id) => (
              <RelRow key={id} id={id} kind="unlock" mastered={mastered} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

export default SkillDetailPanel;
