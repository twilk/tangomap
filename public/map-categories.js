/* Tango Map — category navigation inside the Skill Navigator.
   The level list in the left sidebar duplicates the main map (which is already
   laid out by level), so this injected enhancement replaces it with the 13 skill
   categories (the Tango DNA tags) — a genuinely new axis. Hovering a category
   previews it on the map; clicking pins it (its nodes light up, the rest dim).
   Nodes are matched to categories by NAME on every apply (never cached), so it
   survives the map's own re-renders. Self-contained; no-op if the map never renders. */
(function () {
  try {
    var CATS = [
      { label: 'Connection', icon: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>', names: ['Mirada & Cabeceo', 'The Embrace', 'Leader & Follower', 'Close Embrace', 'Connection', 'Cross System', 'Embrace Transitions', 'Change of Role', 'Embrace & Communication'] },
      { label: 'Body & Posture', icon: '<circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/>', names: ['Posture', 'Dissociation', 'Energy from the Ground', 'Posture & Walking Refined'] },
      { label: 'Footwork', icon: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>', names: ['Walking', 'The Square', 'Change of Weight', 'Walking Outside', 'The Cross', 'Exits from the Cross', 'Americana'] },
      { label: 'Musicality', icon: '<path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/>', names: ['Music & Timing', 'Double Timing', 'Traspié', 'Musicality', 'The Orchestras', 'Switching the Instrument'] },
      { label: 'Turns', icon: '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>', names: ['Ocho Adelante', 'Ocho Atrás', 'Ocho Cortado', 'Molinete', 'Giro to the Left', 'Giro to the Right', 'Calesita', 'Linear Giro', 'Asymmetric Giro', 'Media Luna via Crosses'] },
      { label: 'Navigation', icon: '<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>', names: ['The Ronda', 'Sacada', 'Giro with Sacadas', 'Follower’s Sacada', 'Cadenas', 'Sacada Against Sacada'] },
      { label: 'Contact', icon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>', names: ['Parada', 'Mordida', 'Barrida & Arrastre', 'Gancho', 'Pasada'] },
      { label: 'Free Leg', icon: '<path d="M12.8 19.6A2 2 0 1 0 14 16H2"/><path d="M17.5 8a2.5 2.5 0 1 1 2 4H2"/><path d="M9.8 4.4A2 2 0 1 1 11 8H2"/>', names: ['Adornos & Lustrada', 'Boleo', 'Planeo'] },
      { label: 'Off-Axis', icon: '<g transform="rotate(18 12 20)"><circle cx="12" cy="5" r="1"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></g>', names: ['Volcada', 'Colgada'] },
      { label: 'Dynamics', icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>', names: ['Bounce & Rebound', 'Soltadas'] },
      { label: 'Genres', icon: '<path d="M6 12c0-1.7.7-3.2 1.8-4.2"/><circle cx="12" cy="12" r="10"/><path d="M18 12c0 1.7-.7 3.2-1.8 4.2"/><circle cx="12" cy="12" r="2"/>', names: ['Vals', 'Milonga', 'Chacarera'] },
      { label: 'Styles', icon: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2Z"/>', names: ['Tango Salón', 'Estilo Milonguero', 'Tango Nuevo'] },
      { label: 'Mastery', icon: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>', names: ['Improvisation', 'Stops & Endings'] }
    ];
    // /skills#anchor for each category, in CATS order (mirrors catAnchor() in src/lib/dna.ts).
    var ANCHORS = ['partner', 'body', 'step', 'rhythm', 'rotation', 'space', 'contact', 'free-leg', 'off-axis', 'dynamics', 'genre', 'style', 'mastery'];
    function iconSvg(inner) { return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>'; }
    var norm = function (s) { try { return String(s).normalize('NFC'); } catch (e) { return String(s); } };
    var nameToCat = {};
    CATS.forEach(function (c, i) { c.names.forEach(function (n) { nameToCat[norm(n)] = i; }); });

    var ACCENT = '#c67139';
    var pinned = -1;
    var built = false;
    var listRef = null;

    function nodes() {
      return Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        var s = b.getAttribute('style') || '';
        var a = b.getAttribute('aria-label') || '';
        return /position:\s*absolute/.test(s) && /Level\s*\d/i.test(a);
      });
    }
    function nameOf(b) { return norm((b.getAttribute('aria-label') || '').split(' — ')[0].trim()); }

    function build() {
      var ns = nodes();
      if (ns.length < 60) return false;
      var a = getComputedStyle(ns[0]).getPropertyValue('--t-accent').trim();
      if (a) ACCENT = a;
      built = true;
      return true;
    }

    // Highlight the pinned/previewed category by matching each CURRENT node by
    // name (no stale element references). idx < 0 restores every node.
    function apply(idx) {
      if (!built) return;
      nodes().forEach(function (b) {
        if (b.__co === undefined) b.__co = b.style.opacity || '1';
        if (b.__cs === undefined) b.__cs = b.style.boxShadow || '';
        if (idx < 0) {
          b.style.opacity = b.__co;
          b.style.boxShadow = b.__cs;
          return;
        }
        if (nameToCat[nameOf(b)] === idx) {
          b.style.opacity = '1';
          b.style.boxShadow = '0 0 0 2px ' + ACCENT + ', 0 0 18px -4px ' + ACCENT;
        } else {
          b.style.opacity = '0.2';
          b.style.boxShadow = 'none';
        }
      });
    }

    function gv(n, f) {
      var els = [document.querySelector('[style*="var(--t-"]'), document.querySelector('.tsm'), document.querySelector('.sc-host'), document.body].filter(Boolean);
      for (var i = 0; i < els.length; i++) { var v = getComputedStyle(els[i]).getPropertyValue(n).trim(); if (v) return v; }
      return f;
    }
    function hexa(hex, a) {
      hex = String(hex).replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(function (x) { return x + x; }).join('');
      var n = parseInt(hex, 16);
      if (isNaN(n)) return 'rgba(198,113,57,' + a + ')';
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    function findList() {
      var nav = document.querySelector('nav');
      if (!nav) return null;
      var row = Array.prototype.slice.call(nav.querySelectorAll('*')).find(function (e) {
        return /Beginners.*First Steps/i.test((e.textContent || '').replace(/\s+/g, ' ')) && e.querySelectorAll('*').length < 12;
      });
      if (!row || !row.parentElement) return null;
      var list = row.parentElement;
      // The level list holds ~10 rows; refuse to hide a smaller/wrong container.
      if (list.children.length < 6) return null;
      return { nav: nav, list: list };
    }

    function setPinned(idx) { pinned = idx; apply(pinned); }

    function render(cont) {
      var ink = gv('--t-ink', '#201e1d'), accent = gv('--t-accent', '#c67139'), muted = gv('--t-muted', '#645c50');
      ACCENT = accent;
      function rowHtml(i) {
        var cat = CATS[i];
        var n = cat.names.length; // static, always correct
        var active = pinned === i;
        return '<button class="tm-cat-row" data-i="' + i + '" style="display:flex;align-items:center;gap:10px;width:calc(100% - 12px);margin:1px 6px;padding:7px 10px;border:0;border-radius:9px;cursor:pointer;text-align:left;font:600 14.5px Figtree,system-ui,sans-serif;' +
          (active ? 'background:' + hexa(accent, 0.14) + ';color:' + accent : 'background:transparent;color:' + ink) + '">' +
          '<span style="font:600 10px ui-monospace,Menlo,monospace;color:' + (active ? accent : muted) + ';width:16px;flex:none">' + (i + 1 < 10 ? '0' : '') + (i + 1) + '</span>' +
          '<span style="display:inline-flex;align-items:center;flex:none;color:' + (active ? accent : muted) + '">' + iconSvg(cat.icon) + '</span>' +
          '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + cat.label + '</span>' +
          '<span style="font:600 12px ui-monospace,Menlo,monospace;color:' + muted + ';flex:none">' + n + '</span>' +
          '</button>';
      }
      var rows = CATS.map(function (_, i) { return rowHtml(i); }).join('');
      var clear = pinned >= 0
        ? '<button class="tm-cat-row" data-i="-1" style="display:flex;align-items:center;gap:8px;width:calc(100% - 12px);margin:6px 6px 2px;padding:6px 10px;border:0;border-radius:9px;cursor:pointer;text-align:left;font:600 12px Figtree,system-ui,sans-serif;color:' + muted + ';background:transparent">✕ Clear filter</button>'
        : '';
      // Contextual link into the knowledge base: the pinned category, or the whole guide.
      var learnHref = pinned >= 0 ? '/skills#' + ANCHORS[pinned] : '/skills';
      var learnLabel = pinned >= 0 ? 'Learn ' + CATS[pinned].label + ' →' : 'Open the Learn guide →';
      var learn = '<a href="' + learnHref + '" style="display:flex;align-items:center;gap:8px;width:calc(100% - 12px);margin:8px 6px 4px;padding:8px 10px;border-radius:9px;text-decoration:none;font:600 12.5px Figtree,system-ui,sans-serif;color:' + accent + '">' + learnLabel + '</a>';
      cont.innerHTML =
        '<div style="font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:' + muted + ';padding:8px 16px 8px">Browse by category</div>' +
        rows + clear + learn;

      Array.prototype.forEach.call(cont.querySelectorAll('.tm-cat-row'), function (el) {
        var i = parseInt(el.getAttribute('data-i'), 10);
        el.onmouseenter = function () {
          if (i >= 0 && pinned < 0) apply(i);
          if (i !== pinned) el.style.background = hexa(accent, i < 0 ? 0 : 0.08);
        };
        el.onmouseleave = function () {
          if (pinned < 0) apply(-1);
          if (i !== pinned) el.style.background = 'transparent';
        };
        el.onclick = function () { setPinned((i < 0 || i === pinned) ? -1 : i); render(cont); };
      });
    }

    function mount() {
      var f = findList();
      if (!f || !built) return null;
      f.list.style.display = 'none';
      try {
        var st = Array.prototype.slice.call(f.nav.querySelectorAll('*')).find(function (e) {
          return e.children.length === 0 && /\d+\s*levels/i.test(e.textContent || '');
        });
        if (st) st.textContent = st.textContent.replace(/\d+\s*levels/i, '13 categories');
      } catch (e) {}
      var cont = document.getElementById('tm-catnav');
      if (!cont) {
        cont = document.createElement('div');
        cont.id = 'tm-catnav';
        f.list.parentNode.insertBefore(cont, f.list.nextSibling);
      }
      render(cont);
      return f.list;
    }

    // Light guard: only touch the DOM when not already in the mounted steady
    // state (survives the map's own re-renders without constant re-scanning).
    // Idempotent, so it's safe to run on every coordinator pass.
    function reconcile() {
      if (!built && !build()) return;
      var steady = listRef && listRef.isConnected && listRef.style.display === 'none' && document.getElementById('tm-catnav');
      if (!steady) listRef = mount();
      if (pinned >= 0) apply(pinned);
    }

    // Driven by the shared coordinator (map-runtime.js) instead of a private
    // interval. Injected script order isn't guaranteed, so queue for the
    // coordinator if it hasn't executed yet — and if it never shows up at all,
    // fall back to this script's original standalone polling.
    (function registerReconcile() {
      var FALLBACK = 700;
      try {
        var rt = window.__tmRuntime;
        if (rt && typeof rt.register === 'function') { rt.register(reconcile); return; }
        (window.__tmRuntimeQueue = window.__tmRuntimeQueue || []).push(reconcile);
        setTimeout(function () {
          try {
            if (window.__tmRuntime) return; // coordinator arrived and owns it now
            var q = window.__tmRuntimeQueue || [], i = q.indexOf(reconcile);
            if (i >= 0) q.splice(i, 1);
            setInterval(reconcile, FALLBACK);
          } catch (e) {}
        }, 3000);
      } catch (e) { try { setInterval(reconcile, FALLBACK); } catch (e2) {} }
    })();
  } catch (e) {}
})();
