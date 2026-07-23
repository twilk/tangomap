// Keep the map's theme in sync with localStorage['tsm-theme'] when it changes
// outside the map's own toggle:
//   • storage event  → another tab (an app page or a second map) flipped theme
//   • pageshow[persisted] → returning to the map from the bfcache, where the map's
//     React state is frozen at whatever it was when the page was cached
// We flip via the map's own theme button (not by poking data-theme directly), so
// the map's React state, toggle label, and stored value all stay consistent.
(function () {
  function want() {
    try { return localStorage.getItem('tsm-theme') === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
  }
  function root() {
    return document.querySelector('.tsm[data-theme]') || document.documentElement;
  }
  function themeBtn() {
    var bs = document.querySelectorAll('header button');
    for (var i = 0; i < bs.length; i++) {
      if (/theme/i.test(bs[i].getAttribute('aria-label') || '')) return bs[i];
    }
    return null;
  }
  function sync() {
    try {
      var r = root();
      if (!r || r.getAttribute('data-theme') === want()) return;
      var b = themeBtn();
      if (b) b.click();
      else r.setAttribute('data-theme', want());
    } catch (e) {}
  }
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === 'tsm-theme') sync();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) sync();
  });
})();
