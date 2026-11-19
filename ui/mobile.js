// Mobile layer for VideoHub: a hamburger button and a sidebar drawer.
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

  function mount() {
    if (!document.body) return;
    document.body.appendChild(backdrop);
    document.body.appendChild(burger);
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
