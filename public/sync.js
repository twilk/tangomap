(function () {
  try {
    var KEY_M = 'tsm-mastered', KEY_T = 'tsm-theme';
    function lget(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
    function lset(k,v){ try { localStorage.setItem(k,v); } catch (e) {} }
    function localMastered(){ try { var a = JSON.parse(lget(KEY_M) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    var server = null, t = 0;
    function pushNow(){
      var u = {}; localMastered().forEach(function (s){ u[s] = 1; });
      if (server && server.mastered) server.mastered.forEach(function (s){ u[s] = 1; });
      fetch('/api/progress', { method:'PUT', credentials:'same-origin', headers:{'content-type':'application/json'},
        body: JSON.stringify({ mastered: Object.keys(u), theme: lget(KEY_T), sel: null }) })
        .then(function (r){ return r.ok ? r.json() : null; }).then(function (j){ if (j) server = j; }).catch(function(){});
    }
    function schedule(){ clearTimeout(t); t = setTimeout(pushNow, 800); }
    fetch('/api/progress', { credentials:'same-origin' }).then(function (r){ return r.ok ? r.json() : null; }).then(function (s){
      if (!s || !s.updatedAt) return;            // signed out / no body -> no-op
      server = s;
      if (localMastered().length === 0 && s.mastered && s.mastered.length) lset(KEY_M, JSON.stringify(s.mastered));
      if (s.theme && !lget(KEY_T)) lset(KEY_T, s.theme);
      schedule();                                 // first-run migration: push union
      try { new MutationObserver(schedule).observe(document.documentElement, { subtree:true, childList:true }); } catch (e) {}
      window.addEventListener('storage', function (e){ if (e.key === KEY_M || e.key === KEY_T) schedule(); });
    }).catch(function(){});
  } catch (e) {}
})();
