/* Tango Map — deep-link the "Skill Details" panel to the knowledge base.
   When a skill is selected on the map, its details panel gains a "Read the guide →"
   link to /skill/[slug]. For signed-in teachers, skills that have a lesson video
   also get a "video" badge (same gate as the /skills index, via /api/teacher-videos).
   The name→slug map comes from /api/skill-index (slugs are hand-authored, not
   derivable from names). Self-contained; a no-op if the map/panel never renders. */
(function () {
  try {
    var SLUG = null; // { normalizedName: slug } — null until /api/skill-index resolves
    var VIDEO = null; // teacher's video slugs; [] for non-teachers
    var norm = function (s) {
      try { return String(s).normalize('NFC').replace(/\s+/g, ' ').trim(); } catch (e) { return String(s).trim(); }
    };

    fetch('/api/skill-index').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      SLUG = {};
      if (d && d.skills) d.skills.forEach(function (s) { SLUG[norm(s.name)] = s.slug; });
    }).catch(function () { SLUG = {}; });

    fetch('/api/teacher-videos').then(function (r) { return r.ok ? r.json() : { slugs: [] }; }).then(function (d) {
      VIDEO = (d && Array.isArray(d.slugs)) ? d.slugs : [];
    }).catch(function () { VIDEO = []; });

    function accentOf(el) {
      var v = getComputedStyle(el).getPropertyValue('--t-accent').trim();
      return v || '#c67139';
    }
    function findAside() {
      var as = document.querySelectorAll('aside');
      for (var i = 0; i < as.length; i++) if (/SKILL DETAILS/i.test(as[i].textContent || '')) return as[i];
      return null;
    }
    // The selected skill's name is the first leaf element whose exact text is a
    // known skill name — it sits above any prerequisite / lesson lists in the panel.
    function selected(aside) {
      if (!SLUG) return null;
      var els = aside.querySelectorAll('span, div, h1, h2, h3');
      for (var i = 0; i < els.length; i++) {
        if (els[i].children.length) continue;
        var t = norm(els[i].textContent || '');
        if (t && SLUG[t]) return { slug: SLUG[t] };
      }
      return null;
    }

    function ensure(aside) {
      var sel = selected(aside);
      var box = aside.querySelector('#tm-sklink');
      if (!sel) { if (box && box.parentNode) box.parentNode.removeChild(box); return; }
      var accent = accentOf(aside);
      if (!box) {
        box = document.createElement('div');
        box.id = 'tm-sklink';
        box.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:16px 16px 8px';
        aside.appendChild(box);
      }
      var hasVid = !!(VIDEO && VIDEO.indexOf(sel.slug) >= 0);
      if (box.__slug === sel.slug && box.__vid === hasVid && box.__ac === accent) return;
      box.__slug = sel.slug; box.__vid = hasVid; box.__ac = accent;
      var link = '<a href="/skill/' + sel.slug + '" style="display:inline-flex;align-items:center;gap:6px;' +
        'font:600 13.5px Figtree,system-ui,sans-serif;color:' + accent + ';text-decoration:none">' +
        'Read the guide <span aria-hidden="true">→</span></a>';
      var badge = hasVid ? '<span style="font:600 9px ui-monospace,Menlo,monospace;letter-spacing:.06em;' +
        'text-transform:uppercase;color:' + accent + ';border:1px solid ' + accent + '55;border-radius:999px;' +
        'padding:2px 8px">▶ video</span>' : '';
      box.innerHTML = link + badge;
    }

    // Re-apply so it survives the panel's own re-renders. Idempotent (ensure()
    // bails early when the slug/video/accent triple is unchanged), so it's safe
    // to run on every coordinator pass.
    function reconcile() {
      var aside = findAside();
      if (aside) ensure(aside);
    }

    // Driven by the shared coordinator (map-runtime.js) instead of a private
    // interval. Injected script order isn't guaranteed, so queue for the
    // coordinator if it hasn't executed yet — and if it never shows up at all,
    // fall back to this script's original standalone polling.
    (function registerReconcile() {
      var FALLBACK = 600;
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
