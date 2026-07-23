(function () {
  try {
    // Read the map's own theme tokens so the controls match the bundle's bar.
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

    var signedIn = false;

    function render(el) {
      var ink = gv('--t-ink', '#201e1d');
      var panel = gv('--t-panel', '#f9f4ed');
      var line = gv('--t-line', '#dcd3c4');
      var accent = gv('--t-accent', '#c67139');
      el.id = 'tm-auth';
      el.style.cssText = 'display:inline-flex;gap:7px;align-items:center;flex:none;margin-left:6px;' +
        'font:600 13px Figtree,system-ui,-apple-system,sans-serif';
      function pill(href, label, primary) {
        return '<a href="' + href + '" style="text-decoration:none;border-radius:999px;padding:6px 13px;line-height:1;white-space:nowrap;' +
          'border:1px solid ' + (primary ? accent : line) + ';' +
          (primary ? 'background:' + accent + ';color:#fff' : 'background:' + panel + ';color:' + ink) + '">' + label + '</a>';
      }
      el.innerHTML = signedIn
        ? pill('/me', 'Profile', true) + pill('/settings', 'Settings', false) + pill('/signout', 'Sign out', false)
        : pill('/signin', 'Sign in', true);
    }

    // Mount inside the map's <header> so the controls flow within it (the
    // grow-to-fill search pushes them to the right), not floating over content.
    function mount() {
      var el = document.getElementById('tm-auth') || document.createElement('div');
      var header = document.querySelector('header');
      render(el);
      if (header) {
        el.style.position = '';
        if (el.parentNode !== header) header.appendChild(el);
        return true;
      }
      // Fallback: fixed top-right if the header hasn't rendered.
      el.style.position = 'fixed';
      el.style.top = '12px';
      el.style.right = '14px';
      el.style.zIndex = '2147483001';
      if (!el.parentNode && document.body) document.body.appendChild(el);
      return false;
    }

    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        signedIn = !!(s && s.user);
        mount();
        // Re-render the pills whenever the map flips theme, so their colours
        // (panel/ink/line/accent) track light↔dark instead of freezing at the
        // value read when they first mounted. attributeFilter keeps this cheap:
        // it only fires on data-theme mutations, wherever in the tree they land.
        try {
          var mo = new MutationObserver(function () {
            var el = document.getElementById('tm-auth');
            if (el) render(el);
          });
          mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
        } catch (e) {}
        // Keep it mounted in the header through the map's own re-renders.
        setInterval(function () {
          var header = document.querySelector('header');
          var el = document.getElementById('tm-auth');
          if (header && (!el || el.parentNode !== header)) mount();
        }, 800);
      })
      .catch(function () {});
  } catch (e) {}
})();
