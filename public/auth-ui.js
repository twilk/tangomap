(function () {
  try {
    fetch('/api/auth/session', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var signedIn = !!(s && s.user);
        var el = document.getElementById('tm-auth') || document.createElement('div');
        el.id = 'tm-auth';
        el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:2147483001;font:600 13px system-ui,sans-serif';
        var href = signedIn ? '/api/auth/signout' : '/api/auth/signin';
        var label = signedIn ? 'Sign out' : 'Sign in with Google';
        el.innerHTML = '<a href="' + href + '" style="text-decoration:none;background:#c67139;color:#fff;border-radius:999px;padding:6px 12px">' + label + '</a>';
        if (!el.parentNode && document.body) document.body.appendChild(el);
      })
      .catch(function () {});
  } catch (e) {}
})();
