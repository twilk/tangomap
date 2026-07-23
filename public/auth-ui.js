(function () {
  try {
    // Read the map's own theme tokens so the controls match the bundle's bar
    // (any element inside the themed scope resolves the inherited custom props).
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

    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var signedIn = !!(s && s.user);
        var ink = gv('--t-ink', '#201e1d');
        var panel = gv('--t-panel', '#f9f4ed');
        var line = gv('--t-line', '#dcd3c4');
        var accent = gv('--t-accent', '#c67139');

        var el = document.getElementById('tm-auth') || document.createElement('div');
        el.id = 'tm-auth';
        el.style.cssText =
          'position:fixed;top:12px;right:14px;z-index:2147483001;display:flex;gap:7px;align-items:center;' +
          'font:600 13px Figtree,system-ui,-apple-system,sans-serif';
        function pill(href, label, primary) {
          return '<a href="' + href + '" style="text-decoration:none;border-radius:999px;padding:7px 13px;line-height:1;white-space:nowrap;' +
            'border:1px solid ' + (primary ? accent : line) + ';' +
            (primary ? 'background:' + accent + ';color:#fff' : 'background:' + panel + ';color:' + ink) +
            '">' + label + '</a>';
        }
        if (signedIn) {
          el.innerHTML = pill('/me', 'Profile', true) + pill('/settings', 'Settings', false) + pill('/signout', 'Sign out', false);
        } else {
          el.innerHTML = pill('/signin', 'Sign in', true);
        }
        if (!el.parentNode && document.body) document.body.appendChild(el);
      })
      .catch(function () {});
  } catch (e) {}
})();
