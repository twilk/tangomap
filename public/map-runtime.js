/* Tango Map — shared reconcile coordinator for the injected map enhancements.
   The map is a re-rendering SPA, so every injected enhancement has to re-assert
   itself after the app repaints. Rather than each script running its own forever
   `setInterval`, they register a single idempotent reconcile function here and
   this file drives them all from ONE scheduler:

     • an initial pass as soon as <body> exists,
     • a debounced MutationObserver (a big React re-render coalesces into one pass),
     • a low-frequency backstop interval — the observer only watches childList, so
       state-only/attribute-only re-renders need a guaranteed convergence tick.

   API (global):
     window.__tmRuntime.register(fn)   register an idempotent reconcile pass
     window.__tmRuntime.run()          force a pass now (no-op while one is running)

   Injected script order isn't guaranteed (the injector appends new tags before
   </head>, so a client may execute first), therefore clients that don't find
   __tmRuntime push onto window.__tmRuntimeQueue and this file drains it on load.
   Self-contained; no imports, no deps, no-op if the DOM never materialises. */
(function () {
  try {
    if (window.__tmRuntime) return; // already installed

    var DEBOUNCE = 150;   // coalesce a burst of mutations into one pass
    var BACKSTOP = 2000;  // guaranteed convergence tick

    var fns = [];
    var running = false;  // re-entrancy guard: never start a pass inside a pass
    var started = false;
    var timer = null;
    var observer = null;

    // Run every registered pass. Each one is individually try/catch'd so a single
    // throwing enhancement can never take down the others (or the scheduler).
    function runAll() {
      if (running) return;
      running = true;
      if (timer) { clearTimeout(timer); timer = null; }
      try {
        for (var i = 0; i < fns.length; i++) {
          try { fns[i](); } catch (e) {}
        }
      } catch (e) {}
      running = false;
      // Drop the mutation records our own injections just produced, so the
      // observer doesn't immediately re-fire on our own work (feedback loop).
      try { if (observer) observer.takeRecords(); } catch (e) {}
    }

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; runAll(); }, DEBOUNCE);
    }

    function onMutations() {
      if (running) return; // ignore anything we caused ourselves
      schedule();
    }

    function start() {
      if (started) return;
      if (!document.body) { setTimeout(start, 50); return; } // wait for <body>
      started = true;
      try {
        if (window.MutationObserver) {
          observer = new MutationObserver(onMutations);
          observer.observe(document.body, { childList: true, subtree: true });
        }
      } catch (e) {}
      setInterval(runAll, BACKSTOP);
      runAll();
    }

    function register(fn) {
      if (typeof fn !== 'function') return false;
      if (fns.indexOf(fn) >= 0) return true; // idempotent registration
      fns.push(fn);
      if (started) schedule();
      return true;
    }

    var queued = window.__tmRuntimeQueue;
    window.__tmRuntime = { register: register, run: runAll };
    window.__tmRuntimeQueue = null;
    if (queued && queued.length) {
      for (var q = 0; q < queued.length; q++) register(queued[q]);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  } catch (e) {}
})();
