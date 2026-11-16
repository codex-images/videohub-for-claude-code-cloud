// hyperframes-videohub.js (EXPERIMENTAL): lets VideoHub's live preview drive a HyperFrames composition.
// Based on the documented seek protocol (window.__hf = { duration, seek(time) }) and the standalone GSAP registry
// (window.__timelines[id] with seek/pause/time/duration). Not yet verified against a real VideoHub run: see README.
// Include after videohub-adapter.js (copy it from ../remotion/) and after the composition's own scripts.
(function () {
  function find() {
    // 1) the engine page contract: window.__hf.seek(time)
    var hf = window.__hf;
    if (hf && typeof hf.seek === 'function') {
      var t0 = 0;
      return {
        total: function () { return +hf.duration || 0; },
        seekTo: function (s) { t0 = s; hf.seek(s); },
        play: function () {}, pause: function () {},   // seek-only: continuous playback is done by successive seeks
        time: function () { return t0; },
      };
    }
    // 2) standalone GSAP master timeline registered at window.__timelines
    var reg = window.__timelines, tl = reg && (reg.main || reg[Object.keys(reg)[0]]);
    if (tl && typeof tl.seek === 'function') return {
      total: function () { return tl.duration(); },
      seekTo: function (s) { tl.pause(); tl.seek(s, false); },
      play: function () { tl.play(); }, pause: function () { tl.pause(); },
      time: function () { return tl.time(); },
    };
    return null;
  }
  window.HFVideoHub = {
    install: function (opt) {
      opt = opt || {};
      (function wait() {
        var p = find();
        if (!p) return setTimeout(wait, 100);
        var total = p.total();
        if (!total) return setTimeout(wait, 100);
        VHAdapter.install({
          total: total,
          seekTo: p.seekTo, play: p.play, pause: p.pause, time: p.time,
          // every <video> in the composition has its frame
          ready: function () { return [].every.call(document.querySelectorAll('video'), function (v) { return v.readyState >= 3 && !v.seeking; }); },
        }, opt);
      })();
    },
  };
})();
