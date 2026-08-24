/* lab-motion.js - scroll choreography for the real-site sections below
 * the intro. Ported from ~/stradigi-website (choreography.js +
 * motion-core.js), on the lab's gsap/ScrollTrigger globals: word-mask
 * headline reveals, scrubbed stagger groups, side entrances, and the
 * "Who we help" upgrade (each card its own arrival, media push-in,
 * accent lights as it lands). Reversible: scrolling back runs it back. */
(function () {
  if (!window.gsap || !window.ScrollTrigger) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  // Same deferral as lab-bands.js: the intro's pin is created at reveal
  // (START), and ScrollTrigger measures triggers in creation order, so any
  // made before that pin never see its spacer. Build once the pin-spacer
  // exists - under the reveal film, not at the gate drop.
  var root = document.documentElement;
  var ready = function () { return !root.classList.contains("gated") || !!document.querySelector(".pin-spacer"); };
  if (ready()) {
    init();
  } else {
    var mo = new MutationObserver(function () {
      // Just after lab-bands' five scene builds, still under the loader.
      if (ready()) { mo.disconnect(); setTimeout(init, 140); }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
  }

  function init() {

  // Word masks on section headings (space lives outside the clip mask,
  // mask is inline-block - both learned as real bugs, not re-derived).
  document.querySelectorAll(".se-heading, .se-cta-band h2").forEach(function (host) {
    if (host.dataset.split) return;
    host.dataset.split = "1";
    var text = host.textContent.trim();
    host.textContent = "";
    text.split(/\s+/).forEach(function (word) {
      var outer = document.createElement("span");
      outer.className = "cx-word";
      var inner = document.createElement("span");
      inner.className = "cx-word-inner";
      inner.textContent = word;
      outer.appendChild(inner);
      host.appendChild(outer);
      host.appendChild(document.createTextNode(" "));
    });
    gsap.fromTo(host.querySelectorAll(".cx-word-inner"),
      { yPercent: 100 },
      { yPercent: 0, ease: "power3.out", stagger: 0.045,
        scrollTrigger: { trigger: host, start: "top 88%", end: "top 55%", scrub: 0.7 } });
  });

  // Staggered groups: children arrive in sequence, scrubbed together.
  document.querySelectorAll(".systems-grid, .pricing-grid, .trust-row, .contact-split").forEach(function (group) {
    var kids = group.children;
    if (!kids.length) return;
    gsap.fromTo(kids, { y: 42, autoAlpha: 0 },
      { y: 0, autoAlpha: 1, ease: "power2.out", stagger: 0.08,
        scrollTrigger: { trigger: group, start: "top 88%", end: "top 42%", scrub: 0.8 } });
  });

  // Side entrances: photo from the left, copy from the right.
  document.querySelectorAll(".about-photo, .trust-photo").forEach(function (el) {
    gsap.fromTo(el, { x: -70, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", end: "top 45%", scrub: 0.8 } });
  });
  document.querySelectorAll(".about-copy, .trust-quote").forEach(function (el) {
    gsap.fromTo(el, { x: 70, autoAlpha: 0 }, { x: 0, autoAlpha: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%", end: "top 45%", scrub: 0.8 } });
  });

  // Who we help: four distinct moments, not one block fading up.
  document.querySelectorAll(".serve-card").forEach(function (card, i) {
    var fromLeft = i % 2 === 0;
    gsap.fromTo(card,
      { x: fromLeft ? -54 : 54, y: 30, scale: 0.94, rotate: fromLeft ? -1.2 : 1.2, autoAlpha: 0 },
      { x: 0, y: 0, scale: 1, rotate: 0, autoAlpha: 1, ease: "power3.out", duration: 0.9,
        scrollTrigger: { trigger: card, start: "top 86%", toggleActions: "play none none reverse",
          onEnter: function () { card.classList.add("serve-card--lit"); },
          onLeaveBack: function () { card.classList.remove("serve-card--lit"); } } });
    // (the image's own motion - ken burns + pointer lean - lives in
    // lab-wow.js since the 2026-08-23 strip rebuild)
  });

  // app.js refreshes at the gate drop; only refresh here when we are
  // already past it.
  if (!root.classList.contains("gated")) ScrollTrigger.refresh();
  }
})();
