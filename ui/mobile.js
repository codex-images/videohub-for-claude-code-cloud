// Mobile layer for VideoHub: a hamburger button and a sidebar drawer, plus a touch control bar on the review screen.
// Below 820px only; on desktop it has no effect (the CSS hides the button and backdrop).
(function () {
  if (window.__vhMobile) return;
  window.__vhMobile = true;
  var root = document.documentElement;
  var mq = window.matchMedia('(max-width: 819.98px)');

  var burger = document.createElement('button');
  burger.id = 'vh-burger';
  burger.type = 'button';
  burger.setAttribute('aria-label', 'Open menu');
  burger.setAttribute('aria-expanded', 'false');
  burger.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

  var backdrop = document.createElement('div');
  backdrop.id = 'vh-backdrop';
  backdrop.setAttribute('aria-hidden', 'true');

  function side() { return document.querySelector('.app > .side'); }
  function isOpen() { return root.classList.contains('vh-drawer-open'); }
  function setOpen(on) {
    root.classList.toggle('vh-drawer-open', !!on);
    burger.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) {
      // The VideoHub editor uses the side-peek class to show the sidebar; do not leave it on
      var app = document.querySelector('.app');
      if (app) app.classList.remove('side-peek');
      var a = document.querySelector('.app > .side .nav a');
      if (a) { try { a.focus({ preventScroll: true }); } catch (e) { } }
    } else if (document.activeElement && side() && side().contains(document.activeElement)) {
      burger.focus({ preventScroll: true });
    }
  }

  burger.addEventListener('click', function () { setOpen(!isOpen()); });
  backdrop.addEventListener('click', function () { setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen()) setOpen(false); });
  // Choosing a link in the drawer closes it (even if it leads to the same screen)
  document.addEventListener('click', function (e) {
    var s = side();
    if (isOpen() && s && e.target.closest && e.target.closest('.app > .side a') && s.contains(e.target)) setOpen(false);
  }, true);
  window.addEventListener('hashchange', function () { setOpen(false); });
  var onChange = function () { if (!mq.matches) setOpen(false); };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else mq.addListener(onChange);

  // ---------- Review screen: a new touch control bar under the transport row (below 820px only; the original timeline stays)
  // The bar does not duplicate VideoHub logic; it drives the existing transport controls (ui/review/transport.js):
  //  - time: the hidden time field .tp-tcin; Enter on it runs parseTime and ctx.seek. It takes absolute seconds ("83.4"),
  //    relative ("+10", "-1") and frames ("+1f", "-1f", "k1234"). seek clamps to [0, length), so "+99999" reveals the length.
  //  - current time: the text of the .tc button ("m:ss.cc · frame N"), updated every frame; watched with a MutationObserver.
  //  - play/pause: the .play button (the ⏸ text means playing).
  //  - speed: the select in the transport row; a value plus a change event runs ctx.setRate.
  var SPEEDS = ['0.25', '0.5', '1', '1.5', '2'];
  var FMT = function (t) { t = Math.max(0, t || 0); var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };

  function buildBar(rv) {
    var center = rv.querySelector(':scope > .rv2-center');
    var transport = center && center.querySelector(':scope > .rv2-transport');
    if (!center || !transport || center.querySelector(':scope > .vh-tbar')) return;
    var tc = transport.querySelector('.tc'), tcIn = transport.querySelector('.tp-tcin'), play = transport.querySelector('.play'), speedSel = transport.querySelector('select');
    if (!tc || !tcIn) return;

    var state = { dur: 0, t: 0, drag: false };
    var seekTo = function (v) { // v: text the field understands
      tcIn.value = v;
      tcIn.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    };
    var readTime = function () { var m = /^(\d+):(\d{2}(?:\.\d+)?)/.exec(tc.textContent || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
    var readFrame = function () { var m = /frame (\d+)/.exec(tc.textContent || ''); return m ? +m[1] : null; };
    var pauseIfPlaying = function () { if (play && play.textContent.trim() === '⏸') play.click(); };

    var bar = document.createElement('div'); bar.className = 'vh-tbar';
    bar.innerHTML = '<div class="vh-scrub"><span class="vh-t vh-now">0:00.00</span><div class="vh-track" role="slider" aria-label="Position in video" tabindex="0"><div class="vh-rail"><i class="vh-fill"></i></div><b class="vh-thumb"></b></div><span class="vh-t vh-len">–:––</span></div>'
      + '<div class="vh-jumps"></div><div class="vh-speeds" role="group" aria-label="Speed"></div>';
    var now = bar.querySelector('.vh-now'), len = bar.querySelector('.vh-len'), track = bar.querySelector('.vh-track'), fill = bar.querySelector('.vh-fill'), thumb = bar.querySelector('.vh-thumb');

    var JUMPS = [['−10s', '-10'], ['−1s', '-1'], ['◀|', '-1f'], ['|▶', '+1f'], ['+1s', '+1'], ['+10s', '+10']];
    JUMPS.forEach(function (j) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = j[0]; b.setAttribute('aria-label', j[1]);
      b.addEventListener('click', function () { pauseIfPlaying(); seekTo(j[1]); });
      bar.querySelector('.vh-jumps').appendChild(b);
    });
    var speedBtns = SPEEDS.map(function (s) {
      var b = document.createElement('button'); b.type = 'button'; b.textContent = s + '×'; b.dataset.rate = s;
      b.addEventListener('click', function () {
        if (!speedSel) return;
        speedSel.value = s; speedSel.dispatchEvent(new Event('change', { bubbles: true }));
        paint();
      });
      bar.querySelector('.vh-speeds').appendChild(b);
      return b;
    });

    function paint() {
      var f = state.dur > 0 ? Math.min(1, Math.max(0, state.t / state.dur)) : 0;
      now.textContent = FMT(state.t);
      if (state.dur > 0) len.textContent = FMT(state.dur);
      fill.style.width = (f * 100) + '%'; thumb.style.left = (f * 100) + '%';
      track.setAttribute('aria-valuenow', String(Math.round(state.t * 100) / 100));
      if (state.dur > 0) track.setAttribute('aria-valuemax', String(Math.round(state.dur * 100) / 100));
      var cur = speedSel ? String(+speedSel.value) : '1';
      speedBtns.forEach(function (b) { b.classList.toggle('on', String(+b.dataset.rate) === cur); });
    }
    // Current time: follow the .tc button (not while dragging, so the thumb does not jump)
    var follow = function () { var t = readTime(); if (t != null && !state.drag) { state.t = t; paint(); } };
    new MutationObserver(follow).observe(tc, { childList: true, characterData: true, subtree: true });
    if (speedSel) speedSel.addEventListener('change', paint);

    // Drag and tap on the bar: at most one seek per requestAnimationFrame, without playing
    var pending = null, raf = 0;
    var flush = function () { raf = 0; if (pending != null) { var v = pending; pending = null; seekTo(v.toFixed(3)); } };
    var posFrom = function (e) {
      var r = track.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
      state.t = f * state.dur; paint();
      // keep slightly away from the end so seek does not clamp confusingly
      pending = Math.min(state.dur - 0.001, state.t); if (!raf) raf = requestAnimationFrame(flush);
    };
    track.addEventListener('pointerdown', function (e) {
      if (!(state.dur > 0)) return;
      state.drag = true; try { track.setPointerCapture(e.pointerId); } catch (x) { }
      pauseIfPlaying(); track.classList.add('drag'); posFrom(e); e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) { if (state.drag) posFrom(e); });
    var end = function () { if (!state.drag) return; state.drag = false; track.classList.remove('drag'); follow(); };
    track.addEventListener('pointerup', end); track.addEventListener('pointercancel', end);
    track.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowRight' ? '+1' : e.key === 'ArrowLeft' ? '-1' : null;
      if (d) { e.preventDefault(); e.stopPropagation(); seekTo(d); }
    });

    center.insertBefore(bar, transport.nextSibling);

    // Length: from a video element if there is one; otherwise jump to the end once and back (seek clamps to the length)
    var probe = function (tries) {
      var v = center.querySelector('video');
      if (v && isFinite(v.duration) && v.duration > 0) { state.dur = v.duration; paint(); return; }
      var t0 = readTime(), f0 = readFrame();
      if (t0 == null || f0 == null) { if (tries > 0) setTimeout(function () { probe(tries - 1); }, 400); return; }
      seekTo('+999999');
      setTimeout(function () {
        var d = readTime();
        seekTo('k' + f0);
        if (d != null && d > 0) { state.dur = d; state.t = t0; paint(); }
        else if (tries > 0) setTimeout(function () { probe(tries - 1); }, 400);
      }, 350);
    };
    setTimeout(function () { probe(4); }, 700);
    follow(); paint();
  }
  function syncReview() {
    if (!mq.matches) return; // on desktop the bar is not built and the player is not touched
    var rv = document.querySelector('.rv2');
    if (!rv) return;
    buildBar(rv);
    // A prominent back button to the project list, always in the top bar, even without the drawer
    var top = rv.querySelector(':scope > .rv2-top');
    if (top && !top.querySelector(':scope > .vh-home')) {
      var a = document.createElement('a'); a.className = 'vh-home'; a.href = '#/'; a.textContent = '‹ Projects';
      a.setAttribute('aria-label', 'Back to projects');
      top.insertBefore(a, top.firstChild);
    }
  }
  var mo = new MutationObserver(syncReview);
  if (mq.addEventListener) mq.addEventListener('change', syncReview); else mq.addListener(syncReview);

  function mount() {
    var m = document.getElementById('main');
    if (m) mo.observe(m, { childList: true, subtree: true });
    syncReview();
    if (!document.body) return;
    document.body.appendChild(backdrop);
    document.body.appendChild(burger);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
