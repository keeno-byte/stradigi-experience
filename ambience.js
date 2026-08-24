/* ambience.js — the dark space breathes.
 *
 * Keeno's spec (2026-08-09, chosen from options): drifting light motes
 * over a slow aurora glow, on every dark section site-wide, noticeable
 * but calm. One cheap 2D canvas per host - no WebGL, DPR-1, paused
 * offscreen and when the tab hides. Decorative only: no-JS pages just
 * keep their static dark, reduced-motion gets a single still frame. */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hosts = document.querySelectorAll(".ambient");
  if (!hosts.length) return;

  var small = window.innerWidth < 768;

  Array.prototype.forEach.call(hosts, function (host) {
    if (host.querySelector(".amb-canvas")) return;
    // data-aura="green" swaps the two glow colours (system pages alternate
    // blue/green to match the main site's accent cells)
    var green = host.getAttribute("data-aura") === "green";
    var C1 = green ? "63, 190, 115" : "78, 140, 232";
    var C2 = green ? "78, 140, 232" : "63, 190, 115";
    var canvas = document.createElement("canvas");
    canvas.className = "amb-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    var w = 0, h = 0;
    function size() {
      var r = host.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      canvas.width = w;
      canvas.height = h;
    }
    size();

    // Motes: slow-rising brand-blue dust. Density scales with area,
    // capped, fewer on phones.
    var target = Math.min(Math.round((w * h) / 52000), small ? 14 : 26);
    var motes = [];
    for (var i = 0; i < target; i++) {
      motes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.8 + Math.random() * 1.6,
        vy: 0.08 + Math.random() * 0.2,
        sway: 0.4 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        a: 0.12 + Math.random() * 0.3,
      });
    }

    var t = Math.random() * 1000;

    function aurora() {
      // Two soft glows breathing on ~14s and ~19s periods - blue with a
      // whisper of the brand green, composited additively.
      var cx1 = w * (0.5 + 0.18 * Math.sin(t * 0.045));
      var cy1 = h * (0.42 + 0.1 * Math.cos(t * 0.032));
      var g1 = ctx.createRadialGradient(cx1, cy1, 0, cx1, cy1, Math.max(w, h) * 0.55);
      var a1 = 0.055 + 0.03 * Math.sin(t * 0.05);
      g1.addColorStop(0, "rgba(" + C1 + "," + a1.toFixed(3) + ")");
      g1.addColorStop(1, "rgba(" + C1 + ", 0)");
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      var cx2 = w * (0.3 + 0.22 * Math.cos(t * 0.028));
      var cy2 = h * (0.68 + 0.12 * Math.sin(t * 0.037));
      var g2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(w, h) * 0.45);
      var a2 = 0.03 + 0.02 * Math.cos(t * 0.041);
      g2.addColorStop(0, "rgba(" + C2 + "," + a2.toFixed(3) + ")");
      g2.addColorStop(1, "rgba(" + C2 + ", 0)");
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      aurora();
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        var x = m.x + Math.sin(t * 0.6 * m.sway + m.phase) * 14;
        // Twinkle gently as they rise.
        var a = m.a * (0.65 + 0.35 * Math.sin(t * 1.3 + m.phase));
        ctx.beginPath();
        ctx.arc(x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(160, 196, 245," + a.toFixed(3) + ")";
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    if (reduced) {
      // One still frame of atmosphere; nothing moves.
      aurora();
      return;
    }

    var running = false;
    var frame = 0;

    function tick() {
      if (!running) return;
      frame = requestAnimationFrame(tick);
      t += 0.016;
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        m.y -= m.vy;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
      }
      draw();
    }

    function start() {
      if (running || document.hidden) return;
      running = true;
      tick();
    }
    function stop() {
      running = false;
      cancelAnimationFrame(frame);
    }

    // Only animate while on screen and the tab is visible.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        entries[0].isIntersecting ? start() : stop();
      }, { threshold: 0.02 }).observe(host);
    } else {
      start();
    }
    document.addEventListener("visibilitychange", function () {
      document.hidden ? stop() : start();
    });

    var resizeT;
    window.addEventListener("resize", function () {
      clearTimeout(resizeT);
      resizeT = setTimeout(size, 180);
    });
  });
})();
