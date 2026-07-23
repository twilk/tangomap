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
      { label: 'Connection', icon: '🤝', names: ['Mirada & Cabeceo', 'The Embrace', 'Leader & Follower', 'Close Embrace', 'Connection', 'Cross System', 'Embrace Transitions', 'Change of Role', 'Embrace & Communication'] },
      { label: 'Body & Posture', icon: '🧍', names: ['Posture', 'Dissociation', 'Energy from the Ground', 'Posture & Walking Refined'] },
      { label: 'Footwork', icon: '👣', names: ['Walking', 'The Square', 'Change of Weight', 'Walking Outside', 'The Cross', 'Exits from the Cross', 'Americana'] },
      { label: 'Musicality', icon: '🎵', names: ['Music & Timing', 'Double Timing', 'Traspié', 'Musicality', 'The Orchestras', 'Switching the Instrument'] },
      { label: 'Turns', icon: '🌀', names: ['Ocho Adelante', 'Ocho Atrás', 'Ocho Cortado', 'Molinete', 'Giro to the Left', 'Giro to the Right', 'Calesita', 'Linear Giro', 'Asymmetric Giro', 'Media Luna via Crosses'] },
      { label: 'Navigation', icon: '🧭', names: ['The Ronda', 'Sacada', 'Giro with Sacadas', 'Follower’s Sacada', 'Cadenas', 'Sacada Against Sacada'] },
      { label: 'Contact', icon: '🔗', names: ['Parada', 'Mordida', 'Barrida & Arrastre', 'Gancho', 'Pasada'] },
      { label: 'Free Leg', icon: '🦵', names: ['Adornos & Lustrada', 'Boleo', 'Planeo'] },
      { label: 'Off-Axis', icon: '🤸', names: ['Volcada', 'Colgada'] },
      { label: 'Dynamics', icon: '⚡', names: ['Bounce & Rebound', 'Soltadas'] },
      { label: 'Genres', icon: '🎻', names: ['Vals', 'Milonga', 'Chacarera'] },
      { label: 'Styles', icon: '💃', names: ['Tango Salón', 'Estilo Milonguero', 'Tango Nuevo'] },
      { label: 'Mastery', icon: '🏆', names: ['Improvisation', 'Stops & Endings'] }
    ];
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
          '<span style="font-size:14px;flex:none">' + cat.icon + '</span>' +
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
