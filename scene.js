/* SCENE — the one choreography, shared by the offline baker (bake.html)
   and, as a fallback, the runtime. Locked by Keeno's 20-question round,
   2026-08-21:
     - the emblem that appears under the cloth IS the emblem, never swapped
       (all mark pixels come from the reveal film's final frame)
     - one room: the film's own frame is the backdrop; a clean plate (same
       frame, emblem removed) takes over behind the first detach
     - stronger 3D depth, pieces dead still when floating, moderate push-ins
     - Ducati's 1s scrub glide, ~3 screens per system, glow + contact finale
   Frame 0 is pixel-identical to the film's last frame by construction. */
const SCENE = (() => {
  const CFG = {
    film: {
      frame: 'assets/film-last.jpg',    // reveal film, final frame (1920x1080)
      clean: 'assets/plate-clean.jpg',  // same frame, emblem + reflection removed
      w: 1920, h: 1080,
      disc: { x: 0.4917, y: 0.4889, r: 0.2241 }, // measured off film-last.jpg (fractions of frame w,h,h)
    },
    /* what lives inside each socket (Keeno, 2026-08-22 12-question round:
       "real photos from the site", "match each system's meaning", "blue-steel
       duotone", "in the socket it came from", "accumulate"). Paired by what
       is IN the frame, not the filename: the "excel" shot is Jason at a
       client dojo (Excel Martial Arts), the operator shot has the Inc. 5000
       plaque behind him — that is the authority image. All six are the
       site's own photos (~/stradigi-website/assets/img), nothing generated. */
    photos: [
      'assets/img/jason-mentoring-table.jpg',   // 01 Growth Mentorship  — Jason coaching a table of owners
      'assets/img/chaos-after.jpg',             // 02 Smart Automation   — the tools, wired into one network
      'assets/img/jason-operator.jpg',          // 03 Authority Builder  — the Inc. 5000 wall
      'assets/img/jason-excel-mentoring.jpg',   // 04 Business Engine    — Jason and a client on the laptop (Keeno swapped 04/05, 2026-08-22)
      'assets/img/jason-team.jpg',              // 05 Financial Clarity  — the Support → Deliver whiteboard
      'assets/img/vertical-professional.jpg',   // 06 Productivity Powerhouse — the ordered workspace
    ],
    /* focal point of each photo (fractions of its own w,h) — where the
       cover-crop into the wedge is anchored, so faces stay in the wedge */
    photoFocus: [[0.42, 0.42], [0.50, 0.50], [0.36, 0.45], [0.62, 0.50], [0.72, 0.50], [0.45, 0.55]],
  };

  const PIECES = 6;
  /* 0.40, was 0.55 (2026-08-21 Ducati pass). At 0.55 with the old 1.52
     push-in the detached piece left the top of the frame in every chapter
     (see the p=0.12 capture in the "Ducati Gap" report). The reference never
     lets the product leave the frame. 0.40 keeps the farthest point of the
     farthest piece inside a 16:9 viewport at the chapter camera below. */
  const SPREAD = 0.30;
  /* which side the copy panel sits on, per chapter. Pieces 0-2 fly +x
     (up-right, right, down-right), so their copy lives on the LEFT; pieces
     3-5 fly -x, copy on the RIGHT. The old strict left/right alternation put
     the panel on the same side the piece flew toward for chapters 2 and 5,
     and the old camera then slid the disc UNDER the panel (p=0.12 capture). */
  const PANEL_LEFT = (p) => p < 3;
  const R = 0.5;
  const DZ = [1, -0.75, 0.85, -1, 0.7, -0.9];
  /* 0.30, was 0.42. Depth scales a near piece up by (1 + DEPTH); with six
     pieces out at once the up-piece and down-piece extents add, and at 0.42
     the set was 1072px tall on a 1080px frame — the top and bottom pieces
     were clipped in every chapter from 4 on (t=0.55 preview). 0.30 with
     SPREAD 0.30 and the chapter camera below keeps the whole exploded set
     inside the frame with ~50px to spare; the DZ order still reads as depth. */
  const DEPTH = 0.30;
  const A0 = -Math.PI / 2;
  const STEP = (Math.PI * 2) / PIECES;

  const HERO = 0.05;
  const REASSEMBLE = [0.905, 0.95];
  const GLOW = [0.95, 1.0];
  const SYS_W = (REASSEMBLE[0] - HERO) / PIECES;
  const DETACH_RAMP = 0.06;
  const PLATE_BLEND = [0.02, 0.07];   // film frame -> clean plate

  let filmImg = null, cleanImg = null;

  const smoothstep = (t) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
  const lerpS = (a, b, t) => a + (b - a) * smoothstep(t);
  const sysStart = (p) => HERO + p * SYS_W;
  const pieceDir = (p) => { const m = A0 + (p + 0.5) * STEP; return { x: Math.cos(m), y: Math.sin(m) }; };

  function explodeAt(p, t) {
    let e = smoothstep((t - sysStart(p)) / DETACH_RAMP);
    if (t > REASSEMBLE[0]) {
      const u = smoothstep((t - REASSEMBLE[0]) / (REASSEMBLE[1] - REASSEMBLE[0]));
      e *= (1 - u * u);
    }
    return Math.max(0, e);
  }

  /* ---- camera ---- */
  function coverRect(iw, ih, w, h, zoom, px, py) {
    const s = Math.max(w / iw, h / ih) * zoom;
    const dw = iw * s, dh = ih * s;
    return { x: w / 2 - dw / 2 - px, y: h / 2 - dh / 2 - py, w: dw, h: dh, s };
  }
  /* the pose that puts the canvas disc exactly on the film's disc */
  function heroCamFor(w, h) {
    const r = coverRect(CFG.film.w, CFG.film.h, w, h, 1, 0, 0);
    const d = CFG.film.disc;
    return { x: (r.x + d.x * r.w) / w, y: (r.y + d.y * r.h) / h, z: (d.r * r.h) / (0.31 * Math.min(w, h)) };
  }
  const KEYS = (() => {
    const k = [{ t: HERO * 0.9, x: 0.5, y: 0.56, z: 1.0 }];
    /* Chapter camera (2026-08-21 Ducati pass). The old keys followed the
       detached piece — moved the disc toward the side the copy panel sits on
       and pushed in to z 1.52, so mid-chapter the disc sat under the panel
       and the piece was off the top of the frame. Now: the disc parks on the
       side OPPOSITE the panel (+/-0.10 of frame width), at a slightly wider
       camera than the hero (z 0.94–1.0), so disc + piece + copy all stay in
       frame — the reference's rule: the product is framed FOR the copy.
       Keeno's "moderate push-in" is kept as the 1.0 -> 0.94 -> 0.98 breath;
       the 1.52 zoom was what cropped the product, not what he asked for. */
    for (let p = 0; p < PIECES; p++) {
      const d0 = sysStart(p);
      const side = PANEL_LEFT(p) ? 1 : -1;          // disc away from the panel
      const k1 = SYS_W * 0.18, k2 = SYS_W * 0.42, k3 = p === PIECES - 1 ? SYS_W * 0.62 : SYS_W * 0.80;
      k.push({ t: d0 + k1, x: 0.5 + 0.08 * side, y: 0.50, z: 0.84 });
      k.push({ t: d0 + k2, x: 0.5 + 0.10 * side, y: 0.50, z: 0.80 });
      k.push({ t: d0 + k3, x: 0.5 + 0.08 * side, y: 0.50, z: 0.82 });
    }
    k.push({ t: REASSEMBLE[0], x: 0.5, y: 0.51, z: 0.88 });
    k.push({ t: REASSEMBLE[1], x: 0.5, y: 0.52, z: 1.0 });
    /* finale: higher and wider than before (y .46/z .80) so the closing copy
       sits on the floor below the plinth instead of across the mark's base */
    k.push({ t: 0.975, x: 0.5, y: 0.40, z: 0.74 });
    k.push({ t: 1.0, x: 0.5, y: 0.39, z: 0.72 });
    k.sort((a, b) => a.t - b.t);
    return k;
  })();
  /* Chapter keys are authored against the 1920x1080 bake. For any other
     canvas (the 1080x1920 phone bake, 2026-08-23) they are re-expressed
     relative to that canvas's own hero camera: same offsets from the hero
     pose, same zoom ratio, so the disc stays on its plinth instead of
     shrinking to landscape size while the plate scales 1.78x. At
     1920x1080 this is the identity. */
  const REF = { w: CFG.film.w, h: CFG.film.h };
  function relKey(k, w, h) {
    if (w === REF.w && h === REF.h) return k;
    const hr = heroCamFor(REF.w, REF.h), hc = heroCamFor(w, h);
    const portrait = w < h;
    /* portrait: the hero disc is ~80% of the width (it matches the film's
       cover crop), so the exploded set cannot fit at that scale - pull the
       chapter camera out to 0.72x and drop y so the disc's bottom edge
       stays on the plinth top; the panel sits above/below on phones, so
       the sideways parking is halved. */
    const zr = hc.z / hr.z * (portrait ? 0.42 : 1);
    const zEff = k.z * zr;
    /* phones: the copy panel owns the lower two thirds of the screen, so
       the chapters lift the disc into the top third (centre at 0.30 of
       the frame) and the camera move out of the hero is the rise itself;
       the exploded set at 0.62x stays inside the 1080 width. */
    const y = portrait ? 0.24 + (k.y - hr.y) * zr : hc.y + (k.y - hr.y) * zr;
    return { t: k.t, x: hc.x + (k.x - hr.x) * (portrait ? 0.5 : 1), y: y, z: zEff };
  }
  function camAt(t, w, h) {
    const hero = heroCamFor(w, h);
    const K0 = relKey(KEYS[0], w, h);
    if (t <= K0.t) {
      const u = t / K0.t;
      return { x: lerpS(hero.x, K0.x, u), y: lerpS(hero.y, K0.y, u), z: lerpS(hero.z, K0.z, u) };
    }
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = relKey(KEYS[i], w, h), b = relKey(KEYS[i + 1], w, h);
      if (t >= a.t && t <= b.t) { const u = (t - a.t) / (b.t - a.t || 1); return { x: lerpS(a.x, b.x, u), y: lerpS(a.y, b.y, u), z: lerpS(a.z, b.z, u) }; }
    }
    return relKey(KEYS[KEYS.length - 1], w, h);
  }

  /* ---- runtime frame placement (2026-08-22, viewport-composition fix) ----
     The baker composes every frame at a fixed 1920x1080 canvas; at runtime
     the browser window is whatever aspect it actually is, and a plain
     centered cover-fit (the old drawFrameTo) crops evenly off both edges of
     whichever axis has slack. That is fine near 16:9 -- not fine at a
     narrow or near-square window, where the slack is big enough to crop
     past the disc itself (the chapter camera already parks it up to +/-10%
     off-centre, on the side opposite the copy panel; a plain centered crop
     has no idea that matters). This is the ONE placement function shared by
     drawFrameTo (the pixels), renderSpot (the lit-socket glow) and
     setDiscVars (the hero copy split) -- they must agree on where the disc
     is, or the glow and the copy drift off the mark the moment a crop
     happens. Anchoring past the point where the image stops covering the
     canvas would show a blank edge, so the offset is clamped back into the
     valid range: keep the disc as close to centred as the crop allows, but
     never reveal one. */
  /* The baked frame size frameFit measures against. Landscape by default
     (the desktop bake); app.js switches it to the portrait bake on phones
     (2026-08-23) so the disc lands where those frames actually drew it. */
  let BAKE = { w: CFG.film.w, h: CFG.film.h };
  const setBakeSize = (w, h) => { BAKE = { w, h }; };
  function frameFit(t, w, h) {
    const iw = BAKE.w, ih = BAKE.h;
    const s = Math.max(w / iw, h / ih);
    const dw = iw * s, dh = ih * s;
    const cam = camAt(t, iw, ih);                  // disc pose as BAKED (fixed 1920x1080), not the live viewport
    const unit = Math.min(iw, ih) * 0.62 * cam.z;  // matches draw()'s own `unit`, at bake resolution
    const discBakeX = cam.x * iw, discBakeY = cam.y * ih, discBakeR = 0.5 * unit;
    /* centre crop by default — the chapter camera parks the disc OFF centre
       on purpose (opposite the copy panel), so centring the disc on the
       viewport (first cut of this, 2026-08-22) slid it 80px back under the
       panel at 1440×900. Shift only as far as it takes to keep the exploded
       set (disc + pieces at their farthest: ~1.9R when fully apart) inside
       the viewport with a 2% margin, and never past the frame's own edge. */
    const apart = Math.max(...Array.from({ length: PIECES }, (_, p) => explodeAt(p, t)));
    const ext = discBakeR * s * (1 + 0.95 * apart);
    let dx = (w - dw) / 2, dy = (h - dh) / 2;
    const mx = w * 0.02, my = h * 0.02;
    /* When the exploded set is WIDER than the viewport (phones: a 390px
       window against a 1500px cover-fit), neither edge can be satisfied.
       The old either/or clamp flipped between fixing the left edge and
       fixing the right one as the pieces spread, which panned the whole
       frame 152px one way at t=.063 and 240px back at t=.077 (scanned
       2026-08-23; it was the one visible jolt in the first step on a
       phone). Centre the disc instead - at the exact point where the set
       just fits, centring and edge-clamping agree, so the hand-off is
       continuous. */
    const l = dx + discBakeX * s - ext, r = dx + discBakeX * s + ext;
    if (2 * ext > w - 2 * mx) dx = w / 2 - discBakeX * s;
    else if (l < mx) dx += mx - l; else if (r > w - mx) dx -= r - (w - mx);
    const tp = dy + discBakeY * s - ext, bt = dy + discBakeY * s + ext;
    if (2 * ext > h - 2 * my) dy = h / 2 - discBakeY * s;
    else if (tp < my) dy += my - tp; else if (bt > h - my) dy -= bt - (h - my);
    dx = Math.min(0, Math.max(w - dw, dx));
    dy = Math.min(0, Math.max(h - dh, dy));
    return { dx, dy, dw, dh, s, discX: dx + discBakeX * s, discY: dy + discBakeY * s, discR: discBakeR * s };
  }

  /* ---- drawing ---- */
  function drawPlate(ctx, w, h, cam, t) {
    const b = smoothstep((t - PLATE_BLEND[0]) / (PLATE_BLEND[1] - PLATE_BLEND[0]));
    const zoom = 1 + (cam.z - 1) * 0.10 * b;         // no parallax at all at t=0
    const px = (cam.x - 0.5) * w * 0.10 * b, py = (cam.y - 0.56) * h * 0.10 * b;
    const r = coverRect(CFG.film.w, CFG.film.h, w, h, zoom, px, py);
    ctx.fillStyle = '#050507'; ctx.fillRect(0, 0, w, h);
    if (filmImg && b < 1) ctx.drawImage(filmImg, r.x, r.y, r.w, r.h);
    if (cleanImg && b > 0) { ctx.globalAlpha = b; ctx.drawImage(cleanImg, r.x, r.y, r.w, r.h); ctx.globalAlpha = 1; }
    return b;
  }

  /* ---- the mark, drawn as a solid part (2026-08-21 Ducati pass) ----
     Before this pass every sector was its own clipped crop with its own
     specular phase, even at rest. Measured on baked frame 0001 against the
     film's last frame: adjacent sectors differed by up to 6.1/255 and the
     clip boundaries carried a -16 luminance seam — the disc read as pre-cut
     before anything moved (the wedge in Keeno's screenshot). Now the
     un-detached part is ONE clip, ONE image, ONE specular; only a piece that
     has actually started to move is drawn on its own, as a slab with a cut
     face and thickness, leaving a machined socket behind. */
  const sectorPath = (ctx, p) => {
    const a1 = A0 + p * STEP, a2 = a1 + STEP;
    ctx.moveTo(0, 0); ctx.arc(0, 0, R, a1, a2); ctx.closePath();
  };
  const discImage = (ctx) => {
    const d = CFG.film.disc, fw = CFG.film.w, fh = CFG.film.h;
    const cx = d.x * fw, cy = d.y * fh, rr = d.r * fh;
    ctx.drawImage(filmImg, cx - rr, cy - rr, rr * 2, rr * 2, -R, -R, R * 2, R * 2);
  };
  /* one light travelling over the metal with the scroll — no per-piece phase */
  const specular = (ctx, t) => {
    const ang = -0.9 + t * 2.4, gx = Math.cos(ang), gy = Math.sin(ang);
    const spec = ctx.createLinearGradient(-gx * R, -gy * R, gx * R, gy * R);
    const c0 = 0.42 + 0.16 * Math.sin(t * 9);
    spec.addColorStop(Math.max(0, c0 - 0.12), 'rgba(255,255,255,0)');
    spec.addColorStop(c0, 'rgba(225,236,255,0.10)');
    spec.addColorStop(Math.min(1, c0 + 0.12), 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = spec; ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.globalCompositeOperation = 'source-over';
  };
  function drawStatic(ctx, statics, t, reflection, b) {
    if (!statics.length) return;
    ctx.save();
    if (reflection) ctx.globalAlpha = 0.22 * b;
    ctx.beginPath();
    if (statics.length === PIECES) ctx.arc(0, 0, R, 0, Math.PI * 2);
    else for (const p of statics) sectorPath(ctx, p);
    ctx.clip();
    discImage(ctx);
    if (!reflection) specular(ctx, t);
    ctx.restore();
  }
  /* the recess a detached piece leaves: dark machined cavity with inner
     walls, so the remaining disc is a solid with a piece removed, not a
     photograph with a wedge erased */
  function drawSocket(ctx, p, e) {
    const k = Math.min(1, e * 2.5);
    const a1 = A0 + p * STEP, a2 = a1 + STEP;
    ctx.save();
    ctx.globalAlpha *= k;
    ctx.beginPath(); sectorPath(ctx, p); ctx.clip();
    const g = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    g.addColorStop(0, '#06080d'); g.addColorStop(0.8, '#0d1220'); g.addColorStop(1, '#1a2336');
    ctx.fillStyle = g; ctx.fillRect(-R, -R, R * 2, R * 2);
    /* what was inside (2026-08-22): the system's photo, graded into the
       mark's own steel-blue, set upright in the bay once the piece is well
       clear (it starts to show at e≈0.15 and is fully there by e≈0.7, so
       the first lift reads as metal leaving metal, not a picture sliding
       in). Sockets ACCUMULATE — by system 06 the disc is a filled-in map of
       all six, then the pieces come home over it at REASSEMBLE and it
       fades with the socket. */
    const ph = photos[p];
    if (ph) {
      const pa = smoothstep((e - 0.15) / 0.55);
      if (pa > 0) {
        /* the lifted piece hovers over the OUTER part of its bay (it moves
           0.6R along the bisector), so the band that stays visible runs
           hub → ~0.6R. The photo's focal point is parked at 0.42R, inside
           that band, not under the piece (t=0.55 probe, 2026-08-22). */
        const d = pieceDir(p);
        const S = R * 1.16, cxp = d.x * R * 0.42, cyp = d.y * R * 0.42;
        ctx.save();
        ctx.globalAlpha *= pa * 0.96;
        ctx.drawImage(ph, cxp - S / 2, cyp - S / 2, S, S);
        /* recess: the bay's walls shade the picture at the hub and along
           the rim so it still reads as sunk into the part */
        const rg = ctx.createRadialGradient(0, 0, R * 0.10, 0, 0, R);
        rg.addColorStop(0, 'rgba(6,8,13,0.60)'); rg.addColorStop(0.36, 'rgba(6,8,13,0.08)');
        rg.addColorStop(0.86, 'rgba(6,8,13,0.08)'); rg.addColorStop(1, 'rgba(6,8,13,0.50)');
        ctx.fillStyle = rg; ctx.fillRect(-R, -R, R * 2, R * 2);
        ctx.restore();
      }
    }
    ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(150,170,205,0.35)';
    for (const a of [a1, a2]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(78,140,232,0.25)'; ctx.lineWidth = 0.02;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.985, a1, a2); ctx.stroke();
    ctx.restore();
  }
  /* a detached piece as a slab: the face is the film crop; under it the same
     sector re-filled in dark metal at a stack of offsets — a short extrusion
     the eye reads as thickness and a cut face, instead of a paper cut-out.
     Offline-only cost (the baker pays it, the runtime draws one image). */
  const THICK = { x: 0.022, y: 0.034 };
  function drawPiece(ctx, p, e, t, reflection, b) {
    const dir = pieceDir(p);
    const sc = 1 + DEPTH * e * DZ[p];
    ctx.save();
    ctx.translate(dir.x * e * SPREAD, dir.y * e * SPREAD);   // dead still: no drift term
    ctx.scale(sc, sc);
    if (reflection) ctx.globalAlpha = 0.22 * (1 - 0.5 * e) * b;
    else if (DZ[p] < 0) ctx.globalAlpha = 1 - 0.30 * e;       // receding pieces dim, no blur
    const k = Math.min(1, e * 3);
    if (!reflection && e > 0.02) {
      const steps = 7;
      for (let i = steps; i >= 1; i--) {
        const f = i / steps;
        ctx.save();
        ctx.translate(THICK.x * f * k, THICK.y * f * k);
        ctx.beginPath(); sectorPath(ctx, p);
        ctx.fillStyle = i === steps ? '#0b0f18' : `rgb(${Math.round(28 + 14 * (1 - f))},${Math.round(34 + 16 * (1 - f))},${Math.round(50 + 22 * (1 - f))})`;
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.save();
    ctx.beginPath(); sectorPath(ctx, p); ctx.clip();
    discImage(ctx);
    if (!reflection) specular(ctx, t);
    ctx.restore();
    if (!reflection && e > 0.02) {
      /* the cut edge catching the key light */
      ctx.strokeStyle = `rgba(200,212,232,${0.5 * k})`; ctx.lineWidth = 0.011;
      ctx.beginPath(); sectorPath(ctx, p); ctx.stroke();
    }
    ctx.restore();
  }

  let refl = null;
  let pieceRenderer = null;            // set by bake3d.js; null = 2D slab pieces
  const setPieceRenderer = (r) => { pieceRenderer = r; };
  function draw(ctx, w, h, t) {
    if (w < 2 || h < 2 || !filmImg) return;
    const cam = camAt(t, w, h);
    const b = drawPlate(ctx, w, h, cam, t);
    const unit = Math.min(w, h) * 0.62 * cam.z;
    const cx = w * cam.x, cy = h * cam.y;
    const es = Array.from({ length: PIECES }, (_, p) => explodeAt(p, t));
    const statics = es.map((e, p) => (e <= 0 ? p : -1)).filter((p) => p >= 0);
    const moving = Array.from({ length: PIECES }, (_, p) => p).filter((p) => es[p] > 0).sort((a, c) => DZ[a] * es[a] - DZ[c] * es[c]);

    /* reflection (fades in as the clean plate removes the film's own).
       In the portrait bake the chapters lift the disc off the plinth, and a
       reflection under a floating object reads as a ghost - fade it with
       the lift (identity for the landscape bake, which never lifts). */
    const lift = w < h ? Math.max(0, heroCamFor(w, h).y - cam.y) : 0;
    const rb = b * Math.max(0, 1 - lift / 0.08);
    if (rb > 0) {
      const b = rb;
      const RS = 0.5;
      if (!refl) refl = document.createElement('canvas');
      refl.width = Math.max(1, Math.round(w * RS)); refl.height = Math.max(1, Math.round(h * RS));
      const rx = refl.getContext('2d');
      rx.setTransform(1, 0, 0, 1, 0, 0); rx.clearRect(0, 0, refl.width, refl.height);
      rx.scale(RS, RS); rx.translate(cx, cy); rx.scale(unit, unit);
      const floorY = R * 1.06;
      rx.translate(0, floorY * 2); rx.scale(1, -1);
      drawStatic(rx, statics, t, true, b);
      for (const p of moving) { rx.save(); drawPiece(rx, p, es[p], t, true, b); rx.restore(); }
      rx.setTransform(1, 0, 0, 1, 0, 0); rx.scale(RS, RS); rx.translate(cx, cy); rx.scale(unit, unit);
      rx.globalCompositeOperation = 'destination-out';
      const fg = rx.createLinearGradient(0, floorY, 0, floorY + R * 1.2);
      fg.addColorStop(0, 'rgba(0,0,0,0.35)'); fg.addColorStop(1, 'rgba(0,0,0,1)');
      rx.fillStyle = fg; rx.fillRect(-4, floorY - 0.01, 8, R * 1.3);
      rx.globalCompositeOperation = 'source-over';
      ctx.drawImage(refl, 0, 0, w, h);
    }

    ctx.save();
    ctx.translate(cx, cy); ctx.scale(unit, unit);
    const apart = Math.max(...es);
    const floorY = R * 1.06;
    const sh = ctx.createRadialGradient(0, floorY, 0, 0, floorY, R * (1.1 + apart * 0.5));
    sh.addColorStop(0, `rgba(0,0,0,${0.5 * b})`); sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh; ctx.save(); ctx.scale(1, 0.18);
    ctx.beginPath(); ctx.arc(0, floorY / 0.18, R * (1.2 + apart * 0.5), 0, Math.PI * 2); ctx.fill(); ctx.restore();

    drawStatic(ctx, statics, t, false, b);
    for (const p of moving) { ctx.save(); drawSocket(ctx, p, es[p]); ctx.restore(); }
    if (pieceRenderer && moving.length) {
      /* real 3D pieces (scene3d.js) — rendered in the same pixel frame as the
         flat disc (same centre, same radius), composited over the sockets.
         The 2D slab path below stays as the fallback when no renderer is set
         (bake.html) so the bake can never silently lose the pieces. */
      ctx.restore();
      const layer = pieceRenderer.render({ es, cx, cy, unit, w, h, DZ, SPREAD });
      ctx.drawImage(layer, 0, 0, w, h);
      ctx.save(); ctx.translate(cx, cy); ctx.scale(unit, unit);
    } else {
      for (const p of moving) { ctx.save(); drawPiece(ctx, p, es[p], t, false, b); ctx.restore(); }
    }

    if (t > GLOW[0]) {
      const g = (t - GLOW[0]) / (GLOW[1] - GLOW[0]);
      const sweep = smoothstep(Math.min(1, g * 1.4)) * Math.PI * 2;
      ctx.save();
      ctx.strokeStyle = 'rgba(78,140,232,' + (0.9 * (1 - g * 0.35)) + ')'; ctx.lineWidth = 0.03;
      ctx.shadowColor = '#4e8ce8'; ctx.shadowBlur = unit * 0.05;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.08, A0, A0 + sweep); ctx.stroke(); ctx.restore();
      if (g > 0.55) {
        const f = smoothstep((g - 0.55) / 0.2) * (1 - smoothstep((g - 0.8) / 0.2));
        const fl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 2.2);
        fl.addColorStop(0, 'rgba(142,182,236,' + 0.38 * f + ')'); fl.addColorStop(1, 'rgba(142,182,236,0)');
        ctx.fillStyle = fl; ctx.beginPath(); ctx.arc(0, 0, R * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();

    /* a light vignette that is ZERO at t=0 so frame 0 stays the film */
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.45 * b})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
  }

  const loadImage = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  /* blue-steel duotone: luminance → shadow / steel / highlight ramp, on a
     square cover-crop anchored at the photo's focal point. Pre-graded once
     at load (bake-time only; the runtime never calls loadAssets). */
  const DUO = { lo: [7, 10, 18], mid: [34, 78, 148], hi: [214, 228, 250] };
  function gradePhoto(img, focus, size) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d', { willReadFrequently: true });
    const iw = img.naturalWidth, ih = img.naturalHeight, s = size / Math.min(iw, ih);
    const dw = iw * s, dh = ih * s;
    const ox = Math.min(0, Math.max(size - dw, size / 2 - focus[0] * dw));
    const oy = Math.min(0, Math.max(size - dh, size / 2 - focus[1] * dh));
    x.drawImage(img, ox, oy, dw, dh);
    const id = x.getImageData(0, 0, size, size), px = id.data;
    const { lo, mid, hi } = DUO;
    for (let i = 0; i < px.length; i += 4) {
      let L = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      L = Math.min(1, Math.max(0, (L - 0.5) * 1.18 + 0.5));          // a touch of contrast
      if (L < 0.5) { const u = L / 0.5; px[i] = lo[0] + (mid[0] - lo[0]) * u; px[i + 1] = lo[1] + (mid[1] - lo[1]) * u; px[i + 2] = lo[2] + (mid[2] - lo[2]) * u; }
      else { const u = (L - 0.5) / 0.5; px[i] = mid[0] + (hi[0] - mid[0]) * u; px[i + 1] = mid[1] + (hi[1] - mid[1]) * u; px[i + 2] = mid[2] + (hi[2] - mid[2]) * u; }
    }
    x.putImageData(id, 0, 0);
    return c;
  }
  const photos = [];
  async function loadAssets(onProgress) {
    filmImg = await loadImage(CFG.film.frame); onProgress && onProgress(0.3);
    cleanImg = await loadImage(CFG.film.clean); onProgress && onProgress(0.5);
    const raw = await Promise.all(CFG.photos.map(loadImage));
    raw.forEach((img, p) => { photos[p] = img ? gradePhoto(img, CFG.photoFocus[p], 720) : null; });
    onProgress && onProgress(1);
    if (raw.some((i) => !i)) console.warn('SCENE: missing socket photo(s)', CFG.photos.filter((_, p) => !raw[p]));
    return !!(filmImg && cleanImg);
  }

  return { CFG, draw, loadAssets, camAt, frameFit, explodeAt, HERO, SYS_W, REASSEMBLE, GLOW, sysStart, PIECES, PANEL_LEFT, setPieceRenderer, setBakeSize };
})();
