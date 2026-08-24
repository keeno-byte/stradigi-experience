/* lab-sound.js - sound design (2026-08-23, award pass). No audio files:
 * every cue is synthesized in Web Audio, a few milliseconds each, mixed
 * at roughly -24 dB under the intro's own drone.
 *
 *   START         a filtered click + a short rising blip
 *   scrolly step  a low air whoosh (rail tick changes)
 *   crane         a soft metallic clunk as each system name lights
 *   odometer      a ratchet of six ticks as a price rolls
 *   relay leg     a two-note chime when a leg completes
 *
 * Follows the intro's MUTE state (aria-pressed on #mute-btn) and the nav
 * sound toggle this file adds. Context is created suspended at load and
 * resumed on the first gesture, so nothing opens a device on the click. */
(function () {
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var ctx = null, master = null, noiseBuf = null;
  var muted = false;

  function ensure() {
    if (ctx) return ctx;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.07;
    master.connect(ctx.destination);
    var len = ctx.sampleRate * 1.2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function resume() { if (ctx && ctx.state === "suspended") ctx.resume().catch(function () {}); }
  function ok() { window.__sfx++; return !muted && ctx && ctx.state === "running"; }

  /* ---------------------------- voices ---------------------------- */
  function noise(opts) {
    if (!ok()) return;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = opts.type || "bandpass"; f.Q.value = opts.q || 1;
    var g = ctx.createGain();
    var t = ctx.currentTime;
    f.frequency.setValueAtTime(opts.f0, t);
    f.frequency.exponentialRampToValueAtTime(opts.f1 || opts.f0, t + opts.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol, t + (opts.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + opts.dur + 0.05);
  }
  function tone(opts) {
    if (!ok()) return;
    var o = ctx.createOscillator(); o.type = opts.wave || "sine";
    var g = ctx.createGain();
    var t = ctx.currentTime + (opts.at || 0);
    o.frequency.setValueAtTime(opts.f0, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + opts.dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.vol, t + (opts.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + opts.dur + 0.05);
  }

  window.__sfx = 0;
  var cues = {
    start: function () {
      noise({ f0: 2400, f1: 900, dur: 0.08, vol: 0.5, q: 2 });
      tone({ f0: 220, f1: 660, dur: 0.35, vol: 0.35, at: 0.03 });
    },
    step: function () {
      noise({ f0: 180, f1: 900, dur: 0.55, vol: 0.55, q: 0.8, attack: 0.12, type: "lowpass" });
    },
    clunk: function () {
      tone({ f0: 140, f1: 70, dur: 0.16, vol: 0.6, wave: "triangle" });
      noise({ f0: 1400, f1: 600, dur: 0.05, vol: 0.35, q: 3 });
    },
    tick: function (at) {
      tone({ f0: 1800, dur: 0.03, vol: 0.25, wave: "square", at: at });
    },
    chime: function () {
      tone({ f0: 523, dur: 0.5, vol: 0.3 });
      tone({ f0: 784, dur: 0.7, vol: 0.3, at: 0.12 });
    },
  };

  /* ----------------------------- hooks ----------------------------- */
  document.addEventListener("pointerdown", function () { ensure(); resume(); }, { passive: true });
  document.addEventListener("keydown", function () { ensure(); resume(); });

  var startBtn = document.getElementById("start-btn");
  if (startBtn) startBtn.addEventListener("click", function () { ensure(); resume(); setTimeout(cues.start, 0); });

  // intro MUTE chip is the source of truth for the drone; mirror it
  var muteBtn = document.getElementById("mute-btn");
  function syncMuted() { muted = !!(muteBtn && muteBtn.getAttribute("aria-pressed") === "true"); updateNav(); }
  if (muteBtn) new MutationObserver(syncMuted).observe(muteBtn, { attributes: true, attributeFilter: ["aria-pressed"] });

  // nav toggle (drives the intro chip so both stay in step)
  var nav = document.querySelector(".site-nav__cta");
  var navBtn = null;
  if (nav && nav.parentNode) {
    navBtn = document.createElement("button");
    navBtn.type = "button";
    navBtn.className = "site-nav__sound";
    navBtn.setAttribute("aria-label", "Toggle sound");
    navBtn.setAttribute("aria-pressed", "false");
    navBtn.innerHTML = '<i></i><i></i><i></i><i></i>';
    nav.parentNode.insertBefore(navBtn, nav);
    navBtn.addEventListener("click", function () {
      ensure(); resume();
      if (muteBtn) muteBtn.click(); else { muted = !muted; updateNav(); }
      if (!muted) cues.tick(0);
    });
  }
  function updateNav() {
    if (!navBtn) return;
    navBtn.setAttribute("aria-pressed", String(muted));
    navBtn.classList.toggle("is-muted", muted);
  }

  function afterGate(fn) {
    var root = document.documentElement;
    if (!root.classList.contains("gated")) { fn(); return; }
    var mo = new MutationObserver(function () { if (!root.classList.contains("gated")) { mo.disconnect(); setTimeout(fn, 300); } });
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
  }

  afterGate(function () {
    if (reduced) return;
    // scrolly steps: the rail's active tick moves
    var rail = document.querySelector(".rail__ticks");
    if (rail) {
      var lastActive = rail.querySelector(".is-active");
      new MutationObserver(function () {
        var a = rail.querySelector(".is-active");
        if (a && a !== lastActive) { lastActive = a; cues.step(); }
      }).observe(rail, { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
    // crane: a system name lights
    document.querySelectorAll(".crane-systems li").forEach(function (li) {
      var was = li.classList.contains("is-placed");
      new MutationObserver(function () {
        var now = li.classList.contains("is-placed");
        if (now && !was) cues.clunk();
        was = now;
      }).observe(li, { attributes: true, attributeFilter: ["class"] });
    });
    // odometer: ratchet when a price rolls into view
    if ("IntersectionObserver" in window) {
      var rolled = new WeakSet();
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          if (!x.isIntersecting || rolled.has(x.target)) return;
          rolled.add(x.target);
          for (var i = 0; i < 6; i++) cues.tick(0.1 + i * 0.13);
        });
      }, { threshold: 0.6 });
      document.querySelectorAll(".odo").forEach(function (o) { io.observe(o); });
    }
    // relay legs: count of completed dots on any chip rises
    var chips = document.querySelectorAll(".relay-chip");
    var doneCount = document.querySelectorAll(".relay-chip:first-of-type .relay-dot.is-done").length;
    if (chips.length) {
      new MutationObserver(function () {
        var n = chips[0].querySelectorAll(".relay-dot.is-done").length;
        if (n > doneCount) cues.chime();
        doneCount = n;
      }).observe(chips[0], { attributes: true, subtree: true, attributeFilter: ["class"] });
    }
  });

  syncMuted();
})();
