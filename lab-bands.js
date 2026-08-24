/* motion-bands.js — the two 3D set pieces, scroll-scrubbed.
 *
 * Technique D lineage (superbrain-website-creation-sop.md §Phase 2):
 * orthographic side-elevation vehicles built from Three.js primitives,
 * position bound to scroll — the approach proven in
 * ~/freight-motion-site (our own reference build). Primitives, not
 * GLTFs: no asset pipeline, no download weight, full control of the
 * proportions that carry the read.
 *
 * Scenes, selected by data-scene on a .band3d host:
 *   "plane" — a jet crossing the band on a climbing path (enters low,
 *             exits high: the growth line), over a ghost wordmark.
 *   "crane" — a tower crane assembling six glowing blocks into a wall
 *             while the six system names light up in sync. Pinned scrub.
 *
 * Obligations carried from the SOP: device-tier fallback (no WebGL =
 * band renders without 3D, content stays), prefers-reduced-motion
 * (final state, no scrub), renderer disposal on pagehide. */
import * as THREE from "./vendor/three.module.min.js";
// gsap + ScrollTrigger are the lab's UMD globals (vendor/gsap.min.js).
var gsap = window.gsap;
var ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);

var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var lowTier = (navigator.hardwareConcurrency || 4) <= 4 || window.innerWidth < 900;

function webglOK() {
  var c = document.createElement("canvas");
  return !!(c.getContext("webgl2") || c.getContext("webgl"));
}

function makeRenderer(mount) {
  var r = new THREE.WebGLRenderer({ antialias: !lowTier, alpha: true });
  r.setSize(mount.clientWidth, mount.clientHeight);
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowTier ? 1 : 2));
  mount.appendChild(r.domElement);
  // Five scenes on one page: only the ones on screen should burn GPU.
  mount.__vis = true;
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (en) { mount.__vis = en[0].isIntersecting; }, { rootMargin: "120px" }).observe(mount);
  }
  return r;
}

/* First render of a scene compiles its shaders (MeshStandardMaterial +
 * lights: measured 150-430ms stalls when that landed on the first scroll
 * into a band). Compile and draw one frame at build time instead, while
 * the reveal film is still covering the page. */
function warm(renderer, scene, camera) {
  try { renderer.compile(scene, camera); renderer.render(scene, camera); } catch (e) {}
}

function disposeScene(scene, renderer) {
  scene.traverse(function (o) {
    if (o.isMesh || o.isLine) {
      if (o.geometry) o.geometry.dispose();
      var m = o.material;
      (Array.isArray(m) ? m : [m]).forEach(function (mat) {
        if (mat && mat.map) mat.map.dispose();
        if (mat) mat.dispose();
      });
    }
  });
  renderer.dispose();
}


/* ------------------------------ relay ------------------------------- */
/* One block, five legs, the whole funnel: built (home) -> automated
 * (systems) -> delivered (pricing) -> journeyed (about) -> arrived
 * (contact). The block wears a glowing green band so it reads as the
 * SAME object in every scene; completed legs persist per-browser so the
 * story carries across page loads. Chips double as navigation. */

var RELAY_KEY = "stradigi-experience-relay";
/* Single page: the journey starts over on every visit. (The multi-page
   site persists legs across loads; here a returning visitor saw
   "5 / 5 - Arrived" in the nav before doing anything - Keeno, 2026-08-23.) */
try { localStorage.removeItem(RELAY_KEY); } catch (e) {}
var RELAY_LEGS = [
  { page: "home", label: "Built", href: "#leg-built" },
  { page: "systems", label: "Automated", href: "#leg-automated" },
  { page: "pricing", label: "Delivered", href: "#leg-delivered" },
  { page: "about", label: "The journey", href: "#leg-journey" },
  { page: "contact", label: "Arrived", href: "#leg-arrived" },
];

function relayState() {
  try { return JSON.parse(localStorage.getItem(RELAY_KEY)) || []; }
  catch (e) { return []; }
}

function relayComplete(n) {
  try {
    var legs = relayState();
    if (legs.indexOf(n) === -1) {
      legs.push(n);
      localStorage.setItem(RELAY_KEY, JSON.stringify(legs));
    }
  } catch (e) {}
  document.querySelectorAll(".relay-chip").forEach(function (chip) {
    paintChipDots(chip);
  });
}

function paintChipDots(chip) {
  var legs = relayState();
  chip.querySelectorAll(".relay-dot").forEach(function (dot, i) {
    dot.classList.toggle("is-done", legs.indexOf(i + 1) !== -1);
  });
}

/* Root-relative hrefs so the chip works from / and /systems/ alike. */
function relayHref(href) { return href; }

function relayChip(host, leg) {
  if (!host || host.querySelector(".relay-chip")) return;
  var next = RELAY_LEGS[leg]; // leg is 1-based; RELAY_LEGS[leg] = next leg
  var chip = document.createElement(next ? "a" : "div");
  chip.className = "relay-chip";
  if (next) chip.href = relayHref(next.href);
  var dots = RELAY_LEGS.map(function () { return '<span class="relay-dot"></span>'; }).join("");
  chip.innerHTML =
    '<span class="relay-dots">' + dots + "</span>" +
    '<span class="relay-text">' + RELAY_LEGS[leg - 1].label +
    (next ? ' <span class="relay-next">&rarr; ' + next.label + "</span>" : "") + "</span>";
  host.appendChild(chip);
  paintChipDots(chip);
}

/* The block itself: brand blue body, glowing green band. The band is a
 * child mesh, so material handles on the body keep working. */
function dressRelayBlock(block, w, h, d) {
  var band = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.24, h * 1.04, d * 1.04),
    new THREE.MeshStandardMaterial({
      color: "#3fbe73", roughness: 0.35, metalness: 0.2,
      emissive: "#3fbe73", emissiveIntensity: 0.65,
    })
  );
  block.add(band);
  return block;
}

/* ------------------------------ plane ------------------------------ */

