'use client';

import { CATEGORIES, iconSvg, catAnchor } from '@/src/lib/dna';

// The "Browse by category" navigator — a native React port of the bundle's category rail.
// It lists the 13 Tango DNA categories (the authoritative CATEGORIES from src/lib/dna.ts,
// NOT a hand-copied list). Hovering a row previews its member nodes on the map; clicking
// pins it (dims everything else); the parent owns that state. Each row also links to the
// matching /skills#<anchor> section of the knowledge base. Presentational — all filter
// state lives in TangoMap, matched to nodes by `tag`.

type Props = {
  /** Member-node count per category tag, for the trailing count chip. */
  counts: Record<string, number>;
  /** The pinned category tag, or null. Drives the row's active styling. */
  pinned: string | null;
  /** Preview a category on hover/focus (null clears the preview). */
  onHover: (tag: string | null) => void;
  /** Pin/unpin a category (the parent toggles it off on re-selection). */
  onPin: (tag: string) => void;
};

export function MapCategoryNav({ counts, pinned, onHover, onPin }: Props) {
  return (
    <nav
      className="tsm-catnav"
      aria-label="Browse by category"
      onMouseLeave={() => onHover(null)}
    >
      <div className="tsm-catnav-head">Browse by category</div>
      <ul className="tsm-catnav-list">
        {CATEGORIES.map((c) => {
          const on = pinned === c.tag;
          return (
            <li key={c.tag} className={`tsm-cat-row${on ? ' on' : ''}`}>
              <button
                type="button"
                className="tsm-cat"
                data-tag={c.tag}
                aria-pressed={on}
                onMouseEnter={() => onHover(c.tag)}
                onFocus={() => onHover(c.tag)}
                onBlur={() => onHover(null)}
                onClick={() => onPin(c.tag)}
              >
                <span
                  className="tsm-cat-ico"
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: iconSvg(c.icon, 15) }}
                />
                <span className="tsm-cat-label">{c.label}</span>
                <span className="tsm-cat-count">{counts[c.tag] ?? 0}</span>
              </button>
              <a
                className="tsm-cat-link"
                href={`/skills#${catAnchor(c.tag)}`}
                aria-label={`Open ${c.label} in the guide`}
              >
                <span aria-hidden="true">→</span>
              </a>
            </li>
          );
        })}
      </ul>
      {pinned && (
        <button type="button" className="tsm-cat-clear" onClick={() => onPin(pinned)}>
          <span aria-hidden="true">✕</span> Clear filter
        </button>
      )}
    </nav>
  );
}

export default MapCategoryNav;
