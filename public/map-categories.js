/* Tango Map — "By category" navigator.
   Injected enhancement (like auth-ui.js / sync.js): adds a category filter that
   complements the level-based Skill Navigator. Each of the 13 skill categories
   (the Tango DNA tags) maps to its skill nodes by name; hovering previews and
   clicking pins a category, highlighting its nodes on the map and dimming the
   rest. Fully self-contained; degrades to a no-op if the map never renders. */
(function () {
  try {
    var CATS = [
      { label: 'Connection', names: ['Mirada & Cabeceo', 'The Embrace', 'Leader & Follower', 'Close Embrace', 'Connection', 'Cross System', 'Embrace Transitions', 'Change of Role', 'Embrace & Communication'] },
      { label: 'Body & Posture', names: ['Posture', 'Dissociation', 'Energy from the Ground', 'Posture & Walking Refined'] },
      { label: 'Footwork', names: ['Walking', 'The Square', 'Change of Weight', 'Walking Outside', 'The Cross', 'Exits from the Cross', 'Americana'] },
      { label: 'Musicality', names: ['Music & Timing', 'Double Timing', 'Traspié', 'Musicality', 'The Orchestras', 'Switching the Instrument'] },
      { label: 'Turns', names: ['Ocho Adelante', 'Ocho Atrás', 'Ocho Cortado', 'Molinete', 'Giro to the Left', 'Giro to the Right', 'Calesita', 'Linear Giro', 'Asymmetric Giro', 'Media Luna via Crosses'] },
      { label: 'Navigation', names: ['The Ronda', 'Sacada', 'Giro with Sacadas', 'Follower’s Sacada', 'Cadenas', 'Sacada Against Sacada'] },
      { label: 'Contact', names: ['Parada', 'Mordida', 'Barrida & Arrastre', 'Gancho', 'Pasada'] },
      { label: 'Free Leg', names: ['Adornos & Lustrada', 'Boleo', 'Planeo'] },
      { label: 'Off-Axis', names: ['Volcada', 'Colgada'] },
      { label: 'Dynamics', names: ['Bounce & Rebound', 'Soltadas'] },
      { label: 'Genres', names: ['Vals', 'Milonga', 'Chacarera'] },
      { label: 'Styles', names: ['Tango Salón', 'Estilo Milonguero', 'Tango Nuevo'] },
      { label: 'Mastery', names: ['Improvisation', 'Stops & Endings'] }
    ];
    var nameToCat = {};
    CATS.forEach(function (c, i) { c.names.forEach(function (n) { nameToCat[n] = i; }); });

    var ACCENT = '#c67139';
    var pinned = -1;
    var built = false;
    var catNodes = [];
    var reapplyTimer = null;

    function nodes() {
      return Array.prototype.slice.call(document.querySelectorAll('button')).filter(function (b) {
        var s = b.getAttribute('style') || '';
        var a = b.getAttribute('aria-label') || '';
        return /position:\s*absolute/.test(s) && /Level\s*\d/i.test(a);
      });
    }
    function nameOf(b) { return (b.getAttribute('aria-label') || '').split(' — ')[0].trim(); }

    function build() {
      var ns = nodes();
      if (ns.length < 60) return false;
      catNodes = CATS.map(function () { return []; });
      ns.forEach(function (b) {
        var idx = nameToCat[nameOf(b)];
        if (idx != null) catNodes[idx].push(b);
        if (b.__co === undefined) b.__co = b.style.opacity || '1';
        if (b.__cs === undefined) b.__cs = b.style.boxShadow || '';
      });
      var probe = ns[0];
      var a = getComputedStyle(probe).getPropertyValue('--t-accent').trim();
      if (a) ACCENT = a;
      built = true;
      return true;
    }

    function apply(idx) {
      if (!built) return;
      var ns = nodes();
      if (idx < 0) {
        ns.forEach(function (b) {
          b.style.opacity = (b.__co !== undefined ? b.__co : '1');
          b.style.boxShadow = (b.__cs !== undefined ? b.__cs : '');
        });
        return;
      }
      var set = catNodes[idx] || [];
      ns.forEach(function (b) {
        if (b.__co === undefined) b.__co = b.style.opacity || '1';
        if (b.__cs === undefined) b.__cs = b.style.boxShadow || '';
        if (set.indexOf(b) >= 0) {
          b.style.opacity = '1';
          b.style.boxShadow = '0 0 0 2px ' + ACCENT + ', 0 0 18px -4px ' + ACCENT;
        } else {
          b.style.opacity = '0.2';
          b.style.boxShadow = 'none';
        }
      });
    }

    function setPinned(idx) {
      pinned = idx;
      apply(pinned);
      if (reapplyTimer) { clearInterval(reapplyTimer); reapplyTimer = null; }
      // keep the highlight sticky through the map's own re-renders (pan/zoom)
      if (pinned >= 0) reapplyTimer = setInterval(function () { apply(pinned); }, 400);
    }

    var panel;
    var collapsed = (window.innerWidth < 640);

    function chip(inner, attrs) {
      return '<button class="tmc-chip" ' + attrs + ' style="display:inline-flex;align-items:center;gap:6px;border:1px solid var(--tmc-bd);background:var(--tmc-bg2);color:inherit;border-radius:999px;padding:5px 9px;margin:3px;cursor:pointer;font:inherit;font-size:11px;white-space:nowrap;transition:border-color .15s,background .15s">' + inner + '</button>';
    }

    function render() {
      if (!panel) { panel = document.createElement('div'); panel.id = 'tm-cats'; document.body.appendChild(panel); }
      panel.style.cssText =
        'position:fixed;left:14px;bottom:14px;z-index:2147483000;max-width:min(320px,calc(100vw - 28px));' +
        'font:600 12px system-ui,-apple-system,Segoe UI,sans-serif;color:#f2eadc;' +
        'background:rgba(17,13,9,.82);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
        'border:1px solid rgba(241,233,220,.16);border-radius:14px;box-shadow:0 22px 44px -26px rgba(0,0,0,.7);overflow:hidden;' +
        '--tmc-bd:rgba(241,233,220,.18);--tmc-bg2:transparent';
      var activeLabel = pinned >= 0 ? CATS[pinned].label : '';
      var hdr = '<button id="tmc-h" style="display:flex;align-items:center;gap:8px;width:100%;background:none;border:0;color:inherit;cursor:pointer;padding:11px 13px;font:inherit;font-size:10px;letter-spacing:.14em;text-transform:uppercase">' +
        '<span style="width:8px;height:8px;border-radius:50%;background:' + ACCENT + ';box-shadow:0 0 0 3px rgba(198,113,57,.25)"></span>' +
        'By category' +
        (activeLabel ? '<span style="letter-spacing:0;text-transform:none;color:' + ACCENT + '">· ' + activeLabel + '</span>' : '') +
        '<span style="flex:1"></span><span style="opacity:.55;font-size:12px">' + (collapsed ? '▸' : '▾') + '</span></button>';

      var chips = CATS.map(function (c, i) {
        var n = catNodes[i] ? catNodes[i].length : c.names.length;
        var active = (pinned === i);
        var st = active ? ' style="display:inline-flex;align-items:center;gap:6px;border:1px solid ' + ACCENT + ';background:rgba(198,113,57,.18);color:#fff;border-radius:999px;padding:5px 9px;margin:3px;cursor:pointer;font:inherit;font-size:11px;white-space:nowrap;font-weight:600"' : '';
        var inner = c.label + ' <b style="opacity:.55;font-weight:600">' + n + '</b>';
        if (active) return '<button class="tmc-chip" data-i="' + i + '"' + st + '>' + inner + '</button>';
        return chip(inner, 'data-i="' + i + '"');
      }).join('');
      var clear = pinned >= 0 ? chip('Clear ✕', 'data-i="-1"') : '';

      panel.innerHTML = hdr +
        '<div id="tmc-b" style="display:' + (collapsed ? 'none' : 'flex') + ';flex-wrap:wrap;padding:2px 8px 10px;max-height:42vh;overflow:auto">' + chips + clear + '</div>';

      document.getElementById('tmc-h').onclick = function () { collapsed = !collapsed; render(); };
      Array.prototype.forEach.call(panel.querySelectorAll('.tmc-chip'), function (el) {
        var i = parseInt(el.getAttribute('data-i'), 10);
        el.onmouseenter = function () { if (pinned < 0 && i >= 0) apply(i); };
        el.onmouseleave = function () { if (pinned < 0) apply(-1); };
        el.onclick = function () {
          setPinned((i < 0 || i === pinned) ? -1 : i);
          render();
        };
      });
    }

    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (build()) { clearInterval(iv); render(); }
      else if (tries > 60) { clearInterval(iv); }
    }, 250);
  } catch (e) {}
})();