function buildPlane() {
  var g = new THREE.Group();
  var shell = new THREE.MeshStandardMaterial({ color: "#e9ebef", roughness: 0.45, metalness: 0.15 });
  var belly = new THREE.MeshStandardMaterial({ color: "#9aa3b2", roughness: 0.5, metalness: 0.2 });
  var brand = new THREE.MeshStandardMaterial({ color: "#1d5fbf", roughness: 0.4, metalness: 0.2 });
  var accent = new THREE.MeshStandardMaterial({ color: "#3fbe73", roughness: 0.4, metalness: 0.2 });
  var glass = new THREE.MeshStandardMaterial({ color: "#1b2330", roughness: 0.2, metalness: 0.6 });

  // Fuselage: cylinder + nose + tail cones, lying along X.
  var fus = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 6.4, 24), shell);
  fus.rotation.z = Math.PI / 2;
  g.add(fus);

  var nose = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 3.2;
  g.add(nose);

  var tail = new THREE.Mesh(new THREE.ConeGeometry(0.52, 1.6, 20), shell);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -4.0;
  g.add(tail);

  // Belly stripe
  var stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.525, 0.525, 5.4, 24, 1, false, Math.PI * 1.08, Math.PI * 0.84), belly);
  stripe.rotation.z = Math.PI / 2;
  g.add(stripe);

  // Cockpit windscreen
  var screen = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.98), glass);
  screen.position.set(2.55, 0.22, 0);
  g.add(screen);

  // Cabin window strip
  var winStrip = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.13, 1.045), glass);
  winStrip.position.set(-0.15, 0.16, 0);
  g.add(winStrip);

  // Main wing (side elevation shows the near wing swept back)
  var wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(-2.5, -0.9);
  wingShape.lineTo(-3.3, -0.9);
  wingShape.lineTo(-1.0, 0);
  wingShape.lineTo(0, 0);
  var wing = new THREE.Mesh(new THREE.ExtrudeGeometry(wingShape, { depth: 0.09, bevelEnabled: false }), brand);
  wing.position.set(0.9, -0.18, 0.05);
  g.add(wing);

  // Engine pod under wing
  var pod = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.15, 18), belly);
  pod.rotation.z = Math.PI / 2;
  pod.position.set(0.35, -0.85, 0.35);
  g.add(pod);
  var intake = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.05, 10, 22), brand);
  intake.rotation.y = Math.PI / 2;
  intake.position.set(0.95, -0.85, 0.35);
  g.add(intake);

  // Tail fin, brand blue with green flash
  var finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(-1.5, 0);
  finShape.lineTo(-2.2, 1.6);
  finShape.lineTo(-1.5, 1.6);
  finShape.lineTo(0, 0);
  var fin = new THREE.Mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.08, bevelEnabled: false }), brand);
  fin.position.set(-2.5, 0.4, -0.04);
  g.add(fin);
  var flash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.1), accent);
  flash.position.set(-3.6, 1.55, 0);
  flash.rotation.z = 0.42;
  g.add(flash);

  // Horizontal stabilizer
  var stabShape = new THREE.Shape();
  stabShape.moveTo(0, 0);
  stabShape.lineTo(-1.1, -0.34);
  stabShape.lineTo(-1.55, -0.34);
  stabShape.lineTo(-0.7, 0);
  stabShape.lineTo(0, 0);
  var stab = new THREE.Mesh(new THREE.ExtrudeGeometry(stabShape, { depth: 0.07, bevelEnabled: false }), shell);
  stab.position.set(-3.05, 0.32, 0.02);
  g.add(stab);

  return g;
}

function planeScene(host) {
  var mount = host.querySelector(".band3d-stage");
  if (!mount) return;

  var scene = new THREE.Scene();
  var FRUSTUM = 8;
  var aspect = mount.clientWidth / mount.clientHeight;
  var camera = new THREE.OrthographicCamera(
    (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 100
  );
  // Slightly off dead-side so the fuselage catches light.
  camera.position.set(2, 1.2, 20);
  camera.lookAt(0, 0, 0);

  var renderer = makeRenderer(mount);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2233, 1.4));
  var key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(5, 8, 9);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x8fb6ec, 0.8);
  rim.position.set(-7, 3, 6);
  scene.add(rim);

  // The climb path, drawn as a dashed line the plane rides along.
  var half = (FRUSTUM * aspect) / 2;
  var pathPts = [];
  for (var i = 0; i <= 40; i++) {
    var t = i / 40;
    pathPts.push(new THREE.Vector3(
      -half * 1.35 + t * half * 2.7,
      -1.7 + t * 2.9 + Math.sin(t * Math.PI) * 0.25,
      -1.2
    ));
  }
  var pathGeo = new THREE.BufferGeometry().setFromPoints(pathPts);
  var pathMat = new THREE.LineDashedMaterial({ color: 0x4e8ce8, dashSize: 0.28, gapSize: 0.2, transparent: true, opacity: 0.45 });
  var path = new THREE.Line(pathGeo, pathMat);
  path.computeLineDistances();
  scene.add(path);

  var plane = buildPlane();
  var planeScale = lowTier ? 0.5 : 0.62;
  plane.scale.setScalar(planeScale);
  scene.add(plane);

  /* Contrail (2026-08-23 wow pass): a ribbon of points left along the
   * climb behind the engine, fading with distance. Built as one Points
   * geometry whose positions are rewritten per frame - no allocations. */
  var TRAIL = lowTier ? 28 : 48;
  var trailPos = new Float32Array(TRAIL * 3);
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  var trailMat = new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.16, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true });
  var trail = new THREE.Points(trailGeo, trailMat);
  trail.frustumCulled = false;
  scene.add(trail);

  function curve(t) {
    return { x: -half * 1.35 + t * half * 2.7, y: -1.7 + t * 2.9 + Math.sin(t * Math.PI) * 0.25 };
  }
  function place(t) {
    // Same curve as the path line.
    var p = curve(t);
    plane.position.set(p.x, p.y, 0);
    // Pitch follows the climb gradient.
    var dy = 2.9 / (half * 2.7) + Math.cos(t * Math.PI) * Math.PI * 0.25 / (half * 2.7);
    plane.rotation.z = Math.atan2(dy, 1) * 2.1;
    // Trail: TRAIL samples back along the curve, each jittered a little so
    // it reads as vapour rather than a second dashed line.
    var span = 0.22;
    for (var i = 0; i < TRAIL; i++) {
      var u = i / (TRAIL - 1);
      var q = curve(t - u * span);
      var j = Math.sin(i * 12.9898) * 0.05 + Math.sin(i * 78.233) * 0.03;
      trailPos[i * 3] = q.x - 1.6 * planeScale;
      trailPos[i * 3 + 1] = q.y - 0.55 * planeScale + j * (0.4 + u * 1.6);
      trailPos[i * 3 + 2] = 0.3;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailMat.opacity = 0.55 * Math.max(0, Math.min(1, (t + 0.02) / 0.12));
  }

  var frame = 0;
  function render() {
    frame = requestAnimationFrame(render);
    if (mount.__vis !== false) renderer.render(scene, camera);
  }
  render();

  if (reduced) {
    place(0.55);
  } else {
    var prog = { t: -0.06 };
    place(prog.t);
    gsap.to(prog, {
      t: 1.06,
      ease: "none",
      scrollTrigger: {
        trigger: host,
        start: "top bottom",
        end: "bottom top",
        scrub: 0.7,
      },
      onUpdate: function () { place(prog.t); },
    });
  }

  function onResize() {
    var a = mount.clientWidth / mount.clientHeight;
    camera.left = (-FRUSTUM * a) / 2;
    camera.right = (FRUSTUM * a) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);
  warm(renderer, scene, camera);
  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frame);
    disposeScene(scene, renderer);
  }, { once: true });
}

/* ------------------------------ crane ------------------------------ */

