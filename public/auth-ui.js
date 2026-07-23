(function () {
  try {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var signedIn = !!(s && s.user);
        var el = document.getElementById('tm-auth') || document.createElement('div');
        el.id = 'tm-auth';
        el.style.cssText =
          'position:fixed;top:8px;right:8px;z-index:2147483001;display:flex;gap:4px;align-items:center;' +
          'background:rgba(17,13,9,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);' +
          'border:1px solid rgba(241,233,220,.14);border-radius:999px;padding:4px;' +
          'font:600 12.5px system-ui,-apple-system,Segoe UI,sans-serif';
        var link = function (href, label, primary) {
          return (
            '<a href="' + href + '" style="text-decoration:none;border-radius:999px;padding:6px 12px;white-space:nowrap;' +
            (primary
              ? 'background:#c67139;color:#fff'
              : 'color:#f2eadc') +
            '">' + label + '</a>'
          );
        };
        if (signedIn) {
          el.innerHTML = link('/settings', 'Settings', false) + link('/signout', 'Sign out', true);
        } else {
          el.innerHTML = link('/signin', 'Sign in', true);
        }
        if (!el.parentNode && document.body) document.body.appendChild(el);
      })
      .catch(function () {});
  } catch (e) {}
})();
