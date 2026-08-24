/* scene3d.js — REAL 3D pieces for the exploded view (2026-08-21, Keeno:
   "go ahead and do the 3D pieces too").

   Each detached piece is a solid wedge: a 60° sector of the disc extruded
   to real thickness (ExtrudeGeometry with a small bevel), with the film's
   own emblem pixels projected onto the front cap and dark brushed metal on
   the cut faces and rim. So at the instant a piece detaches it shows the
   SAME pixels the flat disc showed (no swap — Keeno's locked answer #1),
   and from then on it is a true object: real perspective as it moves toward
   or away from the camera, real tilt, real light on the cut faces.

   Why not the GLB: the portfolio's stradigi-mark.glb turned out to be the S
   letterform + ring only, with no disc body (probed 2026-08-21 — clipping it
   into sectors produced shards of the letter, not pie pieces of the mark).
   A built wedge is exact by construction and needs no alignment guess.

   No generative spend. Offline only: bake3d.html drives it; the runtime
   still draws one baked frame per tick. ES module because three.js is. */
import * as THREE from 'three';

const loadImage = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export async function createPieceRenderer({ filmSrc, disc, W, H, pieces = 6, A0 = -Math.PI / 2, thickness = 0.16 }) {
  const STEP = (Math.PI * 2) / pieces;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, premultipliedAlpha: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x9fb8dc, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(2.5, 3.5, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x4e8ce8, 1.4); rim.position.set(-4, 1, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9fd8b0, 0.3); fill.position.set(3, -2, 3); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

  /* texture: the film's own emblem, square crop of the disc */
  const film = await loadImage(filmSrc);
  const S = 1024, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const fcx = disc.x * film.width, fcy = disc.y * film.height, frr = disc.r * film.height;
  cv.getContext('2d').drawImage(film, fcx - frr, fcy - frr, frr * 2, frr * 2, 0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;

  const capMat = new THREE.MeshStandardMaterial({
    map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.66,
    metalness: 0.3, roughness: 0.5,
  });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x2a3446, metalness: 0.75, roughness: 0.38 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x141a26, metalness: 0.6, roughness: 0.6 });

  /* one solid wedge per sector. 2D scene angles are y-down; three is y-up. */
  const toW = (a) => -a;
  const pieceNodes = [];
  for (let p = 0; p < pieces; p++) {
    const a1 = toW(A0 + p * STEP), a2 = toW(A0 + (p + 1) * STEP);
    const mid2d = A0 + (p + 0.5) * STEP;
    /* NB: Shape.absarc() ignores a leading moveTo when it is the first
       curve in the path, so "moveTo(0,0); absarc()" silently becomes an arc
       closed by its chord — a crescent, not a sector (found by rendering
       piece 0 with a flat material: a thin sliver). Draw the two radii as
       explicit lines. */
    const lo = Math.min(a1, a2), hi = Math.max(a1, a2);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(Math.cos(lo), Math.sin(lo));
    shape.absarc(0, 0, 1, lo, hi, false);
    shape.lineTo(0, 0);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 64 });
    g.translate(0, 0, -thickness);               // front cap on z=0 (the texture plane), body behind it
    // front cap gets the film (planar, y up); everything else dark metal.
    // ExtrudeGeometry: group 0 = caps, group 1 = sides. Split caps by normal.
    const pos = g.attributes.position, nrm = g.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) { uv[i * 2] = pos.getX(i) / 2 + 0.5; uv[i * 2 + 1] = pos.getY(i) / 2 + 0.5; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = g.index ? Array.from(g.index.array) : null;
    // rebuild groups: front cap (n.z > .5) / back cap (n.z < -.5) / sides
    const tri = (a) => a; // indices are sequential for non-indexed
    const front = [], back = [], side = [];
    const count = g.index ? g.index.count : pos.count;
    for (let i = 0; i < count; i += 3) {
      const ia = g.index ? g.index.getX(i) : i;
      const nz = nrm.getZ(ia);
      (nz > 0.5 ? front : nz < -0.5 ? back : side).push(i, i + 1, i + 2);
    }
    const order = [...front, ...back, ...side];
    const getV = (attr, i) => g.index ? attr.array.slice(g.index.getX(i) * attr.itemSize, g.index.getX(i) * attr.itemSize + attr.itemSize) : attr.array.slice(i * attr.itemSize, (i + 1) * attr.itemSize);
    const P = [], Nn = [], U = [];
    for (const i of order) { P.push(...getV(g.attributes.position, i)); Nn.push(...getV(g.attributes.normal, i)); U.push(...getV(g.attributes.uv, i)); }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geom.addGroup(0, front.length, 0);
    geom.addGroup(front.length, back.length, 1);
    geom.addGroup(front.length + back.length, side.length, 2);
    const mesh = new THREE.Mesh(geom, [capMat, backMat, sideMat]);
    mesh.visible = false;
    scene.add(mesh);
    pieceNodes.push({ node: mesh, dir2d: { x: Math.cos(mid2d), y: Math.sin(mid2d) } });
  }

  const canvas = renderer.domElement;
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), axis = new THREE.Vector3();

  /* render the moving pieces for one frame. Inputs are the 2D scene's own
     numbers so the 3D camera lands the disc exactly where the flat one is:
     cx,cy = disc centre in px, unit = the 2D scale (R=0.5 unit == world 1). */
  function render({ es, cx, cy, unit, w, h, DZ, SPREAD }) {
    const Rpx = 0.5 * unit;
    const D = (h / 2) / (Rpx * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.aspect = w / h; camera.position.set(0, 0, D); camera.lookAt(0, 0, 0);
    camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    camera.updateProjectionMatrix();
    let any = false;
    pieceNodes.forEach((pc, p) => {
      const e = es[p];
      pc.node.visible = e > 0;
      if (e <= 0) return;
      any = true;
      const dx = pc.dir2d.x, dy = -pc.dir2d.y;                  // world, y up
      pc.node.position.set(dx * e * SPREAD * 2, dy * e * SPREAD * 2, e * DZ[p] * 0.9);
      // tilt about the in-plane axis perpendicular to the flight direction,
      // plus a touch about the flight axis — functions of e only, so the
      // piece is dead still once it has arrived (Keeno's locked answer #8)
      axis.set(-dy, dx, 0).normalize();
      q.setFromAxisAngle(axis, e * 0.30 * (DZ[p] >= 0 ? 1 : -1));
      axis.set(dx, dy, 0).normalize();
      q2.setFromAxisAngle(axis, e * 0.10);
      pc.node.quaternion.copy(q).multiply(q2);
    });
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    if (any) renderer.render(scene, camera);
    return canvas;
  }
  return { render, canvas, renderer, THREE, filmCanvas: cv, pieceNodes, scene, camera };
}