function buildCrane(scene) {
  var steel = new THREE.MeshStandardMaterial({ color: "#d9a13c", roughness: 0.5, metalness: 0.3 });
  var dark = new THREE.MeshStandardMaterial({ color: "#3a4658", roughness: 0.55, metalness: 0.25 });
  var cabMat = new THREE.MeshStandardMaterial({ color: "#4a5a72", roughness: 0.35, metalness: 0.4 });

  var crane = new THREE.Group();

  // Base pad + mast: lattice suggested with alternating thin boxes.
  var pad = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.24, 1.2), dark);
  pad.position.set(0, -3.4, 0);
  crane.add(pad);

  var MAST_H = 6.2;
  for (var s = 0; s < 14; s++) {
    var y = -3.2 + (s * MAST_H) / 14;
    var rail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), steel);
    rail.position.set(0, y, 0);
    crane.add(rail);
    var diag = new THREE.Mesh(new THREE.BoxGeometry(0.05, MAST_H / 14 + 0.12, 0.05), steel);
    diag.position.set(s % 2 ? 0.22 : -0.22, y + MAST_H / 28, 0.2);
    diag.rotation.z = s % 2 ? 0.5 : -0.5;
    crane.add(diag);
  }
  [-0.24, 0.24].forEach(function (dx) {
    [-0.24, 0.24].forEach(function (dz) {
      var leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, MAST_H, 0.07), steel);
      leg.position.set(dx, -3.2 + MAST_H / 2, dz);
      crane.add(leg);
    });
  });

  var topY = -3.2 + MAST_H;

  // Operator cab
  var cab = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.56, 0.6), cabMat);
  cab.position.set(0.42, topY + 0.28, 0);
  crane.add(cab);

  // Jib (working arm, to the right) + counter-jib (left)
  var JIB_LEN = 7.2;
  var jib = new THREE.Mesh(new THREE.BoxGeometry(JIB_LEN, 0.12, 0.3), steel);
  jib.position.set(JIB_LEN / 2 + 0.3, topY + 0.62, 0);
  crane.add(jib);
  for (var j = 0; j < 12; j++) {
    var seg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), steel);
    seg.position.set(0.7 + j * 0.58, topY + 0.45, 0);
    seg.rotation.z = j % 2 ? 0.6 : -0.6;
    crane.add(seg);
  }
  var cjib = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.3), steel);
  cjib.position.set(-1.5, topY + 0.62, 0);
  crane.add(cjib);
  var weight = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.6), dark);
  weight.position.set(-2.45, topY + 0.15, 0);
  crane.add(weight);

  // Apex + tie bars
  var apex = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.1, 4), steel);
  apex.position.set(0, topY + 1.25, 0);
  crane.add(apex);
  [[JIB_LEN * 0.75 + 0.3, topY + 0.68], [-2.3, topY + 0.68]].forEach(function (pt) {
    var dx = pt[0], dy = topY + 1.7 - pt[1];
    var len = Math.sqrt(dx * dx + dy * dy);
    var bar = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 6), dark);
    bar.position.set(pt[0] / 2, pt[1] + dy / 2, 0);
    bar.rotation.z = Math.atan2(dx, dy);
    crane.add(bar);
  });

  scene.add(crane);

  // Trolley + hoist cable + hook: the moving parts.
  var trolley = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.4), dark);
  trolley.position.set(2, topY + 0.5, 0);
  scene.add(trolley);

  var cableMat = new THREE.MeshBasicMaterial({ color: 0x9aa3b2 });
  var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), cableMat);
  scene.add(cable);

  var hook = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), steel);
  scene.add(hook);

  return { trolley: trolley, cable: cable, hook: hook, topY: topY, jibLen: JIB_LEN };
}

function craneScene(host) {
  var mount = host.querySelector(".band3d-stage");
  var pinEl = host.querySelector(".band3d-pin");
  var labels = Array.prototype.slice.call(host.querySelectorAll(".crane-systems li"));
  if (!mount) return;

  var scene = new THREE.Scene();
  var mid = window.innerWidth >= 640 && window.innerWidth < 1300;
  var FRUSTUM = window.innerWidth < 640 ? 13 : mid ? 12.5 : 10;
  var aspect = mount.clientWidth / mount.clientHeight;
  var camera = new THREE.OrthographicCamera(
    (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 100
  );
  camera.position.set(2.2, 1.6, 20);
  // Mid widths (Keeno's "minimized a little" desktop): look further right
  // so the block wall clears the label column instead of sitting under it.
  // Mid widths: copy + labels stack on the left, so look LEFT of the mast
  // to push the whole crane into the right third of the frame.
  camera.lookAt(window.innerWidth < 640 ? 2.2 : mid ? -0.6 : 0.8, 0.2, 0);

  var renderer = makeRenderer(mount);

  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141b28, 1.35));
  var key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(6, 9, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x8fb6ec, 0.7);
  rim.position.set(-8, 4, 5);
  scene.add(rim);

  // Ground line
  var ground = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.06, 3),
    new THREE.MeshStandardMaterial({ color: "#1b2536", roughness: 0.9 })
  );
  ground.position.y = -3.55;
  scene.add(ground);

  var parts = buildCrane(scene);

  // The six system blocks: 2 columns x 3 rows wall, brand tints.
  var tints = ["#1d5fbf", "#3fbe73", "#123e7a", "#4e8ce8", "#147a3d", "#0b2a55"];
  var BW = 1.7, BH = 1.05, GAP = 0.14;
  var stackX0 = 3.4, stackY0 = -3.4 + 0.03 + BH / 2 + 0.12;
  var slots = [];
  for (var r = 0; r < 3; r++) for (var c = 0; c < 2; c++) {
    slots.push({ x: stackX0 + c * (BW + GAP), y: stackY0 + r * (BH + GAP) });
  }

  var blocks = tints.map(function (tint, i) {
    var relay = i === tints.length - 1;
    var mat = new THREE.MeshStandardMaterial({
      color: relay ? "#1d5fbf" : tint, roughness: 0.42, metalness: 0.18,
      emissive: relay ? "#1d5fbf" : tint, emissiveIntensity: 0,
    });
    var b = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, 1.1), mat);
    if (relay) dressRelayBlock(b, BW, BH, 1.1);
    b.visible = false;
    scene.add(b);
    return b;
  });

  var pickup = { x: 0.9, y: -3.4 + BH / 2 + 0.15 };
  var liftY = parts.topY - 0.6;

  function setHoist(x, cableTop, cableBottom) {
    parts.trolley.position.x = x;
    var len = Math.max(cableTop - cableBottom, 0.05);
    parts.cable.scale.y = len;
    parts.cable.position.set(x, cableTop - len / 2, 0);
    parts.hook.position.set(x, cableBottom - 0.12, 0);
  }

  function apply(p) {
    // Six phases, one per block, plus a short outro for the hook.
    var per = 1 / 6;
    blocks.forEach(function (b, i) {
      var lo = i * per;
      var t = Math.max(0, Math.min((p - lo) / per, 1));
      var slot = slots[i];
      if (t <= 0) { b.visible = false; return; }
      b.visible = true;
      var placedGlow = 0.32;
      if (t < 0.18) {
        // Rise from the pickup zone to lift height.
        var k = t / 0.18;
        b.position.set(pickup.x, pickup.y + (liftY - pickup.y) * k, 0);
        b.material.emissiveIntensity = 0.55;
        if (i === Math.floor(p / per)) setHoist(pickup.x, parts.topY + 0.45, b.position.y + BH / 2);
      } else if (t < 0.62) {
        // Carry across to the slot column.
        var k2 = (t - 0.18) / 0.44;
        var e = k2 < 0.5 ? 2 * k2 * k2 : 1 - Math.pow(-2 * k2 + 2, 2) / 2;
        var x = pickup.x + (slot.x - pickup.x) * e;
        b.position.set(x, liftY, 0);
        b.material.emissiveIntensity = 0.55;
        if (i === Math.floor(p / per)) setHoist(x, parts.topY + 0.45, liftY + BH / 2);
      } else if (t < 0.92) {
        // Lower onto the slot.
        var k3 = (t - 0.62) / 0.3;
        var y = liftY + (slot.y - liftY) * (1 - Math.pow(1 - k3, 2));
        b.position.set(slot.x, y, 0);
        b.material.emissiveIntensity = 0.55;
        if (i === Math.floor(p / per)) setHoist(slot.x, parts.topY + 0.45, y + BH / 2);
      } else {
        // Placed: settle the glow down to its resting state.
        b.position.set(slot.x, slot.y, 0);
        b.material.emissiveIntensity = placedGlow + (0.55 - placedGlow) * (1 - (t - 0.92) / 0.08);
      }
      if (labels[i]) labels[i].classList.toggle("is-placed", t >= 0.92);
    });
    // Park the hook when everything is placed.
    if (p >= 1 - 0.001) setHoist(2.2, parts.topY + 0.45, parts.topY - 0.4);
    if (p > 0.97) relayComplete(1);
  }

  var frame = 0;
  function render() {
    frame = requestAnimationFrame(render);
    if (mount.__vis !== false) renderer.render(scene, camera);
  }
  render();

  if (reduced || !pinEl) {
    apply(1);
    labels.forEach(function (l) { l.classList.add("is-placed"); });
  } else {
    apply(0);
    ScrollTrigger.create({
      trigger: host,
      start: "top top",
      // Pin distance must be a FRACTION OF THE VIEWPORT, never a fixed pixel
      // count. A flat "+=1500" is ~1.5 screen-heights on a 982px desktop and
      // **2.25 screen-heights on a 667px iPhone SE** — the phone user is held
      // in a motionless pinned section for over two full screens of scrolling.
      // `cinematic-site-playbook.md` §1c already measured that 2.2 screens
      // "dragged"; this was worse than the case that rule came from, and it
      // only appeared on small viewports because the constant never changed.
      //
      // As a FUNCTION, not a string, so `invalidateOnRefresh` actually
      // re-evaluates it on rotate/resize. A string is read once at create
      // time and would keep a portrait value after the device turns.
      end: function () {
        var vh = window.innerHeight || 800;
        // Six labels need room to land one at a time without a strobe, so
        // don't go below ~1.15 screens; above ~1.5 it starts to drag again.
        return "+=" + Math.round(vh * (vh < 720 ? 1.25 : 1.5));
      },
      pin: pinEl,
      pinSpacing: true,
      anticipatePin: 1,
      scrub: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) { apply(self.progress); },
    });
  }

  function onResize() {
    var a = mount.clientWidth / mount.clientHeight;
    camera.left = (-FRUSTUM * a) / 2;
    camera.right = (FRUSTUM * a) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);
  warm(renderer, scene, camera);
  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frame);
    disposeScene(scene, renderer);
  }, { once: true });
}


