/* lab-mark.js - the live mark (2026-08-23, award pass).
 *
 * Everything before this on the page is a FILM of the mark. This is the
 * mark itself: the same six textured wedges scene3d.js builds for the
 * baker, rendered live. It reassembles as the section scrolls in, idles
 * with a slow turn and a breath of separation, leans toward the pointer,
 * comes apart as the pointer gets close, and can be dragged to turn.
 *
 * Renders only while on screen; pixel ratio capped at 1.5; one scene. */
import * as THREE from "./vendor/three.module.min.js";
import { createPieceRenderer } from "./scene3d.js";

var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

async function liveMark(host) {
  var mount = host.querySelector(".mark-live__stage");
  if (!mount || typeof SCENE === "undefined") return;
  var size = Math.round(Math.min(mount.clientWidth, mount.clientHeight));
  if (size < 80) return;

  var pr;
  try {
    pr = await createPieceRenderer({ filmSrc: SCENE.CFG.film.frame, disc: SCENE.CFG.film.disc, W: size, H: size });
  } catch (e) { return; }
  var renderer = pr.renderer, scene = pr.scene, camera = pr.camera, nodes = pr.pieceNodes;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(size, size, false);
  renderer.domElement.style.width = renderer.domElement.style.height = "100%";
  mount.appendChild(renderer.domElement);

  // a ground glow behind the disc so it does not float on nothing
  var glow = new THREE.Mesh(
    new THREE.CircleGeometry(1.55, 64),
    new THREE.MeshBasicMaterial({ color: 0x1d5fbf, transparent: true, opacity: 0.07, depthWrite: false })
  );
  glow.position.z = -0.9;
  scene.add(glow);

  var group = new THREE.Group();
  nodes.forEach(function (pc) { scene.remove(pc.node); group.add(pc.node); pc.node.visible = true; });
  // Backplate: a dark machined disc just behind the wedges, part of the
  // group so it turns with them. When the pieces separate you now see the
  // machine's backbone, not a hole of page background (Keeno, 2026-08-23:
  // "a little bit of a hole there... clean it up").
  var plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.985, 0.985, 0.1, 64),
    new THREE.MeshStandardMaterial({ color: 0x161d2b, metalness: 0.7, roughness: 0.45 })
  );
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -0.24;
  group.add(plate);
  var plateRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.985, 0.018, 10, 72),
    new THREE.MeshStandardMaterial({ color: 0x2a3a55, metalness: 0.8, roughness: 0.3 })
  );
  plateRim.position.z = -0.19;
  group.add(plateRim);
  scene.add(group);

  camera.aspect = 1;
  camera.fov = 28;
  camera.position.set(0, 0, 7.4);
  camera.lookAt(0, 0, 0);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();

  var state = { e: reduced ? 0 : 1, rotY: 0, rotX: 0, targetY: 0, targetX: 0, idle: 0, near: 0, drag: false };
  var q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), axis = new THREE.Vector3();

  function layout() {
    var e = state.e + state.near * 0.3 + 0.008;
    nodes.forEach(function (pc, p) {
      var dx = pc.dir2d.x, dy = -pc.dir2d.y;
      var dz = (p % 2 ? 1 : -1) * 0.35;
      pc.node.position.set(dx * e * 1.25, dy * e * 1.25, e * dz);
      axis.set(-dy, dx, 0).normalize();
      q.setFromAxisAngle(axis, e * 0.30 * (dz >= 0 ? 1 : -1));
      axis.set(dx, dy, 0).normalize();
      q2.setFromAxisAngle(axis, e * 0.10);
      pc.node.quaternion.copy(q).multiply(q2);
    });
  }

  // scroll: reassemble on the way in (e 1 -> 0 over the section's arrival)
  if (!reduced && gsap && ScrollTrigger) {
    gsap.to(state, {
      e: 0, ease: "none",
      scrollTrigger: { trigger: host, start: "top 85%", end: "top 30%", scrub: 0.6 },
    });
  }

  // pointer: lean, proximity spread, drag to turn
  var px = 0, py = 0, lastX = 0, lastY = 0;
  function onMove(e) {
    var r = mount.getBoundingClientRect();
    var nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    if (state.drag) {
      state.targetY += (e.clientX - lastX) * 0.006;
      state.targetX += (e.clientY - lastY) * 0.004;
      state.targetX = Math.max(-0.6, Math.min(0.6, state.targetX));
    } else if (fine) {
      px = nx; py = ny;
      var d = Math.hypot(nx, ny);
      state.near = Math.max(0, 1 - Math.max(0, d - 0.15) / 0.75);
    }
    lastX = e.clientX; lastY = e.clientY;
  }
  mount.addEventListener("pointermove", onMove);
  mount.addEventListener("pointerleave", function () { state.near = 0; px = py = 0; });
  mount.addEventListener("pointerdown", function (e) { state.drag = true; lastX = e.clientX; lastY = e.clientY; mount.setPointerCapture(e.pointerId); host.classList.add("is-dragging"); });
  function endDrag() { state.drag = false; host.classList.remove("is-dragging"); }
  mount.addEventListener("pointerup", endDrag);
  mount.addEventListener("pointercancel", endDrag);
  // phones: a tap pulses it apart and back
  mount.addEventListener("click", function () {
    if (fine || reduced) return;
    gsap.to(state, { near: 1, duration: 0.5, ease: "power2.out", onComplete: function () { gsap.to(state, { near: 0, duration: 0.9, ease: "power3.inOut" }); } });
  });

  var visible = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { rootMargin: "80px" }).observe(mount);
  }

  var frame = 0;
  function tick() {
    frame = requestAnimationFrame(tick);
    if (!visible) return;
    state.idle += 0.016;
    var leanY = fine && !state.drag ? px * 0.35 : 0;
    var leanX = fine && !state.drag ? py * 0.25 : 0;
    var idleY = reduced ? 0 : Math.sin(state.idle * 0.35) * 0.22;
    var breathe = reduced ? 0 : (Math.sin(state.idle * 0.9) + 1) * 0.01;
    state.rotY += ((state.targetY + leanY + idleY) - state.rotY) * 0.08;
    state.rotX += ((state.targetX + leanX) - state.rotX) * 0.08;
    group.rotation.set(state.rotX, state.rotY, 0);
    state.e = Math.max(0, state.e);
    var keep = state.e; state.e += breathe; layout(); state.e = keep;
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(scene, camera);
  }
  tick();

  window.addEventListener("resize", function () {
    var s = Math.round(Math.min(mount.clientWidth, mount.clientHeight));
    if (s > 80) renderer.setSize(s, s, false);
  });
  window.addEventListener("pagehide", function () { cancelAnimationFrame(frame); renderer.dispose(); }, { once: true });
}

