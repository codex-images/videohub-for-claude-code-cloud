// videohub-adapter.js: generic bridge between VideoHub's live preview and a frame-seekable player (Remotion's <Player>,
// HyperFrames, or any page that can jump to a time). VideoHub drives the page through window.renderOut(t) and waits for
// window.READY. Usage in the page:
//   VHAdapter.install(player, { preload: 'preload.json', audio: 'audio/mix.mp3', fps: 30 })
// where player = { total, seekTo(sec), play(), pause(), time(), ready() } (seconds). The player itself must stay muted:
// VideoHub plays a silent file (live.audio) and this adapter plays the real mix from the page, synced to the player clock.
(function () {
  window.VHAdapter = {
    install: function (player, opt) {
      opt = opt || {};
      // Sync calibration: ?offset=-0.05 in the URL (seconds; negative = video earlier), or an "offset" field in data.json.
      var VH = (window.VH = window.VH || {}); VH.offset = 0;
      var qo = new URLSearchParams(location.search).get('offset');
      if (qo !== null && !isNaN(parseFloat(qo))) VH.offset = parseFloat(qo);
      else fetch('data.json').then(function (r) { return r.json(); }).then(function (d) { if (d && typeof d.offset === 'number') VH.offset = d.offset; }).catch(function () {});
      // Audio: one element in the page itself (the full mix, mp3), synced to the player clock like the video.
      // Calibration: ?aoffset=0.03 (positive = audio later).
      var RENDER = /[?&]render=1/.test(location.search); // file render: no audio, no preloading, short wait per frame
      var au = null, aoff = parseFloat(new URLSearchParams(location.search).get('aoffset') || '0') || 0;
      if (opt.audio && !RENDER) { au = new Audio(); au.preload = 'auto'; au.src = opt.audio; VH.audio = au; }
      function aStop() { if (au && !au.paused) au.pause(); }
      function aPlay(t) { if (au) { au.currentTime = Math.max(0, t + aoff); au.playbackRate = 1; au.play().catch(function (e) { VH.audioBlocked = String(e); }); } }
      function aSync(t) {
        if (!au) return;
        var d = au.currentTime - (t + aoff);
        if (au.paused) { aPlay(t); return; }
        if (Math.abs(d) > 0.2) { au.currentTime = Math.max(0, t + aoff); au.playbackRate = 1; }
        else au.playbackRate = Math.abs(d) < 0.015 ? 1 : Math.min(1.1, Math.max(0.9, 1 - d * 2));
      }
      var lastT = -1, lastWall = 0, playing = false, timer = null;
      function stop() { if (playing) { player.pause(); playing = false; } aStop(); }
      function exact(t) {
        stop(); player.seekTo(t);
        return new Promise(function (res) {
          var t0 = performance.now();
          (function tick() {
            var dt = performance.now() - t0;
            if ((dt > (RENDER ? 40 : 200) && player.ready()) || dt > 3000) { if (RENDER) requestAnimationFrame(function () { requestAnimationFrame(function () { res(); }); }); else res(); } else setTimeout(tick, RENDER ? 8 : 30);
          })();
        });
      }
      window.renderOut = function (t) {
        t = Math.min(Math.max(t, 0), player.total - 0.034);
        var now = performance.now(), dw = now - lastWall, dt = t - lastT;
        var wasT = lastT; lastT = t; lastWall = now;
        clearTimeout(timer); timer = setTimeout(stop, 150);
        // Continuous playback: calls at real-time pace (under 150 ms apart), time moving forward by up to 0.1 s
        var cont = !RENDER && wasT >= 0 && dw < 150 && dt >= 0 && dt <= 0.1;
        if (cont) {
          if (!playing) { player.seekTo(t); player.play(); playing = true; aPlay(t); }
          else { if (Math.abs(player.time() - t) > 0.25) player.seekTo(t); aSync(t); }
          return Promise.resolve();
        }
        // A jump, time going backwards, or a call after a pause: pause and seek exactly (also frame-by-frame export)
        return exact(t);
      };
      // Preload every clip (opt.preload = URL of a JSON list of files) so there is no black frame at cuts between clips.
      var pre = opt.preload && !RENDER ? fetch(opt.preload).then(function (r) { return r.json(); }).then(function (l) {
        return Promise.all(l.map(function (u) { return fetch(u).then(function (r) { return r.blob(); }).then(function (b) { (window.VH_BLOBS = window.VH_BLOBS || {})[u] = URL.createObjectURL(b); }).catch(function () {}); }));
      }).catch(function () {}) : Promise.resolve();
      pre.then(function () { setTimeout(function () { window.READY = true; }, opt.readyMs || 500); });
    },
  };
})();