/* ----------------------------- conveyor ----------------------------- */
/* Systems hub: the six blocks ride an automation line through a
 * scanning arch that flashes as each one passes. */

function conveyorScene(host) {
  var mount = host.querySelector(".band3d-stage");
  if (!mount) return;

  var scene = new THREE.Scene();
  var FRUSTUM = 7;
  var aspect = mount.clientWidth / mount.clientHeight;
  var camera = new THREE.OrthographicCamera(
    (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 100
  );
  camera.position.set(1.6, 1.9, 20);
  camera.lookAt(0, -0.4, 0);

  var renderer = makeRenderer(mount);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141b28, 1.35));
  var key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(5, 8, 9);
  scene.add(key);

  var half = (FRUSTUM * aspect) / 2;
  var steel = new THREE.MeshStandardMaterial({ color: "#3a4658", roughness: 0.5, metalness: 0.3 });
  var beltMat = new THREE.MeshStandardMaterial({ color: "#1b2536", roughness: 0.85 });

  // Belt + rollers
  var beltW = half * 2.9;
  var belt = new THREE.Mesh(new THREE.BoxGeometry(beltW, 0.14, 1.5), beltMat);
  belt.position.y = -1.5;
  scene.add(belt);
  var rollers = [];
  var rollerCount = Math.max(10, Math.floor(beltW / 1.15));
  for (var i = 0; i < rollerCount; i++) {
    var rl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.6, 14), steel);
    rl.rotation.x = Math.PI / 2;
    rl.position.set(-beltW / 2 + 0.6 + i * (beltW - 1.2) / (rollerCount - 1), -1.78, 0);
    scene.add(rl);
    rollers.push(rl);
    var leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.12), steel);
    leg.position.set(rl.position.x, -2.4, 0.55);
    scene.add(leg);
  }

  // Scanner arch at center
  var archMat = new THREE.MeshStandardMaterial({
    color: "#4e8ce8", roughness: 0.4, metalness: 0.3,
    emissive: "#4e8ce8", emissiveIntensity: 0.25,
  });
  [-1, 1].forEach(function (s) {
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.16), archMat);
    post.position.set(s * 1.05, -0.25, 0);
    scene.add(post);
  });
  var lintel = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.16, 0.16), archMat);
  lintel.position.set(0, 1.0, 0);
  scene.add(lintel);
  var beam = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 2.1, 0.02),
    new THREE.MeshBasicMaterial({ color: "#3fbe73", transparent: true, opacity: 0.0 })
  );
  beam.position.set(0, -0.15, 0);
  scene.add(beam);

  // Scanner sweep: a thin bright line that rakes across whatever is in
  // the arch (2026-08-23 wow pass). Driven by the same shift as the belt
  // so it reverses with the scrub.
  var sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 2.0),
    new THREE.MeshBasicMaterial({ color: "#7ff0a8", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sweep.position.set(0, -0.15, 0.6);
  scene.add(sweep);

  // Signal line: automation data running above the belt, opposite the
  // blocks, on its own clock so the band breathes even when the page is
  // still. One Points mesh, positions rewritten per frame.
  var SIG = lowTier ? 40 : 70;
  var sigPos = new Float32Array(SIG * 3);
  var sigSeed = new Float32Array(SIG);
  for (var si = 0; si < SIG; si++) {
    sigSeed[si] = Math.random();
    sigPos[si * 3] = -half * 1.5 + sigSeed[si] * half * 3;
    sigPos[si * 3 + 1] = 1.95 + Math.sin(si * 3.7) * 0.08;
    sigPos[si * 3 + 2] = -0.7;
  }
  var sigGeo = new THREE.BufferGeometry();
  sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPos, 3));
  var signal = new THREE.Points(sigGeo, new THREE.PointsMaterial({ color: 0x8fb6ec, size: 0.07, transparent: true, opacity: 0.75, depthWrite: false }));
  signal.frustumCulled = false;
  scene.add(signal);
  var pipe = new THREE.Mesh(new THREE.BoxGeometry(half * 3, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x2a3a55 }));
  pipe.position.set(0, 1.95, -0.7);
  scene.add(pipe);

  // The six blocks, spaced along the run
  var tints = ["#1d5fbf", "#3fbe73", "#123e7a", "#4e8ce8", "#147a3d", "#0b2a55"];
  var blocks = tints.map(function (tint, i) {
    var relay = i === 0;
    var m = new THREE.MeshStandardMaterial({
      color: relay ? "#1d5fbf" : tint, roughness: 0.42, metalness: 0.18,
      emissive: relay ? "#1d5fbf" : tint, emissiveIntensity: 0.2,
    });
    var b = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.85, 1.05), m);
    if (relay) dressRelayBlock(b, 1.15, 0.85, 1.05);
    b.position.y = -0.95;
    scene.add(b);
    // Stamp: a green plate that pops onto the block once it has cleared
    // the scanner - each block leaves the arch "checked".
    var stamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.07, 0.46),
      new THREE.MeshStandardMaterial({ color: "#3fbe73", emissive: "#3fbe73", emissiveIntensity: 0.9, roughness: 0.4 })
    );
    stamp.position.y = 0.85 / 2 + 0.04;
    stamp.scale.setScalar(0.001);
    b.add(stamp);
    b.__stamp = stamp;
    return b;
  });

  var SPACING = 2.35;
  function place(t) {
    // Whole line slides left as you scroll; wraps so the band never empties.
    var runW = SPACING * blocks.length + half * 2 + 2;
    var shift = t * runW * 0.85;
    var glow = 0;
    blocks.forEach(function (b, i) {
      var x = half + 1 + i * SPACING - shift;
      // wrap
      var wrapped = ((x + runW / 2) % runW + runW) % runW - runW / 2;
      b.position.x = wrapped;
      b.position.y = -0.95 + Math.sin(wrapped * 1.7) * 0.02;
      var inArch = Math.abs(wrapped) < 0.75;
      b.material.emissiveIntensity = inArch ? 0.65 : 0.2;
      if (inArch) glow = Math.max(glow, 1 - Math.abs(wrapped) / 0.75);
      // stamp pops over the 0.45 units after the block clears the arch
      // leftwards; a block re-entering from the right is unstamped again
      var st = Math.max(0, Math.min(1, (-0.75 - wrapped) / 0.45));
      var pop = st < 1 ? 1.18 * Math.sin(st * Math.PI * 0.5) : 1;
      b.__stamp.scale.setScalar(Math.max(0.001, pop));
    });
    beam.material.opacity = glow * 0.22;
    lintel.material.emissiveIntensity = 0.25 + glow * 0.5;
    sweep.material.opacity = glow * 0.9;
    sweep.position.x = -0.85 + ((((shift * 2.4) % 1.7) + 1.7) % 1.7);
    rollers.forEach(function (rl) { rl.rotation.y = -shift / 0.16; });
    // The band sits at the page foot, so the scrub can never reach the
    // high-t range there - complete once the line has visibly run.
    if (t > 0.55) relayComplete(2);
  }

  var frame = 0, sigT = 0;
  function render() {
    frame = requestAnimationFrame(render);
    if (mount.__vis === false) return;
    if (!reduced) {
      sigT += 0.016;
      for (var i = 0; i < SIG; i++) {
        var u = (sigSeed[i] + sigT * (0.05 + sigSeed[i] * 0.04)) % 1;
        sigPos[i * 3] = -half * 1.5 + u * half * 3;
      }
      sigGeo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  render();

  if (reduced) {
    place(0.35);
  } else {
    var prog = { t: 0 };
    place(0);
    gsap.to(prog, {
      t: 1, ease: "none",
      scrollTrigger: { trigger: host, start: "top bottom", end: "bottom top", scrub: 0.7 },
      onUpdate: function () { place(prog.t); },
    });
  }

  function onResize() {
    var a = mount.clientWidth / mount.clientHeight;
    camera.left = (-FRUSTUM * a) / 2; camera.right = (FRUSTUM * a) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);
  warm(renderer, scene, camera);
  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frame); disposeScene(scene, renderer);
  }, { once: true });
}

