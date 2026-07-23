'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type View = { id: string; label: string; node: ReactNode };

// One glyph per view type (Lucide-styled), keyed by view id.
const ICONS: Record<string, string> = {
  radar: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7.5 4.5v9L12 21l-7.5-4.5v-9z"/><circle cx="12" cy="12" r="2.4"/></svg>',
  genome: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7v10M8.5 4v16M12 8v8M15.5 5v14M19 7v10"/></svg>',
  bars: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h15M4 12h10M4 18h6"/></svg>',
};

/**
 * A small segmented control that swaps between chart views of the same data.
 * The choice persists (localStorage `tsm-view`) so it carries across the solo
 * profile and the compare page. Views are passed in as ready-made nodes; only
 * the active one is rendered (so hidden canvases don't animate off-screen).
 */
export function ViewSwitcher({ views, storageKey = 'tsm-view' }: { views: View[]; storageKey?: string }) {
  const [active, setActive] = useState(views[0].id);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && views.some((v) => v.id === saved)) setActive(saved);
    } catch {
      /* storage disabled — keep the default view */
    }
  }, [storageKey, views]);

  const pick = (id: string) => {
    setActive(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* ignore */
    }
  };

  const current = views.find((v) => v.id === active) ?? views[0];

  return (
    <div className="tm-view">
      <div className="tm-viewsel" role="radiogroup" aria-label="Choose a chart view">
        {views.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active === v.id}
            className={`tm-vbtn${active === v.id ? ' on' : ''}`}
            onClick={() => pick(v.id)}
          >
            {ICONS[v.id] && <span className="tm-vico" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[v.id] }} />}
            <span>{v.label}</span>
          </button>
        ))}
      </div>
      <div className="tm-viewbody">{current.node}</div>
    </div>
  );
}
