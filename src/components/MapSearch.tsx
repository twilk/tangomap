'use client';

import { useRef, useState } from 'react';
import type { MapNode } from '@/src/data/mapNodes';

// The header search combobox — ported from the bundle's search field + suggestion
// listbox (template.html ~L572–588, scoring at ~L1059–1076) onto --tm-* tokens. Owns
// its own query/open/active-index state; selecting a suggestion calls `onPick`, which
// TangoMap routes through the same path as clicking a pill (select + scroll-to).

const MAX_SUGGESTIONS = 7;

/**
 * Rank the nodes for a query: name-prefix (0) beats alias-word-prefix (1) beats
 * name-substring (2) beats gloss/alias substring (3). Case-insensitive; ties break
 * by level. Matches on name, gloss and aliases as the spec requires.
 */
function suggest(nodes: MapNode[], query: string): MapNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: Array<[number, MapNode]> = [];
  for (const n of nodes) {
    const name = n.name.toLowerCase();
    const aliases = (n.aliases ?? []).map((a) => a.toLowerCase());
    const gloss = (n.gloss ?? '').toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (aliases.some((a) => a.split(' ').some((w) => w.startsWith(q)))) score = 1;
    else if (name.includes(q)) score = 2;
    else if (gloss.includes(q) || aliases.some((a) => a.includes(q))) score = 3;
    if (score >= 0) scored.push([score, n]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].level - b[1].level);
  return scored.slice(0, MAX_SUGGESTIONS).map(([, n]) => n);
}

type Props = {
  nodes: MapNode[];
  levels: string[];
  onPick: (id: string) => void;
};

export function MapSearch({ nodes, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);

  const suggestions = suggest(nodes, q);
  const show = open && q.trim().length > 0;
  const safeIdx = Math.min(idx, Math.max(0, suggestions.length - 1));
  const active = show ? suggestions[safeIdx] : undefined;

  const pick = (id: string) => {
    onPick(id);
    setQ('');
    setOpen(false);
    setIdx(0);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const hit = suggestions[safeIdx];
      if (hit) {
        e.preventDefault();
        pick(hit.id);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="tsm-search">
      <svg className="tsm-search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M16.5 16.5L21 21" />
      </svg>
      <input
        ref={inputRef}
        className="tsm-search-input"
        type="text"
        aria-label="Search skills"
        role="combobox"
        aria-expanded={show}
        aria-controls="tsm-suglist"
        aria-autocomplete="list"
        aria-activedescendant={active ? `tsm-opt-${active.id}` : undefined}
        placeholder="Search — try “ocho”, “walk”, “colgada”…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setIdx(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {show && (
        <div className="tsm-suglist" id="tsm-suglist" role="listbox" aria-label="Search suggestions">
          {suggestions.length === 0 ? (
            <div className="tsm-sug-empty">No skill matches that — try “giro”, “sweep” or “off axis”.</div>
          ) : (
            suggestions.map((n, i) => (
              <button
                key={n.id}
                type="button"
                role="option"
                id={`tsm-opt-${n.id}`}
                aria-selected={i === safeIdx}
                className={`tsm-sug${i === safeIdx ? ' active' : ''}`}
                data-id={n.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(n.id);
                }}
              >
                <span className="tsm-sug-text">
                  <span className="tsm-sug-name">{n.name}</span>
                  <span className="tsm-sug-gloss"> — {n.gloss}</span>
                </span>
                <span className="tsm-sug-lvl">L{n.level + 1}</span>
              </button>
            ))
          )}
          <div className="tsm-sug-hint">↑ ↓ to move · Enter to select</div>
        </div>
      )}
    </div>
  );
}

export default MapSearch;
