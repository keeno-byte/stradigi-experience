/* site.js — top nav behavior: mobile menu, section scroll, active-section
   highlight. Loaded after app.js/scene.js (script tag at end of body) so
   gsap/ScrollTrigger/ScrollToPlugin are already registered globals; this
   file never touches app.js/scene.js state directly, only reads
   ScrollTrigger.getAll() and the shared `gated` class both already expose. */
(function () {
  var nav = document.getElementById('site-nav');
  var toggleBtn = document.getElementById('site-nav-toggle');
  var mobileMenu = document.getElementById('site-nav-mobile');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function navHeight() { return (nav && nav.offsetHeight) || 68; }

  function closeMobile() {
    if (!mobileMenu || !toggleBtn) return;
    mobileMenu.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }
  if (toggleBtn && mobileMenu) {
    toggleBtn.addEventListener('click', function () {
      var open = mobileMenu.classList.toggle('is-open');
      toggleBtn.setAttribute('aria-expanded', String(open));
    });
  }

  var logo = nav && nav.querySelector('.site-nav__logo');
  if (logo) {
    logo.addEventListener('click', function (e) {
      e.preventDefault();
      closeMobile();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  /* ---- scrolling a nav link to its section ----
     The pinned scrolly (#scrolly) and the pinned horizontal gallery right
     after it (app.js initScrolly / the gtl timeline) both sit between the
     nav and every section this file adds below </main>. A programmatic
     scrollTo isn't a wheel/touch gesture, so app.js's own onWheel gate never
     fires here — the thing that DOES need handling is landing the animated
     leg entirely in native-scroll territory, past every pin's spacer, so
     ScrollTrigger's snap config has nothing mid-flight to catch. One
     instant, unanimated jump past the furthest relevant pin `end` first,
     then the smooth tween from there. */
  function releasePinsBefore(targetY) {
    if (!window.ScrollTrigger) return;
    var triggers = ScrollTrigger.getAll();
    var maxEnd = 0;
    for (var i = 0; i < triggers.length; i++) {
      var end = triggers[i].end;
      if (typeof end === 'number' && end < targetY && end > maxEnd) maxEnd = end;
    }
    if (maxEnd > 0 && window.scrollY < maxEnd) window.scrollTo(0, maxEnd + 2);
  }

  function scrollToTarget(el) {
    if (!el) return;
    var doScroll = function () {
      var offset = navHeight() + 12;
      var targetY = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
      releasePinsBefore(targetY);
      if (reduceMotion || !window.gsap || !window.gsap.to) {
        window.scrollTo({ top: targetY, behavior: reduceMotion ? 'auto' : 'smooth' });
        return;
      }
      gsap.to(window, { scrollTo: { y: targetY }, duration: 1, ease: 'power2.inOut', overwrite: true });
    };
    if (document.documentElement.classList.contains('gated')) {
      // "so nobody is ever trapped in the intro" — a nav click skips it
      var skipBtn = document.getElementById('skip-btn');
      if (skipBtn) skipBtn.click();
      var wait = function () {
        if (!document.documentElement.classList.contains('gated')) requestAnimationFrame(doScroll);
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    } else {
      doScroll();
    }
  }

  var hashLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]')) : [];
  hashLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(a.getAttribute('href'));
      if (!target) return; // not on this page (yet) — let it no-op rather than jump to top
      e.preventDefault();
      closeMobile();
      scrollToTarget(target);
    });
  });

  /* ---- active-section highlight ----
     Quiet while the loader is up (nothing on the page is "current" yet,
     per Keeno's spec); starts once html.gated is removed. */
  var sectionIds = ['systems', 'serve', 'about', 'pricing', 'contact'];
  var sections = sectionIds.map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var linksByHash = {};
  hashLinks.forEach(function (a) {
    if (a.classList.contains('site-nav__cta')) return; // the CTA tracks nothing; it's an action, not a location
    var id = a.getAttribute('href').slice(1);
    (linksByHash[id] = linksByHash[id] || []).push(a);
  });
  function setActive(id) {
    hashLinks.forEach(function (a) { a.classList.remove('is-active'); });
    (linksByHash[id] || []).forEach(function (a) { a.classList.add('is-active'); });
  }
  function startObserver() {
    if (!('IntersectionObserver' in window) || !sections.length) return;
    var io = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (en) { return en.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: '-' + navHeight() + 'px 0px -55% 0px', threshold: [0.1, 0.25, 0.5] });
    sections.forEach(function (s) { io.observe(s); });
  }
  if (!document.documentElement.classList.contains('gated')) {
    startObserver();
  } else {
    var mo = new MutationObserver(function () {
      if (!document.documentElement.classList.contains('gated')) {
        mo.disconnect();
        startObserver();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  }
})();
