// Keep the map's theme in sync with localStorage['tsm-theme'] when it changes
// outside the map's own toggle:
//   • storage event  → another tab (an app page or a second map) flipped theme
//   • pageshow[persisted] → returning to the map from the bfcache, where the map's
//     React state is frozen at whatever it was when the page was cached
// We flip via the map's own theme button (not by poking data-theme directly), so
// the map's React state, toggle label, and stored value all stay consistent.
//
// Also keeps meta[theme-color] in step with the map's ground (--t-bg) so the
// mobile browser chrome bar tracks the theme — the bundle ships a static light
// value that would otherwise stay light in dark mode. A MutationObserver on
// data-theme covers every source (the map's own toggle included).
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
  function setThemeColor() {
    try {
      var r = root();
      if (!r) return;
      var bg = getComputedStyle(r).getPropertyValue('--t-bg').trim();
      if (!bg) bg = r.getAttribute('data-theme') === 'dark' ? '#2e2b25' : '#f5ead8';
      var m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement('meta'); m.setAttribute('name', 'theme-color'); document.head.appendChild(m); }
      m.setAttribute('content', bg);
    } catch (e) {}
  }
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === 'tsm-theme') sync();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) sync();
  });
  // Update the chrome-bar colour whenever the map applies or flips its theme
  // (the map sets data-theme on .tsm, a descendant, so observe the subtree).
  try {
    new MutationObserver(setThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true });
  } catch (e) {}
  setThemeColor();
})();
