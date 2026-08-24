/* lab-veil.js - the branded load-in curtain (markup + critical CSS are
 * inline in index.html so it paints before anything else arrives).
 *
 * Lifts when ALL of:
 *   - fonts are ready (no Barlow swap visible underneath),
 *   - app.js has finished the frame preload and enabled START (the real
 *     loader progress is mirrored in the veil's hairline meanwhile),
 *   - at least MIN_SHOW ms have passed since navigation start.
 * ...or unconditionally at CEILING ms, so a stalled asset can never trap
 * the page behind the curtain. */
(function () {
  var veil = document.getElementById("veil");
  if (!veil) return;
  var fill = document.getElementById("veil-fill");
  var startBtn = document.getElementById("start-btn");
  var progressFill = document.getElementById("progress-fill");
  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var MIN_SHOW = reduced ? 0 : 1400;
  var CEILING = 6000;
  var fontsReady = false, lifted = false;

  function elapsed() { return performance.now(); }

  function lift() {
    if (lifted) return;
    lifted = true;
    if (fill) fill.style.transform = "scaleX(1)";
    // The curtain's wordmark travels to the nav's wordmark (FLIP) so the
    // logo is not two things - it is the one thing that was just on the
    // curtain, now parked top-left. Skipped under reduced motion.
    var mark = veil.querySelector(".veil__mark");
    var logo = document.querySelector(".site-nav__logo img");
    if (mark && logo && !reduced) {
      var a = mark.getBoundingClientRect(), b = logo.getBoundingClientRect();
      if (b.width > 0) {
        mark.style.animation = "none";
        document.body.appendChild(mark);
        mark.style.position = "fixed";
        mark.style.left = a.left + "px"; mark.style.top = a.top + "px";
        mark.style.width = a.width + "px"; mark.style.height = "auto";
        mark.style.zIndex = 101; mark.style.opacity = 1; mark.style.margin = 0;
        mark.style.transformOrigin = "top left";
        mark.style.transition = "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease 0.7s";
        logo.style.opacity = 0;
        requestAnimationFrame(function () {
          mark.style.transform = "translate(" + (b.left - a.left) + "px," + (b.top - a.top) + "px) scale(" + (b.width / a.width) + ")";
          mark.style.opacity = 0;
          setTimeout(function () { logo.style.opacity = ""; if (mark.parentNode) mark.parentNode.removeChild(mark); }, 980);
        });
      }
    }
    veil.classList.add("is-done");
    root.classList.add("veil-done");
    // Remove from the tree once the fade finishes so nothing sits above the
    // nav/reticle for the rest of the session.
    setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, reduced ? 300 : 800);
  }

  function ready() {
    return fontsReady && startBtn && !startBtn.disabled;
  }

  function tick() {
    if (lifted) return;
    // Mirror the real preload progress (app.js writes the width in %).
    var t = elapsed();
    if (fill && progressFill) {
      // Real preload progress, but never ahead of the minimum hold: on a
      // fast connection the bar used to fill instantly and then sit full
      // for a second, which read as waiting for nothing. Now it reaches
      // full exactly as the veil is allowed to lift.
      var real = (parseFloat(progressFill.style.width) || 0) / 100;
      var hold = MIN_SHOW ? Math.min(1, t / MIN_SHOW) : 1;
      fill.style.transform = "scaleX(" + Math.max(0.04, Math.min(real, hold)) + ")";
    }
    if ((ready() && t >= MIN_SHOW) || t >= CEILING) { lift(); return; }
    requestAnimationFrame(tick);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { fontsReady = true; root.classList.add("fonts-ready"); });
  } else {
    fontsReady = true; root.classList.add("fonts-ready");
  }
  requestAnimationFrame(tick);
})();