/* ------------------------------ truck ------------------------------- */
/* Pricing: a Stradigi-liveried box truck crossing the band. Delivery,
 * literally. Same orthographic side-elevation family as the plane. */

function buildTruck() {
  var g = new THREE.Group();
  var boxMat = new THREE.MeshStandardMaterial({ color: "#e9ebef", roughness: 0.55, metalness: 0.08 });
  var cabMat = new THREE.MeshStandardMaterial({ color: "#1d5fbf", roughness: 0.4, metalness: 0.25 });
  var stripe = new THREE.MeshStandardMaterial({ color: "#3fbe73", roughness: 0.45, metalness: 0.15 });
  var dark = new THREE.MeshStandardMaterial({ color: "#2a3548", roughness: 0.6, metalness: 0.25 });
  var rubber = new THREE.MeshStandardMaterial({ color: "#10151f", roughness: 0.92 });
  var rim = new THREE.MeshStandardMaterial({ color: "#8d95a3", roughness: 0.35, metalness: 0.7 });
  var glass = new THREE.MeshStandardMaterial({ color: "#1b2330", roughness: 0.2, metalness: 0.55 });

  var WHEEL_R = 0.5;
  var DECK = WHEEL_R + 0.35;

  // Cargo box
  var box = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.5, 1.9), boxMat);
  box.position.set(-1.1, DECK + 1.25, 0);
  g.add(box);
  var band = new THREE.Mesh(new THREE.BoxGeometry(4.62, 0.34, 1.92), stripe);
  band.position.set(-1.1, DECK + 0.65, 0);
  g.add(band);
  // Chassis
  var chassis = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.24, 1.2), dark);
  chassis.position.set(-0.5, DECK - 0.1, 0);
  g.add(chassis);
  // Cab
  var cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 1.85), cabMat);
  cab.position.set(2.15, DECK + 0.75, 0);
  g.add(cab);
  var hood = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 1.8), cabMat);
  hood.position.set(3.25, DECK + 0.28, 0);
  g.add(hood);
  var windshield = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 1.6), glass);
  windshield.position.set(3.0, DECK + 1.1, 0);
  windshield.rotation.z = -0.2;
  g.add(windshield);
  var sideWin = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.05), glass);
  sideWin.position.set(2.3, DECK + 1.15, 0.93);
  g.add(sideWin);
  var bumper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.4, 1.86), rim);
  bumper.position.set(3.62, DECK - 0.12, 0);
  g.add(bumper);

  // Wheels: two axles, returned for spin control
  var wheels = [];
  [[-2.35], [2.5]].forEach(function (ax) {
    [-1, 1].forEach(function (side) {
      var tyre = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.3, 22), rubber);
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(ax[0], WHEEL_R, side * 0.8);
      g.add(tyre);
      var hub = new THREE.Mesh(new THREE.CylinderGeometry(WHEEL_R * 0.45, WHEEL_R * 0.45, 0.32, 16), rim);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(ax[0], WHEEL_R, side * 0.81);
      g.add(hub);
      wheels.push(tyre, hub);
    });
  });

  // Contact shadow
  var shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 2.4),
    new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(-0.3, 0.004, 0);
  g.add(shadow);

  return { group: g, wheels: wheels, wheelR: WHEEL_R };
}

