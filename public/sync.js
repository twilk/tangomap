(function () {
  try {
    // Cross-device progress sync (mastered skills + theme MODE), last-write-wins.
    // The clock is `tsm-updated`: the ms timestamp of the last REAL local change.
    // On load we reconcile by clock (adopt whichever side is newer); thereafter we
    // push ONLY when the mastered set or theme actually changes — never on the map's
    // incidental DOM churn, which is what used to let a stale device clobber a fresh
    // one. The server (/api/progress) is the arbiter: it rejects a write older than
    // what it holds and returns the authoritative row, which we then adopt.
    var KEY_M = 'tsm-mastered', KEY_T = 'tsm-theme', KEY_TS = 'tsm-updated';
    function lget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lset(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    function localMastered() {
      try { var a = JSON.parse(lget(KEY_M) || '[]'); return Array.isArray(a) ? a.filter(function (x) { return typeof x === 'string'; }) : []; }
      catch (e) { return []; }
    }
    function localClock() { var n = parseInt(lget(KEY_TS) || '0', 10); return isNaN(n) ? 0 : n; }
    function key(arr) { return arr.slice().sort().join('|'); }
    function sameSet(a, b) { return key(a) === key(b || []); }

    var lastM = key(localMastered());  // mastered set we believe the server holds
    var lastT = lget(KEY_T);           // theme we believe the server holds
    var pushing = false, timer = 0;

    function adopt(s) {
      lset(KEY_M, JSON.stringify(s.mastered || []));
      if (s.theme) lset(KEY_T, s.theme);
      lset(KEY_TS, String(Date.parse(s.updatedAt) || Date.now()));
      lastM = key(s.mastered || []); lastT = s.theme || lastT;
    }
    function reloadOnce() {
      try { if (!sessionStorage.getItem('tm-reconciled')) { sessionStorage.setItem('tm-reconciled', '1'); location.reload(); } } catch (e) {}
    }

    function push(ts) {
      if (pushing) return;
      pushing = true;
      var sentM = localMastered(), sentT = lget(KEY_T);
      fetch('/api/progress', {
        method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mastered: sentM, theme: sentT, sel: null, updatedAt: new Date(ts).toISOString() }),
      }).then(function (r) { return r.ok ? r.json() : null; }).then(function (srv) {
        pushing = false;
        if (!srv || !srv.updatedAt) return;
        // Arbiter's verdict: if it handed back something other than what we sent, the
        // server had newer state (our write was rejected as stale) — adopt + re-render.
        if (!sameSet(srv.mastered || [], sentM) || (srv.theme && srv.theme !== sentT)) {
          adopt(srv); reloadOnce();
        } else {
          lastM = key(srv.mastered || []); lastT = srv.theme || sentT;
          lset(KEY_TS, String(Date.parse(srv.updatedAt) || ts));
        }
      }).catch(function () { pushing = false; });
    }

    // Push only when the set or theme genuinely differs from what we last synced.
    function runCheck() {
      if (key(localMastered()) === lastM && lget(KEY_T) === lastT) return;  // nothing actually changed
      var ts = Date.now(); lset(KEY_TS, String(ts));
      push(ts);
    }
    function scheduleCheck() { clearTimeout(timer); timer = setTimeout(runCheck, 500); }

    fetch('/api/progress', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      if (!s || !s.updatedAt) return;                 // signed out / no body -> no sync
      var serverTs = Date.parse(s.updatedAt) || 0;
      var lc = localClock();
      var local = localMastered();

      if (lc === 0 && local.length && !sameSet(local, s.mastered || [])) {
        // First sync on this browser with pre-existing local progress: union once so
        // nothing is lost (SPEC: first login merges, never discards), then push.
        var u = {}; local.concat(s.mastered || []).forEach(function (x) { u[x] = 1; });
        lset(KEY_M, JSON.stringify(Object.keys(u)));
        lastM = '';                                   // force the push to send the union
        push(Date.now());
      } else if (serverTs > lc) {
        // Another device wrote more recently -> adopt the server, re-render if it
        // changes what we currently show.
        var changed = !sameSet(s.mastered || [], local) || (s.theme && s.theme !== lget(KEY_T));
        adopt(s);
        if (changed) { reloadOnce(); return; }
      } else if (lc > serverTs) {
        push(lc);                                     // our local is newer -> push it
      } else {
        // Already in sync (equal clocks). Hydrate theme if local has none, then
        // baseline lastT to the ACTUAL local theme so a null-vs-server mismatch
        // can't masquerade as a change and trigger a spurious push.
        if (s.theme && !lget(KEY_T)) lset(KEY_T, s.theme);
        lastM = key(s.mastered || []); lastT = lget(KEY_T);
      }

      try {
        new MutationObserver(scheduleCheck).observe(document.documentElement, {
          subtree: true, childList: true, attributes: true, attributeFilter: ['data-theme'],
        });
      } catch (e) {}
      window.addEventListener('storage', function (e) { if (e.key === KEY_M || e.key === KEY_T) scheduleCheck(); });
    }).catch(function () {});
  } catch (e) {}
})();
