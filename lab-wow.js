/* lab-wow.js - behaviour for lab-wow.css (see that file's header).
 *
 *   spotlight   pointer-tracked light on .spot cards (+ tilt on systems)
 *   words       scroll-linked word reveal on [data-words]
 *   magnetic    .se-btn leans toward a near pointer, springs back
 *   pricing     strike line draws when a card arrives
 *   contact     open-now line from the verified hours (Mon-Sun 9-5 ET)
 *   footer      giant wordmark fills with the last of the scroll
 *   cta         ghost wordmark drifts against scroll
 *
 * Everything defers until the intro pin exists, like lab-bands.js, so no
 * ScrollTrigger is measured without the pin's spacer. */
(function () {
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
  if (!gsap || !ScrollTrigger) return;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var root = document.documentElement;

  /* ------------------------------ spotlight ------------------------------ */
  function spotlight() {
    if (!fine) return;
    var cards = document.querySelectorAll(".spot");
    if (!cards.length) return;
    var active = null;
    document.addEventListener("pointermove", function (e) {
      var el = e.target.closest && e.target.closest(".spot");
      if (el !== active) {
        if (active) active.style.setProperty("--spot", 0);
        active = el;
        if (active) active.style.setProperty("--spot", 1);
      }
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (e.clientX - r.left) + "px");
      el.style.setProperty("--my", (e.clientY - r.top) + "px");
      if (el.__tilt) el.__tilt(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    }, { passive: true });
    document.addEventListener("pointerleave", function () {
      if (active) { active.style.setProperty("--spot", 0); active = null; }
    });
    if (reduced) return;
    document.querySelectorAll(".system-card.spot").forEach(function (card) {
      var rx = gsap.quickTo(card, "rotationX", { duration: 0.5, ease: "power3.out" });
      var ry = gsap.quickTo(card, "rotationY", { duration: 0.5, ease: "power3.out" });
      card.__tilt = function (x, y, w, h) {
        rx(-((y / h) - 0.5) * 6);
        ry(((x / w) - 0.5) * 7);
      };
      card.addEventListener("pointerleave", function () { rx(0); ry(0); });
    });
  }

  /* ------------------------------ word reveal ------------------------------ */
  function words() {
    document.querySelectorAll("[data-words]").forEach(function (el) {
      var text = el.textContent.replace(/\s+/g, " ").trim();
      var parts = text.split(" ");
      var esc = function (x) { return x.replace(/&/g, "&amp;").replace(/</g, "&lt;"); };
      // Screen readers get the sentence once, whole; the word spans are
      // decoration.
      el.innerHTML = '<span class="sr-only">' + esc(text) + "</span>" +
        parts.map(function (w) { return '<span class="w" aria-hidden="true">' + esc(w) + "</span>"; }).join(" ");
      if (reduced) { el.classList.add("reduced"); return; }
      gsap.to(el.querySelectorAll(".w"), {
        opacity: 1, ease: "none", stagger: 0.6,
        scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 48%", scrub: 0.6 },
      });
    });
  }

  /* ------------------------------- magnetic ------------------------------- */
  function magnetic() {
    if (!fine || reduced) return;
    var R = 56;
    document.querySelectorAll(".se-btn, .contact-panel .se-btn").forEach(function (btn) {
      if (btn.__mag) return;
      btn.__mag = true;
      btn.classList.add("mag");
      var tx = gsap.quickTo(btn, "x", { duration: 0.45, ease: "power3.out" });
      var ty = gsap.quickTo(btn, "y", { duration: 0.45, ease: "power3.out" });
      var near = false;
      document.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        if (r.width === 0) return;
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        var dx = e.clientX - cx, dy = e.clientY - cy;
        var inside = Math.abs(dx) < r.width / 2 + R && Math.abs(dy) < r.height / 2 + R;
        if (inside) { near = true; tx(dx * 0.28); ty(dy * 0.32); }
        else if (near) { near = false; gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: "elastic.out(1, 0.45)" }); }
      }, { passive: true });
    });
  }

  /* ------------------------------ who we help ------------------------------ */
  /* Desktop: the portrait drifts while a strip is open (8s ken burns) and
   * leans a few px against the pointer. Phones: the card nearest the
   * centre of the carousel is "open" (full colour, descriptor shown). */
  function serve() {
    var strips = document.querySelector(".serve-strips");
    if (!strips) return;
    var cards = Array.prototype.slice.call(strips.querySelectorAll(".serve-card"));
    if (fine && !reduced) {
      cards.forEach(function (card) {
        var img = card.querySelector("img");
        if (!img) return;
        var tx = gsap.quickTo(img, "x", { duration: 0.8, ease: "power3.out" });
        var ty = gsap.quickTo(img, "y", { duration: 0.8, ease: "power3.out" });
        card.addEventListener("pointerenter", function () {
          gsap.to(img, { scale: 1.16, duration: 9, ease: "none", overwrite: "auto" });
        });
        card.addEventListener("pointermove", function (e) {
          var r = card.getBoundingClientRect();
          tx(((e.clientX - r.left) / r.width - 0.5) * -14);
          ty(((e.clientY - r.top) / r.height - 0.5) * -10);
        });
        card.addEventListener("pointerleave", function () {
          gsap.to(img, { scale: 1.06, duration: 1.4, ease: "power2.out", overwrite: "auto" });
          tx(0); ty(0);
        });
      });
    }
    /* Every strip opens the CTA screen (Keeno, 2026-08-23: "it's supposed
     * to take them to a CTA screen you create built off of the information
     * we have", not drag them down the page). Everything below is the
     * verified material: system names + deliverables verbatim from the
     * systems pages, testimonials verbatim as published, the standing
     * free-session offer. Headlines are our connective copy - no claims,
     * no numbers. */
    var SERVE = [
      { img: "assets/img/serve-home.jpg", kicker: "Who we help \u00b7 Home service companies",
        title: "Your crews build. Stradigi runs the office.",
        cta: "For home service companies: roofing, remodeling, landscaping, HVAC.",
        list: [["Smart Automation\u2122", "chat &amp; voice automation, appointment scheduling with auto reminders"],
               ["Authority Builder\u2122", "review &amp; reputation management"],
               ["Business Engine\u2122", "CRM &amp; pipeline management"]],
        quote: "\u201cOur client communication used to be chaos now it\u2019s consistent, instant, and effortless. It\u2019s like having a 24/7 assistant.\u201d",
        cite: "Josh Wilkinson, Wilkinson Roofing" },
      { img: "assets/img/serve-wellness.jpg", kicker: "Who we help \u00b7 Health &amp; wellness professionals",
        title: "Your patients get your attention. The follow-up runs itself.",
        cta: "For health &amp; wellness professionals: chiropractors, therapists, studios.",
        list: [["Smart Automation\u2122", "appointment scheduling with auto reminders"],
               ["Authority Builder\u2122", "review &amp; reputation management"],
               ["Financial Clarity System\u2122", "monthly book closing &amp; reconciliation"]],
        quote: "\u201cWith Stradigi\u2019s systems, I run my chiropractic practice more efficiently than ever. I have time for my patients and my family.\u201d",
        cite: "Dr. Marcus Robinson, Robinson Chiropractic" },
      { img: "assets/img/serve-trades.jpg", kicker: "Who we help \u00b7 Trades and contractors",
        title: "You do the work. The paperwork keeps itself.",
        cta: "For trades and contractors: the people who do the work.",
        list: [["Business Engine\u2122", "CRM &amp; pipeline management"],
               ["Financial Clarity System\u2122", "QuickBooks Online management (setup, cleanup, maintenance)"],
               ["Smart Automation\u2122", "lead follow-up sequences"]],
        quote: "\u201cJason showed us how to track our jobs, manage cash flow, and plan for growth. I finally feel like I\u2019m leading my business instead of chasing it.\u201d",
        cite: "Linda Ahrens, Smart Contractors Inc." },
      { img: "assets/img/serve-professional.jpg", kicker: "Who we help \u00b7 Professional service firms",
        title: "Your reputation, managed like your cases.",
        cta: "For professional service firms: law, finance, real estate, marketing.",
        list: [["Business Engine\u2122", "unified communication hub (texts, calls, emails, chat in one place)"],
               ["Authority Builder\u2122", "content marketing (blog + social aligned to target keywords)"],
               ["Smart Automation\u2122", "social media automation"]],
        quote: "\u201cNow our sales process is clear, our communication is organized, and we finally feel in control again.\u201d",
        cite: "Gina Berardinelli, Quillon Closings" },
    ];
    var tailored = document.getElementById("contact-tailored");
    var modal = document.getElementById("serve-modal");
    var lastFocus = null;
    function fillModal(d) {
      document.getElementById("serve-modal-img").src = d.img;
      document.getElementById("serve-modal-kicker").innerHTML = d.kicker;
      document.getElementById("serve-modal-title").textContent = d.title;
      document.getElementById("serve-modal-list").innerHTML = d.list.map(function (x) { return "<li><b>" + x[0] + "</b><span>" + x[1] + "</span></li>"; }).join("");
      document.getElementById("serve-modal-quote").innerHTML = d.quote + "<cite>" + d.cite + "</cite>";
    }
    function setInert(on) {
      if (!("inert" in HTMLElement.prototype)) return;
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === modal || el.tagName === "SCRIPT") return;
        if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
      });
    }
    function openModal(i) {
      var d = SERVE[i];
      if (!d || !modal) return;
      fillModal(d);
      modal.__cta = d.cta;
      lastFocus = document.activeElement;
      modal.hidden = false;
      setInert(true);
      document.documentElement.style.overflow = "hidden";
      requestAnimationFrame(function () { modal.classList.add("is-open"); });
      modal.querySelector(".serve-modal__close").focus();
    }
    function closeModal() {
      if (!modal || modal.hidden) return;
      modal.classList.remove("is-open");
      modal.hidden = true;
      setInert(false);
      document.documentElement.style.overflow = "";
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    // keyboard: Tab cycles inside the dialog
    modal && modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = modal.querySelectorAll("a[href], button:not([disabled])");
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    modal && modal.addEventListener("click", function (e) {
      if (e.target.closest("[data-close]")) { closeModal(); return; }
      if (e.target.closest("#serve-modal-book")) {
        e.preventDefault();
        if (tailored && modal.__cta) { tailored.innerHTML = modal.__cta; tailored.hidden = false; }
        closeModal();
        try { gsap.to(window, { scrollTo: "#contact", duration: 0.9, ease: "power2.inOut", overwrite: true }); }
        catch (err) { document.getElementById("contact").scrollIntoView({ behavior: "smooth" }); }
      }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });
    cards.forEach(function (card, i) {
      card.setAttribute("data-cursor-label", "OPEN");
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openModal(i); } });
    });
    // Delegated: a click mid flex-transition can land on the container.
    strips.addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest(".serve-card");
      if (!card) {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        card = el && el.closest && el.closest(".serve-card");
      }
      if (card) openModal(cards.indexOf(card));
    });
    if (!fine) {
      var pick = function () {
        var mid = strips.getBoundingClientRect().left + strips.clientWidth / 2;
        var best = null, bd = 1e9;
        cards.forEach(function (c) { var r = c.getBoundingClientRect(); var d = Math.abs(r.left + r.width / 2 - mid); if (d < bd) { bd = d; best = c; } });
        cards.forEach(function (c) { c.classList.toggle("is-open", c === best); });
      };
      strips.addEventListener("scroll", pick, { passive: true });
      pick();
    }
  }

  /* ----------------------------- relay tracker ----------------------------- */
  /* Five dots in the nav that fill as the legs complete - the band chips
   * already keep the state (lab-bands.js, localStorage); this mirrors the
   * first chip so the whole page reads as one journey. */
  function relayTracker() {
    var cta = document.querySelector(".site-nav__cta");
    if (!cta || document.querySelector(".site-nav__relay")) return;
    var LEGS = ["Built", "Automated", "Delivered", "The journey", "Arrived"];
    var HREFS = ["#leg-built", "#leg-automated", "#leg-delivered", "#leg-journey", "#leg-arrived"];
    var el = document.createElement("a");
    el.className = "site-nav__relay";
    el.href = HREFS[0];
    el.setAttribute("aria-label", "Journey progress");
    el.innerHTML = '<span class="site-nav__relay-dots">' + LEGS.map(function () { return "<i></i>"; }).join("") + '</span><span class="site-nav__relay-text">0 / 5</span>';
    cta.parentNode.insertBefore(el, cta);
    var dots = el.querySelectorAll("i"), text = el.querySelector(".site-nav__relay-text");
    function read() {
      try { return JSON.parse(localStorage.getItem("stradigi-experience-relay")) || []; } catch (e) { return []; }
    }
    var last = -1;
    function paint() {
      var legs = read();
      dots.forEach(function (d, i) { d.classList.toggle("is-done", legs.indexOf(i + 1) !== -1); });
      var n = legs.length;
      var next = LEGS.findIndex(function (_, i) { return legs.indexOf(i + 1) === -1; });
      text.textContent = n + " / 5" + (n === 5 ? " \u00b7 Arrived" : "");
      el.href = next === -1 ? HREFS[4] : HREFS[next];
      el.title = next === -1 ? "All five legs complete" : "Next leg: " + LEGS[next];
      if (n !== last && last !== -1 && !reduced) { el.classList.remove("is-pop"); void el.offsetWidth; el.classList.add("is-pop"); }
      last = n;
    }
    paint();
    var chip = document.querySelector(".relay-chip");
    if (chip) new MutationObserver(paint).observe(chip, { attributes: true, subtree: true, attributeFilter: ["class"] });
    else setTimeout(relayTracker, 500);
    window.addEventListener("storage", paint);
  }

  /* -------------------------------- pricing -------------------------------- */
  function pricing() {
    var cards = document.querySelectorAll(".price-card");
    if (!cards.length) return;
    if (reduced || !("IntersectionObserver" in window)) { cards.forEach(function (c) { c.classList.add("is-in"); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add("is-in"); io.unobserve(x.target); } });
    }, { threshold: 0.45 });
    cards.forEach(function (c) { io.observe(c); });
  }

  /* -------------------------------- contact -------------------------------- */
  /* Hours are the client's published ones: Mon-Sun 09:00-17:00, Canonsburg
   * PA (STRADIGI_SOURCE_OF_TRUTH.md, footer/JSON-LD [VERIFIED]). Shown in
   * Eastern time regardless of the visitor's zone. */
  function contact() {
    var host = document.getElementById("contact-status");
    if (!host) return;
    var OPEN = 9, CLOSE = 17;
    function fmt(h) { var ampm = h >= 12 ? "pm" : "am"; var hh = h % 12 || 12; return hh + ":00 " + ampm; }
    function tick() {
      var now = new Date();
      var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
      var h = +parts.find(function (p) { return p.type === "hour"; }).value % 24;
      var m = +parts.find(function (p) { return p.type === "minute"; }).value;
      var open = h >= OPEN && h < CLOSE;
      host.classList.toggle("is-closed", !open);
      var clock = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(now);
      host.innerHTML = "<i></i><span>" + (open ? "Open now in Canonsburg" : "Closed now in Canonsburg") + " &middot; " +
        (open ? "closes " + fmt(CLOSE) : "opens " + fmt(OPEN)) + " &middot; <time>" + clock + " ET</time></span>";
    }
    tick();
    setInterval(tick, 30000);
  }

  /* --------------------------------- footer --------------------------------- */
  function footer() {
    var giant = document.querySelector(".footer-giant");
    if (!giant) return;
    if (reduced) { giant.style.setProperty("--fill", 1); return; }
    gsap.fromTo(giant, { "--fill": 0 }, {
      "--fill": 1, ease: "none",
      scrollTrigger: { trigger: giant, start: "top 95%", end: "bottom 100%", scrub: 0.5 },
    });
  }

  /* ---------------------------------- cta ----------------------------------- */
  function cta() {
    var ghost = document.querySelector(".se-cta-ghost");
    if (!ghost || reduced) return;
    gsap.fromTo(ghost, { xPercent: -50, yPercent: -50, x: 60 }, {
      x: -60, ease: "none",
      scrollTrigger: { trigger: ghost.parentNode, start: "top bottom", end: "bottom top", scrub: 0.8 },
    });
  }

  /* The four portrait JPGs are lazy so they never compete with the intro
   * preload on slow connections; once the intro is over, warm them in the
   * background so the first scroll to Who we help decodes nothing. */
  function warmPortraits() {
    ["serve-home", "serve-wellness", "serve-trades", "serve-professional"].forEach(function (n) {
      var im = new Image();
      im.decoding = "async";
      im.src = "assets/img/" + n + ".jpg";
    });
  }

  function init() {
    warmPortraits();
    spotlight();
    relayTracker();
    serve();
    words();
    magnetic();
    pricing();
    contact();
    footer();
    cta();
    if (!root.classList.contains("gated")) ScrollTrigger.refresh();
  }

  var ready = function () { return !root.classList.contains("gated") || !!document.querySelector(".pin-spacer"); };
  if (ready()) { init(); return; }
  var mo = new MutationObserver(function () {
    if (ready()) { mo.disconnect(); setTimeout(init, 220); }
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
})();
