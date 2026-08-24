/* odometer.js — rolling-digit stats (the reel's mid-roll "98.2%" beat).
 *
 * Any element with class .odo gets its digits split into vertical
 * 0-9 strips that roll to the real value when scrolled into view.
 * Non-digit characters ($, ., %, /) stay put. The numbers themselves
 * are the page's real, published figures - this animates them, it
 * never invents them.
 *
 * Classic script, no dependencies: IntersectionObserver + CSS
 * transitions. Reduced motion or no-IO browsers just see the value. */
(function () {
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hosts = document.querySelectorAll(".odo");
  if (!hosts.length) return;

  function build(host) {
    if (host.dataset.odoBuilt) return;
    host.dataset.odoBuilt = "1";
    var text = host.textContent.trim();
    host.setAttribute("aria-label", text);
    host.textContent = "";
    Array.prototype.forEach.call(text, function (ch) {
      if (/\d/.test(ch)) {
        var digit = document.createElement("span");
        digit.className = "odo-digit";
        digit.setAttribute("aria-hidden", "true");
        var strip = document.createElement("span");
        strip.className = "odo-strip";
        for (var n = 0; n <= 9; n++) {
          var cell = document.createElement("span");
          cell.textContent = String(n);
          strip.appendChild(cell);
        }
        strip.dataset.target = ch;
        digit.appendChild(strip);
        host.appendChild(digit);
      } else {
        var lit = document.createElement("span");
        lit.className = "odo-char";
        lit.setAttribute("aria-hidden", "true");
        lit.textContent = ch;
        host.appendChild(lit);
      }
    });
  }

  function settle(host, instant) {
    var strips = host.querySelectorAll(".odo-strip");
    Array.prototype.forEach.call(strips, function (strip, i) {
      var target = parseInt(strip.dataset.target, 10) || 0;
      var apply = function () {
        strip.style.transform = "translateY(" + (-target) + "em)";
      };
      if (instant) {
        strip.style.transition = "none";
        apply();
        // Reflow so a later animated settle transitions from here.
        void strip.offsetHeight;
        strip.style.transition = "";
      } else {
        // Snap to zero without animating, then roll up to the value.
        strip.style.transition = "none";
        strip.style.transform = "translateY(0)";
        void strip.offsetHeight;
        strip.style.transition = "";
        // Stagger per digit; later digits take longer, like a real meter.
        strip.style.transitionDelay = i * 70 + "ms";
        strip.style.transitionDuration = 700 + i * 160 + "ms";
        apply();
      }
    });
  }

  Array.prototype.forEach.call(hosts, build);
  // Prices must read correct from the first paint (Keeno caught zeros
  // on load): settle every meter instantly at its real value, then let
  // the scroll-in animation snap to 0 and roll up as the visible beat.
  Array.prototype.forEach.call(hosts, function (h) { settle(h, true); });

  if (reduced || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(hosts, function (h) { settle(h, true); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        settle(entry.target, false);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });

  Array.prototype.forEach.call(hosts, function (h) { io.observe(h); });
})();