function makeShadowTexture() {
  var s = 256;
  var c = document.createElement("canvas");
  c.width = c.height = s;
  var x = c.getContext("2d");
  var grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(0,0,0,0.45)");
  grd.addColorStop(0.55, "rgba(0,0,0,0.16)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = grd;
  x.fillRect(0, 0, s, s);
  var t = new THREE.CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

function truckScene(host) {
  var mount = host.querySelector(".band3d-stage");
  if (!mount) return;

  var scene = new THREE.Scene();
  var FRUSTUM = 8;
  var aspect = mount.clientWidth / mount.clientHeight;
  var camera = new THREE.OrthographicCamera(
    (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 100
  );
  camera.position.set(2.2, 2.1, 20);
  camera.lookAt(0, 0.6, 0);

  var renderer = makeRenderer(mount);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x1a2233, 1.4));
  var key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(6, 9, 8);
  scene.add(key);
  var rim = new THREE.DirectionalLight(0x8fb6ec, 0.7);
  rim.position.set(-7, 3, 6);
  scene.add(rim);

  // Road line
  var half = (FRUSTUM * aspect) / 2;
  var road = new THREE.Mesh(
    new THREE.BoxGeometry(half * 3, 0.05, 2.6),
    new THREE.MeshStandardMaterial({ color: "#1b2536", roughness: 0.9 })
  );
  road.position.y = -1.55;
  scene.add(road);

  var t = buildTruck();
  var truck = t.group;
  truck.position.y = -1.52;
  var TS = lowTier ? 0.62 : 0.75;
  // Mirrored in x (2026-08-23): the cab is built at +x but the truck
  // crosses right-to-left, so it drove the whole band in reverse.
  truck.scale.set(-TS, TS, TS);
  scene.add(truck);

  // Lane dashes on the road, for the speed read.
  var dashMat = new THREE.MeshBasicMaterial({ color: 0x3a4658 });
  for (var di = -8; di <= 8; di++) {
    var dash = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.02, 0.08), dashMat);
    dash.position.set(di * 1.6, -1.51, 0);
    scene.add(dash);
  }

  // Skyline: dark blocks far back, parallaxing a little against the
  // truck so the crossing reads as distance, not a treadmill.
  var skyline = new THREE.Group();
  var skyMat = new THREE.MeshStandardMaterial({ color: "#0d1422", roughness: 0.95 });
  for (var ki = 0; ki < 16; ki++) {
    var hgt = 1.2 + Math.abs(Math.sin(ki * 2.3)) * 2.6;
    var bld = new THREE.Mesh(new THREE.BoxGeometry(0.9 + Math.abs(Math.sin(ki * 1.7)) * 0.9, hgt, 0.6), skyMat);
    bld.position.set(-half * 1.6 + ki * (half * 3.2 / 15), -1.55 + hgt / 2, -4.5);
    skyline.add(bld);
    // a few lit windows
    if (ki % 2 === 0) {
      var win = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.16), new THREE.MeshBasicMaterial({ color: 0x8fb6ec }));
      win.position.set(bld.position.x + 0.2, bld.position.y + hgt * 0.15, -4.19);
      skyline.add(win);
    }
  }
  scene.add(skyline);

  // Headlights: two lamps on the front of the cab (the truck's local +x,
  // which the mirror puts on the left) and a soft beam when rolling.
  var lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  [-0.6, 0.6].forEach(function (lz) {
    var lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), lampMat);
    lamp.position.set(3.66, t.wheelR + 0.42, lz);
    truck.add(lamp);
  });
  var beamL = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.1),
    new THREE.MeshBasicMaterial({ color: 0xfff3c4, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  beamL.position.set(5.0, t.wheelR + 0.35, 0.2);
  truck.add(beamL);

  // Exhaust: a small ring buffer of puffs rising from the stack while
  // the truck moves, on their own clock so they keep drifting at a stop.
  var PUFF = 22;
  var puffPos = new Float32Array(PUFF * 3);
  var puffAge = new Float32Array(PUFF).fill(9);
  var puffGeo = new THREE.BufferGeometry();
  puffGeo.setAttribute("position", new THREE.BufferAttribute(puffPos, 3));
  var puffMat = new THREE.PointsMaterial({ color: 0x9aa3b2, size: 0.22, transparent: true, opacity: 0.35, depthWrite: false });
  var puffs = new THREE.Points(puffGeo, puffMat);
  puffs.frustumCulled = false;
  scene.add(puffs);
  var puffHead = 0, lastX = null;
  function emitPuff(x) {
    var i = puffHead; puffHead = (puffHead + 1) % PUFF;
    puffPos[i * 3] = x + 1.2 * TS;            // behind the cab, over the box front
    puffPos[i * 3 + 1] = -1.52 + (t.wheelR + 1.95) * TS;
    puffPos[i * 3 + 2] = 0.6;
    puffAge[i] = 0;
  }

  // Overhead gantry at center: rail, spreader, cable, and the payload
  // block it lowers onto the truck bed mid-crossing (the reel's
  // container-onto-chassis handoff, translated).
  var steelG = new THREE.MeshStandardMaterial({ color: "#3a4658", roughness: 0.5, metalness: 0.3 });
  var rail = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.18, 0.3), steelG);
  rail.position.set(0, 3.1, 0);
  scene.add(rail);
  [-3.4, 3.4].forEach(function (rx) {
    var post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 4.8, 0.16), steelG);
    post.position.set(rx, 0.7, 0);
    scene.add(post);
  });
  var spreader = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.6), steelG);
  scene.add(spreader);
  var cableG = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 1, 6),
    new THREE.MeshBasicMaterial({ color: 0x9aa3b2 })
  );
  scene.add(cableG);
  var payload = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 0.95, 1.2),
    new THREE.MeshStandardMaterial({
      color: "#1d5fbf", roughness: 0.4, metalness: 0.2,
      emissive: "#1d5fbf", emissiveIntensity: 0.5,
    })
  );
  dressRelayBlock(payload, 1.5, 0.95, 1.2);
  scene.add(payload);

  var HOLD_A = 0.42, HOLD_B = 0.60; // truck waits under the gantry
  // Land on the cargo-box roof: box top sits at truck.y + (DECK + box
  // height) * scale; payload half-height on top of that.
  var BED_Y = -1.52 + (0.85 + 2.5) * 0.75 + 0.48;
  var HIGH_Y = 2.6;

  function truckX(p) {
    // Piecewise travel: in, hold at center, out. Same distance, so the
    // scrub stays reversible and the wheels pause naturally.
    var inX = half + 5, outX = -(half + 5);
    if (p < HOLD_A) return inX + (0 - inX) * (p / HOLD_A);
    if (p < HOLD_B) return 0;
    return (outX) * ((p - HOLD_B) / (1 - HOLD_B));
  }

  function place(p) {
    var x = truckX(p);
    truck.position.x = x;
    var spin = x / (t.wheelR * TS);
    t.wheels.forEach(function (w) { w.rotation.z = spin; });
    // Suspension: a damped dip as the payload lands, then level.
    var dip = 0;
    if (p >= HOLD_B && p < HOLD_B + 0.07) dip = 0.07 * Math.sin(((p - HOLD_B) / 0.07) * Math.PI);
    truck.position.y = -1.52 - dip;
    skyline.position.x = -x * 0.06;
    var dx = lastX === null ? 0 : Math.abs(x - lastX);
    var moving = dx > 0.004;
    if (moving && Math.random() < Math.min(1, dx * 2.5)) emitPuff(x);
    beamL.material.opacity = moving ? 0.16 : 0.06;
    lastX = x;

    // Payload: waits high, descends onto the bed during the hold, rides
    // along after.
    // The cargo box sits at local x=-1.1 on the truck, so the payload
    // lands there and rides that point once released.
    var py, px;
    if (p < HOLD_A) { px = 0; py = HIGH_Y; }
    else if (p < HOLD_B) {
      var k = (p - HOLD_A) / (HOLD_B - HOLD_A);
      var e = 1 - Math.pow(1 - k, 2);
      px = 0;
      py = HIGH_Y + (BED_Y - HIGH_Y) * e;
    } else {
      px = x - 1.1 * truck.scale.x;
      py = BED_Y;
    }
    payload.position.set(px, py, 0);
    payload.material.emissiveIntensity = p < HOLD_B ? 0.55 : 0.3;

    if (p > 0.9) relayComplete(3);

    // Spreader + cable track the payload while it is on the hook.
    var hooked = p < HOLD_B;
    spreader.visible = cableG.visible = true;
    var sy = hooked ? py + 0.65 : HIGH_Y + 0.65;
    spreader.position.set(0, sy, 0);
    var cLen = Math.max(3.1 - 0.1 - sy, 0.05);
    cableG.scale.y = cLen;
    cableG.position.set(0, 3.1 - cLen / 2, 0);
  }

  var frame = 0;
  function render() {
    frame = requestAnimationFrame(render);
    if (mount.__vis === false) return;
    if (!reduced) {
      for (var i = 0; i < PUFF; i++) {
        if (puffAge[i] > 2.2) continue;
        puffAge[i] += 0.016;
        puffPos[i * 3] += 0.012;            // drifts back (to +x, behind the mirrored truck)
        puffPos[i * 3 + 1] += 0.014;
      }
      puffGeo.attributes.position.needsUpdate = true;
      // the whole cloud fades together; individual fade would need a shader
      var youngest = 9; for (var j = 0; j < PUFF; j++) youngest = Math.min(youngest, puffAge[j]);
      puffMat.opacity = youngest > 2.2 ? 0 : 0.35 * (1 - youngest / 2.2);
    }
    renderer.render(scene, camera);
  }
  render();

  if (reduced) {
    place(0.5);
  } else {
    var prog = { t: -0.04 };
    place(prog.t);
    gsap.to(prog, {
      t: 1.04, ease: "none",
      scrollTrigger: { trigger: host, start: "top bottom", end: "bottom top", scrub: 0.7 },
      onUpdate: function () { place(prog.t); },
    });
  }

  function onResize() {
    var a = mount.clientWidth / mount.clientHeight;
    camera.left = (-FRUSTUM * a) / 2; camera.right = (FRUSTUM * a) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);
  warm(renderer, scene, camera);
  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frame); disposeScene(scene, renderer);
  }, { once: true });
}

