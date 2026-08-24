/* lab-cursor.js - the reticle.
 *
 * A machinist's viewfinder, not a dot-and-ring: four corner brackets that
 * breathe open with pointer speed and, over anything interactive, fly out
 * to frame the element itself with a small action label (OPEN / CALL /
 * GO, or data-cursor-label). Fine-pointer devices only; skipped under
 * reduced motion; the native cursor is only hidden while this is live. */
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var rt = document.createElement("div");
  rt.className = "rt";
  rt.setAttribute("aria-hidden", "true");
  rt.innerHTML =
    '<i class="rt__c rt__c--tl"></i><i class="rt__c rt__c--tr"></i>' +
    '<i class="rt__c rt__c--bl"></i><i class="rt__c rt__c--br"></i>' +
    '<i class="rt__dot"></i><span class="rt__label"></span>';
  document.body.appendChild(rt);
  var label = rt.querySelector(".rt__label");
  document.documentElement.classList.add("has-reticle");

  var tx = innerWidth / 2, ty = innerHeight / 2;  // pointer
  var x = tx, y = ty, w = 22, h = 22;              // reticle box (lerped)
  var vx = 0, vy = 0, lastX = tx, lastY = ty;
  var target = null, tw = 22, th = 22, tcx = tx, tcy = ty;
  var visible = false;

  function actionLabel(el) {
    var custom = el.getAttribute("data-cursor-label");
    if (custom) return custom;
    var href = el.getAttribute("href") || "";
    if (href.indexOf("tel:") === 0) return "CALL";
    if (el.tagName === "BUTTON") return "GO";
    if (href.indexOf("#") === 0) return "JUMP";
    return "OPEN";
  }

  addEventListener("pointermove", function (e) {
    tx = e.clientX; ty = e.clientY;
    if (!visible) { visible = true; rt.classList.add("is-on"); }
    var el = e.target && e.target.closest ? e.target.closest("a, button, [role='button'], [data-cursor]") : null;
    if (el !== target) {
      target = el;
      if (target) { label.textContent = actionLabel(target); rt.classList.add("is-lock"); }
      else { rt.classList.remove("is-lock"); }
    }
  }, { passive: true });
  addEventListener("pointerdown", function () { rt.classList.add("is-press"); });
  addEventListener("pointerup", function () { rt.classList.remove("is-press"); });
  document.addEventListener("mouseleave", function () { visible = false; rt.classList.remove("is-on"); });
  document.addEventListener("mouseenter", function () { visible = true; rt.classList.add("is-on"); });

  function frame() {
    requestAnimationFrame(frame);
    vx = tx - lastX; vy = ty - lastY; lastX = tx; lastY = ty;
    var speed = Math.min(Math.hypot(vx, vy), 40);
    if (target && target.isConnected) {
      var r = target.getBoundingClientRect();
      tcx = r.left + r.width / 2; tcy = r.top + r.height / 2;
      tw = r.width + 14; th = r.height + 12;
    } else {
      tcx = tx; tcy = ty;
      tw = th = 22 + speed * 0.9;  // brackets breathe open with speed
    }
    var k = target ? 0.18 : 0.32;
    x += (tcx - x) * k; y += (tcy - y) * k;
    w += (tw - w) * 0.2; h += (th - h) * 0.2;
    rt.style.transform = "translate(" + (x - w / 2).toFixed(1) + "px," + (y - h / 2).toFixed(1) + "px)";
    rt.style.width = w.toFixed(1) + "px";
    rt.style.height = h.toFixed(1) + "px";
  }
  frame();
})();
