/* Tango Map — fill the idle "Skill Details" panel with a home card.
   On arrival nothing is selected, so the right-hand <aside> sits empty ("Nothing
   selected yet…") for about a third of the viewport. This injected enhancement
   puts something useful there until the visitor picks a node:
     • signed in  — their progress, up to 3 "next up" skills (each deep-linked to
                    /skill/[slug]) and pills to /me and /me/card,
     • signed out — a short invitation to sign in, plus a link to /skills.
   The moment a skill IS selected the block removes itself so the real details
   show. Data comes from /api/next; if that fetch fails we render nothing at all
   (never a spinner, never an error — the panel just stays as it was).
   Self-contained; no imports; a no-op if the map/panel never renders. */
(function () {
  try {
    var DATA = null; // null = pending, false = failed (render nothing), object = payload

    fetch('/api/next', { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { DATA = (d && typeof d === 'object') ? d : false; })
      .catch(function () { DATA = false; });

    // Same token lookup as the other injected scripts: read the bundle's own
    // CSS custom properties off whichever element actually carries them.
    function gv(n, f) {
      var els = [
        document.querySelector('[style*="var(--t-"]'),
        document.querySelector('.tsm'),
        document.querySelector('.sc-host'),
        document.body
      ].filter(Boolean);
      for (var i = 0; i < els.length; i++) {
        var v = getComputedStyle(els[i]).getPropertyValue(n).trim();
        if (v) return v;
      }
      return f;
    }
    function hexa(hex, a) {
      hex = String(hex).replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(function (x) { return x + x; }).join('');
      var n = parseInt(hex, 16);
      if (isNaN(n)) return 'rgba(198,113,57,' + a + ')';
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }
    function esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // Same panel lookup as map-skilllink.js.
    function findAside() {
      var as = document.querySelectorAll('aside');
      for (var i = 0; i < as.length; i++) if (/SKILL DETAILS/i.test(as[i].textContent || '')) return as[i];
      return null;
    }
    // The bundle prints "Nothing selected yet." only while the selection is
    // empty, so its presence IS the empty state. Our own block never contains
    // that phrase, so appending to the aside can't fool this check.
    function isIdle(aside) {
      return /Nothing selected yet/i.test(aside.textContent || '');
    }

    function fontMono(size) { return 'font:600 ' + size + ' ui-monospace,Menlo,monospace'; }
    function fontUi(weight, size) { return 'font:' + weight + ' ' + size + ' Figtree,system-ui,-apple-system,sans-serif'; }

    function label(text, muted) {
      return '<div style="' + fontMono('10px') + ';letter-spacing:.14em;text-transform:uppercase;color:' + muted +
        ';margin-bottom:10px">' + esc(text) + '</div>';
    }
    function pill(href, text, primary, accent, ink, muted) {
      return '<a href="' + href + '" style="text-decoration:none;border-radius:999px;padding:6px 13px;line-height:1;white-space:nowrap;' +
        fontUi('600', '13px') + ';border:1px solid ' + (primary ? accent : hexa(muted, 0.35)) + ';' +
        (primary ? 'background:' + accent + ';color:#fff' : 'color:' + ink) + '">' + esc(text) + '</a>';
    }

    function html(d, accent, ink, muted) {
      var line = hexa(muted, 0.2);
      if (!d.signedIn) {
        return label('Start your climb', muted) +
          '<div style="' + fontUi('500', '13.5px') + ';line-height:1.55;color:' + ink + '">' +
          'Sign in to mark what you can already dance — the map then tracks your progress and tells you what to learn next.' +
          '</div>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px">' +
          pill('/signin', 'Sign in', true, accent, ink, muted) +
          '<a href="/skills" style="text-decoration:none;' + fontUi('600', '13px') + ';color:' + accent + '">' +
          'Browse the guide <span aria-hidden="true">&rarr;</span></a>' +
          '</div>';
      }
      var total = d.total > 0 ? d.total : 0;
      var done = d.mastered > 0 ? d.mastered : 0;
      var pct = total ? Math.round((done / total) * 100) : 0;
      var next = Array.isArray(d.next) ? d.next.slice(0, 3) : [];
      var rows = next.map(function (s) {
        return '<a href="/skill/' + encodeURIComponent(s.slug) + '" style="display:block;text-decoration:none;padding:9px 0;border-top:1px solid ' + line + '">' +
          '<div style="display:flex;align-items:baseline;gap:8px">' +
          '<span style="' + fontUi('600', '14px') + ';color:' + ink + '">' + esc(s.name) + '</span>' +
          '<span style="' + fontMono('10px') + ';color:' + muted + '">L' + esc(s.level) + '</span>' +
          '</div>' +
          '<div style="' + fontUi('500', '12px') + ';color:' + muted + ';margin-top:2px">' + esc(s.reason) + '</div>' +
          '</a>';
      }).join('');
      return label('Your climb', muted) +
        '<div style="display:flex;align-items:baseline;gap:7px">' +
        '<span style="' + fontMono('26px') + ';color:' + accent + '">' + done + '</span>' +
        '<span style="' + fontUi('600', '13px') + ';color:' + muted + '">/ ' + total + ' skills mastered</span>' +
        '</div>' +
        '<div style="height:6px;border-radius:999px;background:' + hexa(muted, 0.18) + ';margin:10px 0 16px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + accent + ';border-radius:999px"></div>' +
        '</div>' +
        (next.length
          ? '<div style="' + fontMono('10px') + ';letter-spacing:.14em;text-transform:uppercase;color:' + muted + ';margin-bottom:2px">Next up</div>' + rows
          : '<div style="' + fontUi('500', '13.5px') + ';line-height:1.55;color:' + ink + '">Every skill on the map is marked mastered. Pick any node to revisit it.</div>') +
        '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px">' +
        pill('/me', 'Profile', true, accent, ink, muted) +
        pill('/me/card', 'Card', false, accent, ink, muted) +
        '</div>';
    }

    function ensure(aside) {
      var box = aside.querySelector('#tm-home');
      // Selected, still loading, or the fetch failed → own nothing in the panel.
      if (!DATA || !isIdle(aside)) {
        if (box && box.parentNode) box.parentNode.removeChild(box);
        return;
      }
      var accent = gv('--t-accent', '#c67139');
      var ink = gv('--t-ink', '#201e1d');
      var muted = gv('--t-muted', '#645c50');
      var markup = html(DATA, accent, ink, muted);
      if (!box) {
        box = document.createElement('div');
        box.id = 'tm-home';
        box.style.cssText = 'margin:14px 16px 8px';
        aside.appendChild(box);
      }
      // Rebuild only when the rendered markup would actually differ (covers both
      // data arrival and a light↔dark token flip) — otherwise leave the DOM alone.
      if (box.__sig === markup) return;
      box.__sig = markup;
      box.innerHTML = markup;
    }

    // Idempotent: safe to run on every coordinator pass.
    function reconcile() {
      var aside = findAside();
      if (aside) ensure(aside);
    }

    // Driven by the shared coordinator (map-runtime.js) instead of a private
    // interval. Injected script order isn't guaranteed, so queue for the
    // coordinator if it hasn't executed yet — and only if it never shows up at
    // all do we fall back to standalone polling.
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
