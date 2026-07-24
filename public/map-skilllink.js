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

    // Re-apply on a light interval so it survives the panel's own re-renders.
    setInterval(function () {
      var aside = findAside();
      if (aside) ensure(aside);
    }, 600);
  } catch (e) {}
})();
