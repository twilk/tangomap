// First-visit welcome on the map. Shows once (localStorage `tsm-onboarded`),
// themed with the map's own tokens, dismissible by button, backdrop, or Esc.
(function () {
  try {
    if (localStorage.getItem('tsm-onboarded')) return;
  } catch (e) {
    return;
  }

  function gv(n, f) {
    var els = [document.querySelector('.tsm'), document.querySelector('[style*="var(--t-"]'), document.body].filter(Boolean);
    for (var i = 0; i < els.length; i++) {
      var v = getComputedStyle(els[i]).getPropertyValue(n).trim();
      if (v) return v;
    }
    return f;
  }

  function show() {
    if (document.getElementById('tm-onboard')) return;
    var ink = gv('--t-ink', '#201e1d');
    var panel = gv('--t-panel', '#f9f4ed');
    var line = gv('--t-line', '#dcd3c4');
    var accent = gv('--t-accent', '#c67139');
    var muted = gv('--t-muted', '#645c50');

    var back = document.createElement('div');
    back.id = 'tm-onboard';
    back.setAttribute('role', 'dialog');
    back.setAttribute('aria-modal', 'true');
    back.setAttribute('aria-label', 'Welcome to Tango Map');
    back.style.cssText =
      'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;' +
      'padding:20px;background:rgba(0,0,0,.45);font-family:Figtree,system-ui,-apple-system,sans-serif';

    var step = function (n, t) {
      return (
        '<li style="display:flex;gap:12px;align-items:flex-start;margin:0 0 13px">' +
        '<span style="flex:none;width:24px;height:24px;border-radius:50%;background:' +
        accent +
        ';color:#fff;font:700 12px system-ui;display:inline-flex;align-items:center;justify-content:center">' +
        n +
        '</span><span style="font-size:14.5px;line-height:1.45;color:' +
        ink +
        '">' +
        t +
        '</span></li>'
      );
    };

    back.innerHTML =
      '<div style="max-width:400px;width:100%;background:' +
      panel +
      ';border:1px solid ' +
      line +
      ';border-radius:18px;padding:26px 24px;box-shadow:0 30px 60px -20px rgba(0,0,0,.5)">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">' +
      '<span style="width:11px;height:11px;border-radius:50%;background:' +
      accent +
      '"></span><span style="font:600 11px ui-monospace,monospace;letter-spacing:.2em;text-transform:uppercase;color:' +
      muted +
      '">Tango Map</span></div>' +
      '<h2 style="margin:0 0 6px;font:600 25px/1.1 Georgia,\'Times New Roman\',serif;color:' +
      ink +
      '">Welcome</h2>' +
      '<p style="margin:0 0 18px;font-size:14px;color:' +
      muted +
      ';line-height:1.5">62 Argentine tango skills, from your first steps to mastery. Here’s how it works:</p>' +
      '<ol style="list-style:none;margin:0 0 22px;padding:0">' +
      step('1', 'Tap any skill to mark it <b>mastered</b>.') +
      step('2', 'Watch your <b>Tango DNA</b> take shape.') +
      step('3', 'Sign in to <b>save</b> your progress and share your profile.') +
      '</ol>' +
      '<button id="tm-onboard-go" style="width:100%;padding:12px;border:0;border-radius:12px;background:' +
      accent +
      ';color:#fff;font:600 14.5px system-ui;cursor:pointer">Start exploring</button>';

    document.body.appendChild(back);

    function close() {
      try {
        localStorage.setItem('tsm-onboarded', '1');
      } catch (e) {}
      document.removeEventListener('keydown', onKey);
      back.remove();
    }
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    var go = document.getElementById('tm-onboard-go');
    if (go) {
      go.addEventListener('click', close);
      go.focus();
    }
    back.addEventListener('click', function (e) {
      if (e.target === back) close();
    });
    document.addEventListener('keydown', onKey);
  }

  // Let the map paint behind the overlay first.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(show, 600);
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      setTimeout(show, 600);
    });
  }
})();
