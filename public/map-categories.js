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
      { label: 'Connection', icon: '<circle cx="9" cy="12" r="4.5"/><circle cx="15" cy="12" r="4.5"/>', names: ['Mirada & Cabeceo', 'The Embrace', 'Leader & Follower', 'Close Embrace', 'Connection', 'Cross System', 'Embrace Transitions', 'Change of Role', 'Embrace & Communication'] },
      { label: 'Body & Posture', icon: '<circle cx="12" cy="5.5" r="2.5"/><path d="M12 8v11"/><path d="M8 19h8"/>', names: ['Posture', 'Dissociation', 'Energy from the Ground', 'Posture & Walking Refined'] },
      { label: 'Footwork', icon: '<path d="M4 20h5v-5h5v-5h5V5"/>', names: ['Walking', 'The Square', 'Change of Weight', 'Walking Outside', 'The Cross', 'Exits from the Cross', 'Americana'] },
      { label: 'Musicality', icon: '<path d="M6 15V9"/><path d="M10 17V7"/><path d="M14 16V8"/><path d="M18 14v-4"/>', names: ['Music & Timing', 'Double Timing', 'Traspié', 'Musicality', 'The Orchestras', 'Switching the Instrument'] },
      { label: 'Turns', icon: '<path d="M12 12C6 10 6 4 12 4c6 0 6 6 0 8-6 2-6 8 0 8 6 0 6-6 0-8Z"/>', names: ['Ocho Adelante', 'Ocho Atrás', 'Ocho Cortado', 'Molinete', 'Giro to the Left', 'Giro to the Right', 'Calesita', 'Linear Giro', 'Asymmetric Giro', 'Media Luna via Crosses'] },
      { label: 'Navigation', icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5 13.8 12 12 16.5 10.2 12Z"/>', names: ['The Ronda', 'Sacada', 'Giro with Sacadas', 'Follower’s Sacada', 'Cadenas', 'Sacada Against Sacada'] },
      { label: 'Contact', icon: '<path d="M14 4v9a4 4 0 1 1-8 0"/>', names: ['Parada', 'Mordida', 'Barrida & Arrastre', 'Gancho', 'Pasada'] },
      { label: 'Free Leg', icon: '<path d="M6 20Q6 8 16 6"/><circle cx="16.5" cy="6" r="1.8" fill="currentColor" stroke="none"/>', names: ['Adornos & Lustrada', 'Boleo', 'Planeo'] },
      { label: 'Off-Axis', icon: '<path d="M12 4v16" stroke-dasharray="2 2" opacity="0.5"/><path d="M8 20 16 6"/><circle cx="16.3" cy="5.7" r="1.6" fill="currentColor" stroke="none"/>', names: ['Volcada', 'Colgada'] },
      { label: 'Dynamics', icon: '<path d="M13 2 4 14h7l-1 8 10-13h-8Z" fill="currentColor" stroke="none"/>', names: ['Bounce & Rebound', 'Soltadas'] },
      { label: 'Genres', icon: '<circle cx="7" cy="18" r="2.2" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="2.2" fill="currentColor" stroke="none"/><path d="M9 18V6l10-2v12"/>', names: ['Vals', 'Milonga', 'Chacarera'] },
      { label: 'Styles', icon: '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2v6m0 0-4 7m4-7 4 6M8.5 10.5 15.5 8.5"/>', names: ['Tango Salón', 'Estilo Milonguero', 'Tango Nuevo'] },
      { label: 'Mastery', icon: '<path d="M12 3 13.8 10.2 21 12 13.8 13.8 12 21 10.2 13.8 3 12 10.2 10.2Z"/>', names: ['Improvisation', 'Stops & Endings'] }
    ];
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
      cont.innerHTML =
        '<div style="font:600 10px ui-monospace,Menlo,monospace;letter-spacing:.14em;text-transform:uppercase;color:' + muted + ';padding:8px 16px 8px">Browse by category</div>' +
        rows + clear;

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
    setInterval(function () {
      if (!built && !build()) return;
      var steady = listRef && listRef.isConnected && listRef.style.display === 'none' && document.getElementById('tm-catnav');
      if (!steady) listRef = mount();
      if (pinned >= 0) apply(pinned);
    }, 700);
  } catch (e) {}
})();