/* ------------------------ pieces become the cards ------------------------ */
/* The thesis, made literal: at the systems grid the mark sits whole over
 * the cards, then each wedge flies to its own system card and stays there
 * as that card's badge. Six alpha PNGs, each the full disc frame with only
 * one wedge rendered, so stacking all six at one point IS the mark.
 * Scrubbed, so it reverses; on phones the badges simply arrive. */
async function pieceBadges() {
  var grid = document.querySelector(".systems-grid");
  var cards = grid ? Array.prototype.slice.call(grid.querySelectorAll(".system-card")) : [];
  if (cards.length !== 6 || typeof SCENE === "undefined") return;
  var S = 220;
  var pr;
  try { pr = await createPieceRenderer({ filmSrc: SCENE.CFG.film.frame, disc: SCENE.CFG.film.disc, W: S, H: S }); }
  catch (e) { return; }
  var cam = pr.camera;
  cam.aspect = 1; cam.fov = 28; cam.position.set(0, 0, 4.6); cam.lookAt(0, 0, 0); cam.clearViewOffset(); cam.updateProjectionMatrix();
  pr.nodesAll = pr.pieceNodes;
  var urls = pr.pieceNodes.map(function (pc, i) {
    pr.pieceNodes.forEach(function (o, j) { o.node.visible = j === i; o.node.position.set(0, 0, 0); o.node.quaternion.identity(); });
    pr.renderer.setClearColor(0x000000, 0); pr.renderer.clear(); pr.renderer.render(pr.scene, cam);
    return pr.renderer.domElement.toDataURL("image/png");
  });
  pr.renderer.dispose();

  var section = grid.closest("section") || grid.parentNode;
  section.classList.add("has-morph");
  var layer = document.createElement("div");
  layer.className = "morph-layer";
  layer.setAttribute("aria-hidden", "true");
  section.appendChild(layer);
  var flyers = urls.map(function (u) {
    var el = document.createElement("img");
    el.className = "morph-piece"; el.src = u; el.alt = ""; el.draggable = false;
    layer.appendChild(el);
    return el;
  });
  var badges = cards.map(function (card, i) {
    var b = document.createElement("div");
    b.className = "sys-piece";
    var im = document.createElement("img"); im.src = urls[i]; im.alt = ""; im.draggable = false;
    b.appendChild(im);
    card.appendChild(b);
    return b;
  });

  var BIG = 1.7, SMALL = 88 / S;
  var geo = null;
  function measure() {
    var sr = section.getBoundingClientRect();
    var gr = grid.getBoundingClientRect();
    geo = {
      cx: gr.left - sr.left + gr.width / 2, cy: gr.top - sr.top + Math.min(gr.height * 0.42, 230),
      slots: badges.map(function (b) { var r = b.getBoundingClientRect(); return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 }; }),
    };
  }
  function place(p) {
    if (!geo) measure();
    var e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;   // inOut quad
    flyers.forEach(function (el, i) {
      var sl = geo.slots[i];
      var x = geo.cx + (sl.x - geo.cx) * e, y = geo.cy + (sl.y - geo.cy) * e;
      // a little lift on the way, so the flight reads as an arc
      y -= Math.sin(e * Math.PI) * 48;
      var sc = BIG + (SMALL - BIG) * e;
      el.style.transform = "translate(" + (x - S / 2) + "px," + (y - S / 2) + "px) scale(" + sc + ") rotate(" + (Math.sin(e * Math.PI) * (i % 2 ? 14 : -14)) + "deg)";
      el.style.opacity = p >= 0.985 ? 0 : 1;
    });
    section.classList.toggle("morph-done", p >= 0.985);
  }
  if (reduced || !gsap || !ScrollTrigger || !fine) {
    section.classList.add("morph-done");
    flyers.forEach(function (el) { el.style.opacity = 0; });
    return;
  }
  var prog = { p: 0 };
  place(0);
  gsap.to(prog, {
    p: 1, ease: "none",
    scrollTrigger: { trigger: grid, start: "top 64%", end: "top 10%", scrub: 0.7, invalidateOnRefresh: true,
      onRefresh: function () { geo = null; place(prog.p); } },
    onUpdate: function () { place(prog.p); },
  });
  window.addEventListener("resize", function () { geo = null; place(prog.p); });
}

function whenPinned(fn) {
  var root = document.documentElement;
  var ready = function () { return !root.classList.contains("gated") || !!document.querySelector(".pin-spacer"); };
  if (ready()) { fn(); return; }
  var mo = new MutationObserver(function () { if (ready()) { mo.disconnect(); setTimeout(fn, 400); } });
  mo.observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
}

whenPinned(function () {
  var c = document.createElement("canvas");
  if (!(c.getContext("webgl2") || c.getContext("webgl"))) return;
  document.querySelectorAll(".mark-live").forEach(liveMark);
  pieceBadges();
});