/* ------------------------------- map -------------------------------- */
/* Contact: the dotted-terrain technique from the reference's globe,
 * flattened to their real service area. Three pins, real places. */

function mapScene(host) {
  var mount = host.querySelector(".band3d-stage");
  if (!mount) return;
  var labels = Array.prototype.slice.call(host.querySelectorAll(".map-label"));

  var scene = new THREE.Scene();
  var FRUSTUM = 8;
  var aspect = mount.clientWidth / mount.clientHeight;
  var camera = new THREE.OrthographicCamera(
    (-FRUSTUM * aspect) / 2, (FRUSTUM * aspect) / 2, FRUSTUM / 2, -FRUSTUM / 2, 0.1, 100
  );
  camera.position.set(0, 5.2, 12);
  camera.lookAt(0, 0, 0);

  var renderer = makeRenderer(mount);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x141b28, 1.3));

  // Dotted terrain: a point grid with a slow ripple.
  var COLS = lowTier ? 46 : 64, ROWS = lowTier ? 26 : 36;
  var W = 13, D = 7.5;
  var positions = new Float32Array(COLS * ROWS * 3);
  var idx = 0;
  for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
    positions[idx++] = -W / 2 + (c / (COLS - 1)) * W;
    positions[idx++] = 0;
    positions[idx++] = -D / 2 + (r / (ROWS - 1)) * D;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  var pts = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x4e8ce8, size: 0.055, transparent: true, opacity: 0.65,
  }));
  scene.add(pts);

  // Pins: real relative bearings - Pittsburgh NE, Canonsburg (HQ) SW of
  // it, Washington further SW.
  var PINS = [
    { x: 2.6, z: -1.5, hq: false }, // Pittsburgh
    { x: 0.2, z: 0.6, hq: true },   // Canonsburg - HQ
    { x: -2.4, z: 2.0, hq: false }, // Washington
  ];
  var pinMeshes = PINS.map(function (p) {
    var color = p.hq ? "#3fbe73" : "#4e8ce8";
    var pin = new THREE.Group();
    var stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, p.hq ? 1.1 : 0.85, 8),
      new THREE.MeshBasicMaterial({ color: color })
    );
    stem.position.y = (p.hq ? 1.1 : 0.85) / 2;
    pin.add(stem);
    var head = new THREE.Mesh(
      new THREE.SphereGeometry(p.hq ? 0.16 : 0.12, 14, 12),
      new THREE.MeshBasicMaterial({ color: color })
    );
    head.position.y = p.hq ? 1.1 : 0.85;
    pin.add(head);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.02, 8, 32),
      new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    pin.add(ring);
    pin.position.set(p.x, 0, p.z);
    scene.add(pin);
    return { group: pin, ring: ring, head: head };
  });

  // Routes (2026-08-23 wow pass): an arc from each outlying pin into HQ,
  // drawn as a faint dotted line with a bright pulse travelling inward -
  // the service area feeding the office. Points, not dashed lines, so
  // the pulse is a per-frame position write and nothing else.
  var hqIndex = PINS.findIndex(function (p) { return p.hq; });
  var hqP = PINS[hqIndex];
  var routes = PINS.map(function (p, i) {
    if (p.hq) return null;
    var a = new THREE.Vector3(p.x, 0.05, p.z), b = new THREE.Vector3(hqP.x, 0.05, hqP.z);
    var mid = a.clone().add(b).multiplyScalar(0.5); mid.y = 1.3;
    var curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    var N = 44;
    var dots = curve.getPoints(N - 1);
    var arr = new Float32Array(N * 3);
    dots.forEach(function (d, k) { arr[k * 3] = d.x; arr[k * 3 + 1] = d.y; arr[k * 3 + 2] = d.z; });
    var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    var line = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x4e8ce8, size: 0.045, transparent: true, opacity: 0.5, depthWrite: false }));
    scene.add(line);
    var pulse = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xbfe0ff }));
    scene.add(pulse);
    var halo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4e8ce8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(halo);
    return { curve: curve, pulse: pulse, halo: halo, phase: i * 0.37 };
  }).filter(Boolean);

  // Radar sweep at HQ: a translucent sector that turns once the block
  // has landed, plus a ground disc it turns on.
  var sweepSector = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 40, 0, Math.PI / 3),
    new THREE.MeshBasicMaterial({ color: 0x3fbe73, transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  sweepSector.rotation.x = -Math.PI / 2;
  sweepSector.position.set(hqP.x, 0.015, hqP.z);
  scene.add(sweepSector);
  var disc = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 1.35, 48),
    new THREE.MeshBasicMaterial({ color: 0x3fbe73, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(hqP.x, 0.012, hqP.z);
  scene.add(disc);

  var v = new THREE.Vector3();
  function projectLabels() {
    pinMeshes.forEach(function (pm, i) {
      var el = labels[i];
      if (!el) return;
      v.copy(pm.head.position).applyMatrix4(pm.group.matrixWorld);
      v.project(camera);
      var x = (v.x * 0.5 + 0.5) * mount.clientWidth;
      var y = (-v.y * 0.5 + 0.5) * mount.clientHeight;
      el.style.transform = "translate(-50%, -130%) translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
    });
  }

  // The relay's final leg: the block descends out of the sky and lands
  // at the Canonsburg HQ pin. Scrubbed, so it reverses.
  var delivery = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.6, 0.72),
    new THREE.MeshStandardMaterial({
      color: "#1d5fbf", roughness: 0.4, metalness: 0.2,
      emissive: "#1d5fbf", emissiveIntensity: 0.5,
    })
  );
  dressRelayBlock(delivery, 0.9, 0.6, 0.72);
  var hqPin = PINS.findIndex(function (p) { return p.hq; });
  var hq = PINS[hqPin];
  delivery.position.set(hq.x + 0.9, 4.2, hq.z + 0.55);
  scene.add(delivery);
  var landed = false;
  if (!reduced) {
    var dprog = { t: 0 };
    gsap.to(dprog, {
      t: 1,
      ease: "none",
      scrollTrigger: { trigger: host, start: "top 80%", end: "top 25%", scrub: 0.7 },
      onUpdate: function () {
        var e = 1 - Math.pow(1 - dprog.t, 2);
        delivery.position.y = 4.2 + (0.32 - 4.2) * e;
        delivery.material.emissiveIntensity = 0.5 - 0.2 * e;
        var wasLanded = landed;
        landed = dprog.t > 0.95;
        if (landed && !wasLanded) rippleT = 0;   // impact: the grid ripples out from HQ
        if (landed) relayComplete(5);
      },
    });
  } else {
    delivery.position.y = 0.32;
    landed = true;
  }

  var clock = 0, rippleT = -1;
  var frame = 0;
  function render() {
    frame = requestAnimationFrame(render);
    clock += 0.016;
    if (mount.__vis === false) return;
    if (!reduced) {
      var pos = geo.attributes.position;
      var rip = rippleT >= 0 && rippleT < 2.4;
      if (rip) rippleT += 0.016;
      var rr = rippleT * 3.2;  // ripple radius in scene units
      for (var i = 0; i < pos.count; i++) {
        var px = pos.getX(i), pz = pos.getZ(i);
        var y = Math.sin(px * 0.9 + clock * 0.7) * 0.07 + Math.cos(pz * 1.3 + clock * 0.5) * 0.05;
        if (rip) {
          var d = Math.hypot(px - hqP.x, pz - hqP.z);
          var w = d - rr;
          if (Math.abs(w) < 1.1) y += 0.34 * Math.cos(w * 2.9) * (1 - Math.abs(w) / 1.1) * Math.max(0, 1 - rippleT / 2.4);
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      // route pulses travel inward on a slow loop, offset per route
      routes.forEach(function (r) {
        var u = ((clock * 0.18 + r.phase) % 1 + 1) % 1;
        var pt = r.curve.getPoint(u);
        r.pulse.position.copy(pt);
        r.halo.position.copy(pt);
        var near = Math.max(0, 1 - Math.abs(u - 0.97) * 12);
        r.halo.scale.setScalar(1 + near * 1.4);
      });
      // radar once landed
      var on = landed ? 1 : 0;
      sweepSector.material.opacity += (on * 0.22 - sweepSector.material.opacity) * 0.05;
      disc.material.opacity += (on * 0.45 - disc.material.opacity) * 0.05;
      sweepSector.rotation.z = -clock * 0.9;
      pinMeshes.forEach(function (pm, i) {
        var boost = (landed && i === hqPin) ? 1.9 : 1;
        var s = 1 + 0.55 * boost * ((Math.sin(clock * (1.6 * boost) + i * 2.1) + 1) / 2);
        pm.ring.scale.setScalar(s);
        pm.ring.material.opacity = 0.85 - (s - 1) * (1.1 / boost);
      });
    }
    projectLabels();
    if (mount.__vis !== false) renderer.render(scene, camera);
  }
  render();

  function onResize() {
    var a = mount.clientWidth / mount.clientHeight;
    camera.left = (-FRUSTUM * a) / 2; camera.right = (FRUSTUM * a) / 2;
    camera.updateProjectionMatrix();
    renderer.setSize(mount.clientWidth, mount.clientHeight);
  }
  window.addEventListener("resize", onResize);
  warm(renderer, scene, camera);
  window.addEventListener("pagehide", function () {
    cancelAnimationFrame(frame); disposeScene(scene, renderer);
  }, { once: true });
}

/* ------------------------------ boot ------------------------------- */

var RELAY_SCENE_LEG = { crane: 1, conveyor: 2, truck: 3, map: 5 };

/* The intro (app.js) creates its ~20-viewport pin lazily, at reveal
 * (START). Triggers created before that pin exist are measured without
 * its spacer and land ~18,000px too early (measured: band at 26,237,
 * trigger start 8,417). Build the moment the pin-spacer appears - that
 * is the start of the ~4s reveal film, so scene construction and shader
 * compile happen under the film instead of at the gate drop, where they
 * used to stack into one 283ms hitch with app.js's own refresh. One scene
 * per frame so nothing lands in a single long task. */
function whenPinned(fn) {
  var root = document.documentElement;
  var ready = function () { return !root.classList.contains("gated") || !!document.querySelector(".pin-spacer"); };
  if (ready()) { fn(); return; }
  var mo = new MutationObserver(function () {
    if (ready()) { mo.disconnect(); setTimeout(fn, 0); }
  });
  mo.observe(root, { attributes: true, attributeFilter: ["class"], childList: true, subtree: true });
}

function eachFrame(items, fn, done) {
  var i = 0;
  (function step() {
    if (i >= items.length) { if (done) done(); return; }
    fn(items[i++]);
    requestAnimationFrame(step);
  })();
}

whenPinned(function () {
  var finish = function () {
    document.querySelectorAll(".route-band").forEach(routeBand);
    // While the intro is still gated, app.js refreshes everything itself at
    // the gate drop (finishReveal); a second full refresh here would only
    // add to that frame. Outside the gate (deep links, reduced flows) we
    // own the refresh.
    if (!document.documentElement.classList.contains("gated")) ScrollTrigger.refresh();
  };
  if (!webglOK()) {
    document.documentElement.classList.add("no-webgl");
    finish();
    return;
  }
  // app.js now builds the scrolly (and its pin-spacer) the moment the
  // preload finishes, under the static loader - so this fires there too,
  // with the page covered and nothing but the loader's slow ambient canvas
  // moving. Build immediately, one scene per frame.
  var delay = 0;
  setTimeout(function () {
  eachFrame(Array.prototype.slice.call(document.querySelectorAll(".band3d")), function (host) {
    var kind = host.getAttribute("data-scene");
    if (kind === "plane") planeScene(host);
    else if (kind === "crane") craneScene(host);
    else if (kind === "conveyor") conveyorScene(host);
    else if (kind === "truck") truckScene(host);
    else if (kind === "map") mapScene(host);
    if (RELAY_SCENE_LEG[kind]) {
      relayChip(kind === "crane" ? host.querySelector(".band3d-pin") || host : host, RELAY_SCENE_LEG[kind]);
    }
  }, finish);
  }, delay);
});

/* ---------------------------- route draw ---------------------------- */
/* About: the journey line - Build, Scale, Exit, Mentor - drawn by
 * scroll. Pure SVG, so it runs even where WebGL cannot. */

function routeBand(host) {
  var path = host.querySelector(".route-path");
  var nodesHost = host.querySelector(".route-nodes");
  var svg = host.querySelector(".route-svg");
  if (!path || !nodesHost || !svg) return;

  var STOPS = [
    { t: 0.05, label: "Build" },
    { t: 0.38, label: "Scale" },
    { t: 0.68, label: "Exit" },
    { t: 0.96, label: "Mentor", final: true },
  ];

  var len = path.getTotalLength();
  var vb = svg.viewBox.baseVal;

  var nodes = STOPS.map(function (stop) {
    var pt = path.getPointAtLength(len * stop.t);
    var el = document.createElement("div");
    el.className = "route-node" + (stop.final ? " is-final" : "");
    el.innerHTML = '<span class="dot"></span><span class="tag">' + stop.label + "</span>";
    // Position in % of the viewBox so it tracks the responsive SVG.
    el.style.left = (pt.x / vb.width * 100).toFixed(2) + "%";
    el.style.top = (pt.y / vb.height * 100).toFixed(2) + "%";
    nodesHost.appendChild(el);
    return { el: el, t: stop.t };
  });

  relayChip(host, 4);

  if (reduced) {
    nodes.forEach(function (n) { n.el.classList.add("is-lit"); });
    return;
  }

  // Draw the dashed line by masking with a second dash layer: animate
  // a cover dash from full length to zero.
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;

  // The relay block rides the line as it draws.
  var rider = document.createElementNS("http://www.w3.org/2000/svg", "g");
  rider.setAttribute("class", "route-rider");
  rider.innerHTML =
    '<rect x="-13" y="-10" width="26" height="20" rx="3"></rect>' +
    '<rect x="-4" y="-11" width="8" height="22" rx="2" class="route-rider-band"></rect>';
  svg.appendChild(rider);

  var prog = { p: 0 };
  gsap.to(prog, {
    p: 1,
    ease: "none",
    scrollTrigger: {
      trigger: host,
      start: "top 85%",
      end: "bottom 45%",
      scrub: 0.7,
    },
    onUpdate: function () {
      path.style.strokeDashoffset = len * (1 - prog.p);
      var pt = path.getPointAtLength(len * prog.p);
      rider.setAttribute("transform", "translate(" + pt.x.toFixed(1) + "," + (pt.y - 16).toFixed(1) + ")");
      rider.style.opacity = prog.p > 0.01 ? 1 : 0;
      nodes.forEach(function (n) {
        n.el.classList.toggle("is-lit", prog.p >= n.t);
      });
      if (prog.p > 0.95) relayComplete(4);
    },
  });
}

