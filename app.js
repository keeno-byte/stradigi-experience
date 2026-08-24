/* STRADIGI // THE EXPERIENCE — runtime (baked-frame build, 2026-08-21).
   Locked by Keeno's 20-question round: the scroll is a pre-rendered frame
   sequence (assets/frames/NNNN.webp, baked by bake.html from scene.js);
   the runtime draws ONE frame per tick — the reference's exact pipeline.
   Frame 0 is the reveal film's last frame, so the cloth-pull dissolves
   onto identical pixels. Lenis smooths the wheel; ScrollTrigger scrubs
   with the reference's 1s glide. */

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
ScrollTrigger.defaults({ fastScrollEnd: true });
ScrollTrigger.config({ syncInterval: 100, autoRefreshEvents: 'visibilitychange,DOMContentLoaded,load,resize' });

const CONFIG = {
  FRAMES: { dir: 'assets/frames/', count: 600, pad: 4, ext: 'webp' },
  BATCH_SIZE: 20,
  CHAPTERS: 7,
  /* 200, was 300 (the reference's number). Keeno on his trackpad after
     Lenis came out: "still too many swipes, drop it to 200%". 7 chapters x
     200% = 14 screens pinned; 300 frames over that is ~38px of scroll per
     frame at 820vh, still well under one wheel tick. */
  SCROLL_PER_CHAPTER: 200,
  TIMELINE_DURATION: 27,
  ASSETS: { intro: 'assets/intro-loop.mp4', reveal: 'assets/reveal.mp4' },
  /* 1920, not 2560 (2026-08-21, brain-window Ducati A/B). The reference
     draws into a FIXED 1920x1080 backing store regardless of DPR (measured
     live in Chrome: canvas.width 1920 on a 2x display). Our frames are
     baked from a 1920x1080 film frame, so anything above 1920 is upscaled
     source pixels at 2.25x the fill cost. Measured on the same machine,
     same 5s scripted scroll: 2560 cap -> 75/275 frames over 33ms;
     1920 cap + nearest-frame draw below -> 2/348 (Ducati: 4/345). */
  MAX_CANVAS_W: 1920,
};
const HERO = SCENE.HERO, SYS_W = SCENE.SYS_W, REASSEMBLE = SCENE.REASSEMBLE, GLOW = SCENE.GLOW, sysStart = SCENE.sysStart;

document.documentElement.classList.add('gated');

/* ================= scroll: native, like the reference ================= */
/* Lenis removed (2026-08-21, Keeno on his own trackpad: "takes too many
   swipes to get it to move at all... notice the touchpad behavior on the
   Ducati website and make ours like theirs"). The reference runs NO
   smooth-scroll library: a trackpad flick keeps its native momentum, and
   the only smoothing is ScrollTrigger's scrub:1 glide — which is still
   here. Lenis (lerp + wheelMultiplier 0.9) was eating the flick: it
   re-eased every wheel event through its own lerp and scaled it down, so a
   swipe that moves a native page a screen moved this one a fraction. The
   gate is CSS (html.gated { overflow:hidden }) and needs no scroller. */
gsap.ticker.lagSmoothing(0);

/* ================= frames ================= */
/* Phones get the portrait bake (assets/frames-m, 1080x1920, 2026-08-23):
   same scene, a camera that keeps the disc on its plinth in a tall frame
   instead of cover-cropping the landscape film down to a third. Chosen at
   load from the viewport; SCENE.frameFit is told the baked size so the
   disc lands exactly where those frames drew it. */
const PORTRAIT = innerWidth < innerHeight && innerWidth < 900;
if (PORTRAIT) {
  CONFIG.FRAMES.dir = 'assets/frames-m/';
  if (SCENE.setBakeSize) SCENE.setBakeSize(1080, 1920);
}
const frames = new Array(CONFIG.FRAMES.count);
/* Half-resolution twin of every frame (assets/frames-lo, 960x540, ~1/4 the
   decode cost). Traced 2026-08-23: a step decodes ~88 webps at ~9ms each
   and the canvas decode cache cannot hold 600 full-size frames, so at the
   tween's peak (two new frames per display frame, blended) decode alone
   overran the 16ms budget -- one dropped frame per step, every step. The
   moving phase now draws the lo set; the resting frame is drawn full-res
   once the scroll settles. */
const framesLo = new Array(CONFIG.FRAMES.count);
const frameUrl = (i) => CONFIG.FRAMES.dir + String(i + 1).padStart(CONFIG.FRAMES.pad, '0') + '.' + CONFIG.FRAMES.ext;
const frameLoUrl = (i) => (PORTRAIT ? 'assets/frames-m-lo/' : 'assets/frames-lo/') + String(i + 1).padStart(CONFIG.FRAMES.pad, '0') + '.' + CONFIG.FRAMES.ext;

const progressValue = document.getElementById('progress-value');
const progressFill = document.getElementById('progress-fill');
const scrambleLabel = document.getElementById('scramble-label');
const startBtn = document.getElementById('start-btn');
const SCRAMBLE_TARGET = 'Assembling the machine';
const GLYPHS = '#$%&*@!?<>[]{}()abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ0123456789';
function scrambleAt(p) {
  const reveal = Math.floor(SCRAMBLE_TARGET.length * p); let out = '';
  for (let i = 0; i < SCRAMBLE_TARGET.length; i++) out += i < reveal ? SCRAMBLE_TARGET[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
  return '[' + out + ']';
}
function setProgress(p) {
  progressValue.textContent = Math.round(p * 100) + '%';
  progressFill.style.width = (p * 100) + '%';
  scrambleLabel.textContent = scrambleAt(p);
}
async function preloadFrames() {
  /* Lo-first (2026-08-23): START enables on the 11MB half-res set plus the
     two full-res frames the intro actually shows at rest (first + last);
     the other 598 full-res frames stream in behind the film and the
     first steps. renderFrame falls back to the lo frame for any hi frame
     that has not arrived, and redraws hi as soon as it has. Judges on a
     slow connection used to wait for 46MB. */
  let done = 0;
  const total = CONFIG.FRAMES.count + 2;
  const load = (store, url, j, count) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => { store[j] = img; if (count) { done++; setProgress(done / total); } resolve(); };
    img.src = url(j);
  });
  const hiFirst = [load(frames, frameUrl, 0, true), load(frames, frameUrl, CONFIG.FRAMES.count - 1, true)];
  for (let i = 0; i < CONFIG.FRAMES.count; i += CONFIG.BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < Math.min(i + CONFIG.BATCH_SIZE, CONFIG.FRAMES.count); j++) batch.push(load(framesLo, frameLoUrl, j, true));
    await Promise.all(batch);
  }
  await Promise.all(hiFirst);
  // background: the rest of the full-res set, small batches, never
  // blocking START
  (async () => {
    for (let i = 0; i < CONFIG.FRAMES.count; i += 6) {
      const batch = [];
      for (let j = i; j < Math.min(i + 6, CONFIG.FRAMES.count); j++) if (!frames[j]) batch.push(load(frames, frameUrl, j, false));
      await Promise.all(batch);
      // a settled frame that was drawn lo gets its hi now
      if (frameState.settled) renderFrame();
    }
  })();
  scrambleLabel.textContent = '[' + SCRAMBLE_TARGET + ']';
  startBtn.disabled = false;
  if (autoSkip) { autoSkip = false; requestAnimationFrame(() => reveal(true)); }
  /* Build the scrolly now, under the static loader, not on the START
     click: initScrolly measured 83-100ms (2026-08-23, with the 1200-image
     preload in memory) and it used to land on the first frame of the
     title fade. The intro covers the page, so nothing is visible, and the
     lab modules keyed to the pin-spacer get their build time here too. */
  requestAnimationFrame(() => { try { initScrolly(); } catch (e) {} });
}

/* ================= intro: loop + reveal film over a procedural fallback ================= */
const ambient = document.getElementById('ambient-canvas');
const ambientVideo = document.getElementById('ambient-video');
const revealVideo = document.getElementById('reveal-video');
const actx = ambient.getContext('2d', { alpha: false });
let ambientRunning = true;
function drawAmbient(time) {
  if (!ambientRunning) return;
  const w = ambient.width = ambient.clientWidth, h = ambient.height = ambient.clientHeight;
  actx.fillStyle = '#060608'; actx.fillRect(0, 0, w, h);
  const unit = Math.min(w, h) * 0.34, cx = w / 2, cy = h * 0.58;
  const spot = actx.createRadialGradient(cx, cy - unit * 0.2, unit * 0.05, cx, cy - unit * 0.2, unit * 2.1);
  spot.addColorStop(0, 'rgba(50,68,104,0.8)'); spot.addColorStop(0.6, 'rgba(18,24,40,0.5)'); spot.addColorStop(1, 'rgba(6,6,8,0)');
  actx.fillStyle = spot; actx.fillRect(0, 0, w, h);
  actx.save(); actx.translate(cx, cy); actx.scale(unit, unit);
  const sway = Math.sin(time / 2300) * 0.012;
  actx.fillStyle = '#10121a'; actx.beginPath(); actx.moveTo(-1.02, 0.62);
  actx.bezierCurveTo(-1.08, -0.1 + sway, -0.75, -0.85, -0.15, -0.92 + sway);
  actx.bezierCurveTo(0.4, -0.97, 0.85, -0.6 - sway, 1.0, -0.1);
  actx.bezierCurveTo(1.08, 0.25, 1.02, 0.5, 0.95, 0.62); actx.closePath(); actx.fill();
  actx.fillStyle = 'rgba(0,0,0,0.6)'; actx.beginPath(); actx.ellipse(0, 0.66, 1.06, 0.09, 0, 0, Math.PI * 2); actx.fill();
  actx.restore();
  requestAnimationFrame(drawAmbient);
}
requestAnimationFrame(drawAmbient);

if (ambientVideo) {
  ambientVideo.addEventListener('canplaythrough', () => { ambientVideo.hidden = false; ambientVideo.play().catch(() => { ambientVideo.hidden = true; }); }, { once: true });
  ambientVideo.addEventListener('error', () => { ambientVideo.hidden = true; });
  ambientVideo.src = CONFIG.ASSETS.intro;
}
let revealReady = false;
if (revealVideo) {
  revealVideo.addEventListener('canplaythrough', () => { revealReady = true; }, { once: true });
  revealVideo.addEventListener('error', () => { revealReady = false; });
  revealVideo.src = CONFIG.ASSETS.reveal;
}

/* ================= sound ================= */
let audio = null;
/* The AudioContext is opened while the frames preload, not on the START
   click: opening the output device is the one slow, synchronous step
   (profiled 2026-08-23: 233ms self-time warm, up to ~1.1s on a cold
   browser) and it used to freeze the title fade at the exact moment the
   film began. Created here it starts suspended - no sound - and resume()
   on the click is cheap. */
let audioCtxEarly = null;
try { const AC0 = window.AudioContext || window.webkitAudioContext; if (AC0) audioCtxEarly = new AC0(); } catch (e) {}
function startAudio() {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  const ctx = audioCtxEarly || new AC(); audioCtxEarly = null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const gain = ctx.createGain(); gain.gain.value = 0.035;
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 170;
  [58, 58.8].forEach((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(filter); o.start(); });
  filter.connect(gain); gain.connect(ctx.destination); audio = { ctx, gain };
}
document.getElementById('mute-btn').addEventListener('click', (e) => {
  if (!audio) return;
  const muted = e.currentTarget.getAttribute('aria-pressed') === 'true';
  e.currentTarget.setAttribute('aria-pressed', String(!muted));
  audio.gain.gain.value = muted ? 0.035 : 0;
});

/* ================= reveal -> handoff ================= */
const heroReveal = document.getElementById('hero-reveal');
const progressSection = document.getElementById('progress-section');
const topActions = document.getElementById('top-actions');
let revealed = false;
let stepLock = 0;   // gestures are ignored until this timestamp (see goToStop / onWheel)
let requestSkip = null;   // set while the reveal film plays: cuts straight to the dissolve
let autoSkip = false;     // skip pressed before the preload finished

let skipToContent = false;  // the big skip wants the page, not the film's first stop
function finishReveal() {
  ambientRunning = false;
  if (ambientVideo) ambientVideo.pause();
  if (revealVideo) revealVideo.pause();
  heroReveal.style.display = 'none';
  document.documentElement.classList.remove('gated');
  /* start perfect (Keeno): the handoff lands exactly on stop 0 — the
     assembled mark, frame 0 — and any trackpad momentum still in flight
     from before the gate opened is swallowed for a beat, so the first
     piece never starts to lift before anyone meant it to */
  window.scrollTo(0, 0);
  stepLock = performance.now() + 1200;
  ScrollTrigger.refresh();
  if (skipToContent) {
    /* The skip means "get me to the page" (Keeno, 2026-08-23: pressing it
       used to land on the film's first stop, which looks like the intro -
       "it's there, and it doesn't work"). Land just past the pin, on Who
       we help, instantly - no travel through the film. */
    skipToContent = false;
    const serve = document.getElementById('serve');
    if (serve) window.scrollTo(0, serve.getBoundingClientRect().top + window.scrollY - 76);
    stepLock = performance.now() + 800;
  }
}
function riseHeroCopy() {
  /* Three beats, not one pop: headline, lede, then the three badges in
     sequence (measured 2026-08-23: the badges used to land in the same
     frame as the headline, the one visible "pop" left in the handoff). */
  gsap.set(['.slide--hero .hero-top h1', '.slide--hero .slide__lede', '.slide--hero .badge'], { autoAlpha: 0, y: 14 });
  gsap.timeline()
    .to('.slide--hero', { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0)
    .to('.slide--hero .hero-top h1', { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out' }, 0)
    .to('.slide--hero .slide__lede', { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.18)
    .to('.slide--hero .badge', { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.09 }, 0.38);
}
function reveal(skip) {
  if (revealed) return;
  revealed = true;
  startAudio();
  topActions.hidden = false;
  progressSection.classList.add('hero-reveal__progress--finished');
  initScrolly();                                   // frame 0 is painted underneath now
  gsap.set('.slide--hero', { autoAlpha: 0, y: 16 });
  gsap.to('.hero-reveal__titles', { y: -40, autoAlpha: 0, duration: skip ? 0.2 : 0.7, ease: 'power2.in' });
  /* the loader hook leaves with the titles (Keeno: "fade when START is
     pressed") — the film plays clean; the hero copy takes over after it */
  gsap.to('.hero-reveal__aside', { autoAlpha: 0, duration: skip ? 0.2 : 0.55, ease: 'power2.in' });
  gsap.to('#start-btn', { autoAlpha: 0, duration: 0.3 });

  if (!skip && revealReady && revealVideo) {
    revealVideo.hidden = false;
    if (revealVideo.currentTime > 0.05) revealVideo.currentTime = 0;
    if (ambientVideo) ambientVideo.hidden = true;
    const playing = revealVideo.play().catch(() => new Promise((res, rej) => setTimeout(() => revealVideo.play().then(res, rej), 120)));
    let done = false;
    const dissolve = () => {
      if (done) return; done = true;
      requestSkip = null;
      /* film's last frame === frame 0 underneath: this is a cross between
         two identical images, so it only exists to hide codec noise */
      gsap.timeline({ onComplete: finishReveal })
        .to(heroReveal, { autoAlpha: 0, duration: 0.6, ease: 'power1.inOut' })
        .add(riseHeroCopy, '-=0.1');
    };
    requestSkip = dissolve;
    revealVideo.addEventListener('ended', dissolve, { once: true });
    revealVideo.addEventListener('timeupdate', () => {
      // Keeno 2026-08-21: post-tarp hold ~3s felt long -> ~1.8s. Cloth is
      // clear by ~2.0s; dissolve at 3.3s (tunable) trims the dead hold.
      const cut = Math.min(3.3, (revealVideo.duration || 5) - 0.3);
      if (revealVideo.currentTime > cut) dissolve();
    });
    if (playing && playing.catch) playing.catch(() => { revealVideo.hidden = true; liftFallback(false); });
    return;
  }
  liftFallback(skip);
}
function liftFallback(skip) {
  const covers = [ambient, ambientVideo].filter(Boolean);
  gsap.timeline({ onComplete: finishReveal })
    .to(covers, { y: '-46%', autoAlpha: 0, duration: skip ? 0.3 : 1.6, ease: 'power3.inOut' }, skip ? 0 : 0.25)
    .to(heroReveal, { backgroundColor: 'rgba(6,6,8,0)', duration: 0.4 }, '>-0.3')
    .add(riseHeroCopy, '-=0.2');
}
startBtn.addEventListener('click', () => reveal(false));

/* ---- the skip button + impatient swipes (2026-08-23) ----
   One control, three states: before the preload is done it queues the
   skip ("Loading the page" - honest, the frames are the page); during
   the loader it skips the whole intro; during the film it cuts straight
   to the dissolve. And a user who swipes hard during the film clearly
   wants the page - after ~a flick and a half of accumulated wheel or two
   touch swipes, the film takes the hint and dissolves itself. While
   gated, wheel/touchmove are also preventDefault-ed so trackpad momentum
   never rubber-bands into the first chapter when the gate opens. */
const skipBtn = document.getElementById('skip-btn');
function doSkip() {
  skipToContent = true;
  if (startBtn.disabled) {
    autoSkip = true;
    skipBtn.classList.add('is-waiting');
    skipBtn.querySelector('.intro-skip__label').textContent = 'Loading the page';
    return;
  }
  if (!revealed) { reveal(true); return; }
  if (requestSkip) { requestSkip(); return; }
  // film fallback path (no requestSkip): the lift is already running;
  // finishReveal will honour skipToContent when it lands.
}
skipBtn.addEventListener('click', doSkip);

let preSwipe = 0, lastNudge = 0;
function impatient(amount) {
  if (!document.documentElement.classList.contains('gated')) return;
  if (revealed) {
    preSwipe += amount;
    if (preSwipe > 260 && requestSkip) requestSkip();
  } else if (!startBtn.disabled) {
    // loader, ready to go: a swipe means "come on" - nudge the two exits
    const now = performance.now();
    if (now - lastNudge > 900) {
      lastNudge = now;
      gsap.fromTo([startBtn, skipBtn], { scale: 1 }, { scale: 1.06, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: 'auto' });
    }
  }
}
addEventListener('wheel', (e) => {
  if (!document.documentElement.classList.contains('gated')) return;
  e.preventDefault();
  impatient(Math.abs(e.deltaY));
}, { passive: false });
let gTouchY = null;
addEventListener('touchstart', (e) => { gTouchY = e.touches[0].clientY; }, { passive: true });
addEventListener('touchmove', (e) => {
  if (!document.documentElement.classList.contains('gated') || gTouchY == null) return;
  e.preventDefault();
  impatient(Math.abs(e.touches[0].clientY - gTouchY) * 0.9);
  gTouchY = e.touches[0].clientY;
}, { passive: false });

/* ================= the pinned scrollytelling — one drawImage per tick ================= */
const seqCanvas = document.getElementById('seq-canvas');
const sctx = seqCanvas.getContext('2d', { alpha: false });
const firstFrame = document.getElementById('first-frame');
const lastFrame = document.getElementById('last-frame');
const frameState = { index: 0, settled: true };

function drawFrameTo(ctx, img, w, h, t) {
  if (!img || !img.naturalWidth) return;
  /* disc-anchored cover-fit, not a plain centered one (2026-08-22): every
     frame is baked at a fixed 1920x1080, so at any other canvas aspect a
     centered crop just cuts the same amount off both edges of the
     overhanging axis regardless of where the disc actually sits — fine
     near 16:9, but a narrow or near-square window can crop right past it.
     SCENE.frameFit shares this placement with renderSpot/setDiscVars so
     the glow and the hero copy never drift off what's actually drawn. */
  const fit = SCENE.frameFit(t, w, h);
  ctx.drawImage(img, fit.dx, fit.dy, fit.dw, fit.dh);
}
function renderFrame() {
  const cw = seqCanvas.clientWidth || innerWidth, ch = seqCanvas.clientHeight || innerHeight;
  const k = Math.min(1, CONFIG.MAX_CANVAS_W / Math.max(1, cw * devicePixelRatio));
  const w = Math.round(cw * devicePixelRatio * k), h = Math.round(ch * devicePixelRatio * k);
  if (seqCanvas.width !== w) seqCanvas.width = w;
  if (seqCanvas.height !== h) seqCanvas.height = h;
  /* round(), not crossfade (2026-08-21, brain-window Ducati A/B). The
     earlier crossfade drew TWO full-frame images per tick to hide frame
     stepping at slow scroll; measured, that doubled the draw to 19.6ms per
     tick at retina and was the single biggest source of dropped frames
     (75 of 275 over 33ms). The reference rounds (frames[round(index)]) and
     relies on scrub:1 + 300%/chapter of scroll to keep neighbouring frames
     close -- at 300 frames over 21 screens that is ~52px of scroll per
     frame, well under one wheel tick, so stepping is not visible. One
     drawImage: 7.1ms per tick, 2 of 348 frames over 33ms. */
  /* 2026-08-23 revisit, measured on the capped canvas with the draw timed
     inside a rAF: a second drawImage costs +0ms at 1920x1200 (GPU-bound,
     the readback dominated the 2021 number) and +4ms at 1170x2532. At the
     step tween's peak the frame index advances 1.4-2 frames per display
     frame, and rounding made the motion alternate 1-frame and 2-frame
     jumps (traced: rms 31/68/43/64 on consecutive frames). Blending the
     two neighbours at the fractional index gives one uniform step per
     display frame. 600 frames (re-baked the same day) keep the neighbours
     close enough that the blend never reads as a double image. */
  const N = CONFIG.FRAMES.count;
  const f = Math.max(0, Math.min(N - 1, frameState.index));
  const i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1), frac = f - i0;
  const idx = frac < 0.5 ? i0 : i1;
  const t = idx / (N - 1);   // the exact progress THIS frame was baked at -- renderSpot must use the same one
  /* moving -> half-res set (cheap decode, blended); at rest -> one full-res
     draw of the nearest frame. frameState.settled is flipped by a short
     timer after the last index change (see below). */
  const set = frameState.settled ? (frames[idx] ? frames : framesLo) : (framesLo[i0] && framesLo[i1] ? framesLo : frames);
  if (!frameState.settled && frac > 0.02 && frac < 0.98 && set[i0] && set[i1]) {
    drawFrameTo(sctx, set[i0], w, h, i0 / (N - 1));
    sctx.globalAlpha = frac;
    drawFrameTo(sctx, set[i1], w, h, i1 / (N - 1));
    sctx.globalAlpha = 1;
  } else {
    drawFrameTo(sctx, set[idx] || frames[idx] || framesLo[idx], w, h, t);
  }
  renderSpot(t);
}
/* Settle detection: every index change marks the film as moving and
   re-arms a 140ms timer; when it fires the resting frame is redrawn from
   the full-resolution set. 140ms is under the snap's own delay, so the
   sharp frame lands right as the step finishes. */
let settleTimer = 0;
function onFrameIndexChange() {
  frameState.settled = false;
  renderFrame();
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => { frameState.settled = true; renderFrame(); }, 140);
}

/* ---- the lit socket (2026-08-21) ----
   While a system's copy is on screen, the bay its piece came out of glows
   in the brand blue — the copy you are reading is tied to the part that
   left. One half-resolution radial gradient per tick on its own canvas
   (mix-blend-mode: screen in CSS), computed from the same camera the bake
   used, so it sits exactly on the socket at every viewport. Cheap enough
   to never show up in the frame budget. */
const spot = document.getElementById('spot-canvas');
const spx = spot ? spot.getContext('2d') : null;
function renderSpot(t) {
  if (!spx) return;
  const w = spot.clientWidth || innerWidth, h = spot.clientHeight || innerHeight, k = 0.5;
  const W = Math.round(w * k), H = Math.round(h * k);
  if (spot.width !== W) spot.width = W;
  if (spot.height !== H) spot.height = H;
  spx.clearRect(0, 0, W, H);
  let p = -1, a = 0;
  for (let i = 0; i < SCENE.PIECES; i++) {
    const s = sysStart(i) - SYS_W * 0.04;                                   // copy rises
    const e1 = (i < SCENE.PIECES - 1 ? sysStart(i) + SYS_W * 0.90 : REASSEMBLE[0]) + SYS_W * 0.10;  // copy gone
    if (t >= s && t <= e1) {
      a = Math.min(1, (t - s) / (SYS_W * 0.14)) * Math.min(1, (e1 - t) / (SYS_W * 0.10));
      p = i; break;
    }
  }
  if (p < 0 || a <= 0.01) return;
  /* same placement drawFrameTo used for this frame (SCENE.frameFit) -- the
     old cam = SCENE.camAt(t, w, h) + w*cam.x math assumed a 1:1, uncropped
     draw of the film at exactly (w, h); once drawFrameTo crops and pans to
     keep the disc in view, that assumption no longer matches what's on
     screen and the glow drifts off the mark. */
  const fit = SCENE.frameFit(t, w, h);
  const mid = -Math.PI / 2 + (p + 0.5) * (Math.PI / 3);
  const cx = (fit.discX + Math.cos(mid) * fit.discR * 0.55) * k, cy = (fit.discY + Math.sin(mid) * fit.discR * 0.55) * k;
  const rad = fit.discR * 0.62 * k;
  const g = spx.createRadialGradient(cx, cy, 0, cx, cy, rad);
  g.addColorStop(0, `rgba(78,140,232,${0.40 * a})`);
  g.addColorStop(0.55, `rgba(78,140,232,${0.13 * a})`);
  g.addColorStop(1, 'rgba(78,140,232,0)');
  spx.fillStyle = g; spx.beginPath(); spx.arc(cx, cy, rad, 0, Math.PI * 2); spx.fill();
}
function paintPlaceholders() {
  [[firstFrame, 0], [lastFrame, CONFIG.FRAMES.count - 1]].forEach(([el, i]) => {
    const img = frames[i]; if (!img) return;
    el.style.background = `url(${frameUrl(i)}) center/cover`;
  });
}

/* Where the mark actually is on screen at t=0, handed to CSS so the hero
   copy can sit ABOVE it and the badges BELOW it (2026-08-21 Ducati pass —
   measured before: h1 overlapped the disc by 33px, lede 50px, badges 54px).
   The disc position is a function of the viewport (it must match the film's
   last frame under cover-fit), so this is computed, not guessed in CSS. */
function setDiscVars() {
  const w = innerWidth, h = innerHeight;
  // SCENE.frameFit — same disc placement drawFrameTo/renderSpot use, so the
  // hero copy split always agrees with where frame 0 is actually drawn
  // (see the frameFit comment in scene.js for why a plain cam.y*h isn't it).
  const fit = SCENE.frameFit(0, w, h);
  const st = document.documentElement.style;
  st.setProperty('--disc-top', Math.round(fit.discY - fit.discR) + 'px');
  st.setProperty('--disc-bottom', Math.round(fit.discY + fit.discR) + 'px');
  syncScrollDownFit();
}
/* the scroll-down cue is a fixed `bottom: 26px`; the badges row sits at
   disc-bottom + 18px, which is fine at most sizes but at a short viewport
   (measured: 760x500 and 1024x560, NOT a clean height threshold -- 900x600
   and 1280x640 don't collide despite being in between, because it depends
   on disc size too) the two overlap -- "mentor who built them" over "scroll
   down". Measuring the real rects beats guessing a breakpoint. */
function syncScrollDownFit() {
  const sd = document.getElementById('scroll-down');
  const badges = document.querySelector('.badges');
  if (!sd || !badges) return;
  // un-hide before measuring: a display:none element collapses to a zero
  // rect, which trivially never "overlaps" -- measuring a run's own hidden
  // result is what silently un-hid it again on the very next call (found
  // by instrumenting this exact function, not by inspection)
  sd.classList.remove('scroll-down--clipped');
  const b = badges.getBoundingClientRect(), s = sd.getBoundingClientRect();
  const overlaps = !(b.right <= s.left || b.left >= s.right || b.bottom <= s.top || b.top >= s.bottom);
  sd.classList.toggle('scroll-down--clipped', overlaps);
}
setDiscVars();

let scrollyBuilt = false;
function initScrolly() {
  if (scrollyBuilt) return;
  scrollyBuilt = true;
  setDiscVars();
  paintPlaceholders();
  renderFrame();

  const n = CONFIG.SCROLL_PER_CHAPTER * CONFIG.CHAPTERS, D = CONFIG.TIMELINE_DURATION;

  /* ---- chapter stops (2026-08-21, Keeno: "make it overly smooth and
     cohesive, do something new") ----
     The scroll has eight STOPS: the hero, one per system (where its piece is
     fully out and its copy fully up), and the reassembled mark. After a
     gesture ends, ScrollTrigger snaps to the nearest stop in the direction
     of travel and the scrub glide carries it there — so a swipe lands ON a
     system instead of somewhere between two. The rail on the right shows
     the stops, marks the active one, and jumps on click; arrow/page keys
     step between them. The reference doesn't do this; it is the one thing
     here that is ours. */
  const STOPS = [{ label: 'Start', p: 0 }];
  // The headings break with <br> and no whitespace, so textContent reads
  // "BusinessEngine™" — and innerText is empty on a hidden slide. Walk the
  // nodes and treat <br> as a space.
  const headingText = (h) => Array.from(h.childNodes).map((n) => (n.nodeName === 'BR' ? ' ' : n.textContent)).join('').replace(/\s+/g, ' ').trim();
  document.querySelectorAll('.slide--system h2').forEach((h, i) => STOPS.push({ label: headingText(h), p: sysStart(i) + SYS_W * 0.46 }));
  STOPS.push({ label: 'Stradigi', p: 1 });

  const tl = gsap.timeline({
    scrollTrigger: {
      /* scrub 0.35, was 1 (the reference's). Movement between stops is now a
         single scrollTo tween with its own ease (see stepTo below), so a 1s
         scrub on top of it just added a second of lag after the tween had
         already landed. 0.35 keeps the frames silky without the tail. */
      trigger: '#scrolly', start: 'top top', end: `+=${n}%`, scrub: 0.35, pin: true, invalidateOnRefresh: true,
      /* inertia:false — snap from where the scroll actually stopped, to the
         next stop in the direction of travel. With inertia on, ScrollTrigger
         extrapolates the flick's velocity and picks the stop it *would* reach,
         which on a hard trackpad flick is several chapters away (measured: a
         drop at p=0.215 settled at p=1.0). One gesture, one system. */
      snap: { snapTo: STOPS.map((s) => s.p), duration: { min: 0.45, max: 1.2 }, delay: 0.06, ease: 'power2.inOut', directional: true, inertia: false },
      onUpdate(self) {
        gsap.set(firstFrame, { opacity: self.progress >= 0.001 ? 0 : 1 });
        gsap.set(lastFrame, { opacity: self.progress >= 0.999 ? 1 : 0 });
        gsap.set('#scroll-down', { autoAlpha: self.progress > 0.02 ? 0 : 1 });
        setActiveStop(self.progress);
      },
    },
  });
  tl.to(frameState, { index: CONFIG.FRAMES.count - 1, ease: 'none', duration: D, onUpdate: onFrameIndexChange }, 0);
  tl.fromTo('#ruler', { '--ruler-progress': '0%' }, { '--ruler-progress': '100%', ease: 'none', duration: D }, 0);

  /* the rail: one tick per stop, number always, name on hover */
  const st = tl.scrollTrigger;
  const ticks = document.getElementById('rail-ticks');
  const tickEls = STOPS.map((s, i) => {
    const li = document.createElement('li'); li.className = 'rail__tick'; li.style.top = (s.p * 100) + '%';
    const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', s.label);
    const num = i === 0 ? 'S' : i === STOPS.length - 1 ? '∞' : String(i).padStart(2, '0');
    b.innerHTML = `<span class="rail__label">${s.label}</span><span class="rail__num">${num}</span>`;
    b.addEventListener('click', () => goToStop(i));
    li.appendChild(b); ticks.appendChild(li); return li;
  });
  let activeStop = -1;
  function setActiveStop(p) {
    let best = 0, bd = 9;
    STOPS.forEach((s, i) => { const d = Math.abs(s.p - p); if (d < bd) { bd = d; best = i; } });
    if (best !== activeStop) {
      activeStop = best;
      tickEls.forEach((el, i) => el.classList.toggle('is-active', i === best));
    }
    if (scrub) scrub.paint(p, best);
  }

  /* ---- the timeline scrubber (2026-08-23, Keeno: "a cool side scroll
     to quickly get past the large animation") ----
     A horizontal timeline at the foot of the pinned film: the fill is the
     progress, the ticks are the eight stops (hover for the name, click to
     go), the thumb DRAGS - scrolling the page directly so the film scrubs
     live under the finger, then settles on the nearest stop on release -
     and "Skip" at the end drops you out of the pin. Keys still work. */
  const scrub = (() => {
    const host = document.getElementById('scrolly');
    if (!host) return null;
    const el = document.createElement('div');
    el.className = 'scrub';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Timeline');
    el.innerHTML = `
      <div class="scrub__label" id="scrub-label"></div>
      <div class="scrub__track" id="scrub-track">
        <div class="scrub__fill"></div>
        <div class="scrub__ticks"></div>
        <button type="button" class="scrub__thumb" aria-label="Drag to scrub the film" data-cursor-label="DRAG"></button>
      </div>
      <button type="button" class="scrub__skip" data-cursor-label="SKIP">Skip <span aria-hidden="true">&rarr;</span></button>`;
    host.appendChild(el);
    const track = el.querySelector('#scrub-track'), fill = el.querySelector('.scrub__fill'), thumb = el.querySelector('.scrub__thumb');
    const label = el.querySelector('#scrub-label'), ticksHost = el.querySelector('.scrub__ticks'), skip = el.querySelector('.scrub__skip');
    STOPS.forEach((s, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'scrub__tick';
      b.style.left = (s.p * 100) + '%'; b.setAttribute('aria-label', s.label); b.title = s.label;
      b.addEventListener('click', () => goToStop(i));
      ticksHost.appendChild(b);
    });
    const NAMES = STOPS.map((s, i) => (i === 0 ? 'Start' : i === STOPS.length - 1 ? 'Reassembled' : String(i).padStart(2, '0') + ' \u00b7 ' + s.label));
    function paint(p, best) {
      const pct = Math.max(0, Math.min(1, p)) * 100;
      fill.style.transform = 'scaleX(' + (pct / 100) + ')';
      thumb.style.left = pct + '%';
      label.textContent = NAMES[best];
      ticksHost.querySelectorAll('.scrub__tick').forEach((t, i) => t.classList.toggle('is-done', STOPS[i].p <= p + 0.001));
    }
    let dragging = false;
    function pFromEvent(e) {
      const r = track.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    }
    function seek(p) {
      stepLock = performance.now() + 400;
      window.scrollTo(0, st.start + p * (st.end - st.start));
    }
    thumb.addEventListener('pointerdown', (e) => {
      dragging = true; el.classList.add('is-dragging'); thumb.setPointerCapture(e.pointerId); e.preventDefault();
    });
    thumb.addEventListener('pointermove', (e) => { if (dragging) seek(pFromEvent(e)); });
    function release(e) {
      if (!dragging) return;
      dragging = false; el.classList.remove('is-dragging');
      let best = 0, bd = 9; const p = pFromEvent(e);
      STOPS.forEach((s, i) => { const d = Math.abs(s.p - p); if (d < bd) { bd = d; best = i; } });
      goToStop(best);
    }
    thumb.addEventListener('pointerup', release);
    thumb.addEventListener('pointercancel', release);
    track.addEventListener('click', (e) => {
      if (e.target !== track && e.target !== fill) return;
      let best = 0, bd = 9; const p = pFromEvent(e);
      STOPS.forEach((s, i) => { const d = Math.abs(s.p - p); if (d < bd) { bd = d; best = i; } });
      goToStop(best);
    });
    skip.addEventListener('click', () => {
      stepLock = performance.now() + 1500;
      gsap.to(window, { scrollTo: st.end + 420, duration: 1.1, ease: 'power2.inOut', overwrite: true });
    });
    // keyboard on the thumb: arrows step, End skips
    thumb.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goToStop(activeStop + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); goToStop(activeStop - 1); }
      else if (e.key === 'End') { e.preventDefault(); skip.click(); }
    });
    return { paint };
  })();
  /* ---- one gesture = one stop (2026-08-21, Keeno: "one normal scroll per
     area... as soon as you pull up once, it should just go to the next
     area... so there's not that weird rendering process") ----
     While the section is pinned, a wheel/trackpad gesture no longer moves
     the page by its own distance; it requests the NEXT stop, and the page
     travels there on one eased tween of fixed length. Every transition is
     therefore the same motion — the piece leaves, the copy rises — rather
     than a scrub at whatever speed the fingers happened to move. The lock
     swallows the trackpad's momentum tail so one flick is one stop, not
     three. At the last stop a forward gesture is released to native scroll
     so the gallery below stays reachable; at the first stop a backward one
     is released too. Keys and the rail use the same path. */
  const STEP = { duration: 1.15, ease: 'power2.inOut', settle: 220, jitter: 6 };
  /* Decode ahead (2026-08-23): the moving phase draws the half-res set
     (see renderFrame), so only the destination's full-res frame needs to be
     ready before the step lands. One off-thread decode per step. */
  function decodeAhead(fromP, toP) {
    const i = Math.round(toP * (CONFIG.FRAMES.count - 1)), im = frames[i];
    if (im && im.decode) im.decode().catch(() => {});
  }
  function goToStop(i) {
    const k = Math.max(0, Math.min(STOPS.length - 1, i));
    const y = st.start + STOPS[k].p * (st.end - st.start);
    decodeAhead(st.progress, STOPS[k].p);
    stepLock = performance.now() + STEP.duration * 1000 + STEP.settle;
    gsap.to(window, { scrollTo: y, duration: STEP.duration, ease: STEP.ease, overwrite: true });
  }
  const gated = () => document.documentElement.classList.contains('gated');
  function onWheel(e) {
    if (gated() || !st.isActive) return;                       // not ours: native scroll
    const fwd = e.deltaY > 0;
    if ((fwd && activeStop >= STOPS.length - 1) || (!fwd && activeStop <= 0)) return;  // release at the ends
    e.preventDefault();
    if (performance.now() < stepLock || Math.abs(e.deltaY) < STEP.jitter) return;
    goToStop(activeStop + (fwd ? 1 : -1));
  }
  addEventListener('wheel', onWheel, { passive: false });
  let touchY = null;
  addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchmove', (e) => { if (!gated() && st.isActive && touchY != null) e.preventDefault(); }, { passive: false });
  addEventListener('touchend', (e) => {
    if (touchY == null || gated() || !st.isActive) { touchY = null; return; }
    const dy = touchY - e.changedTouches[0].clientY; touchY = null;
    if (Math.abs(dy) < 40 || performance.now() < stepLock) return;
    goToStop(activeStop + (dy > 0 ? 1 : -1));
  });
  addEventListener('keydown', (e) => {
    if (gated() || e.metaKey || e.ctrlKey || e.altKey) return;
    const fwd = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === ' ';
    const back = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'ArrowLeft';
    if ((!fwd && !back) || !st.isActive) return;
    e.preventDefault();
    if (performance.now() < stepLock) return;
    goToStop(activeStop + (fwd ? 1 : -1));
  });

  document.querySelectorAll('.slide').forEach((slide, i) => {
    if (i === 0) {
      tl.to(slide, { autoAlpha: 0, y: -30, duration: D * HERO * 0.45 }, D * HERO * 0.5);
    } else {
      /* hand-off, not a gap (2026-08-21 Ducati pass): the old in at +0.10 /
         out at +0.86 left ~0.8 screens of scroll between chapters with no
         copy on screen at all (measured: every slide at opacity 0 at
         p=0.19). Now a chapter's panel is fully out exactly when the next
         one starts rising. */
      /* animate the PANEL, not the article (2026-08-22 -- found chasing the
         viewport bug): .slide--system centers itself with CSS
         transform:translateY(-50%); GSAP's own `y` is an absolute
         translateY, so tweening `y` on that same element overwrote the
         -50% the instant this ran, and the panel hung from the viewport's
         vertical middle downward instead of being centred on it -- exactly
         System 04's "off the screen" at a short viewport. The article's
         CSS centering is now never touched by GSAP; only its child panel
         (a plain in-flow block, no transform of its own to lose) fades. */
      const panel = slide.querySelector('.slide__panel');
      const s = sysStart(i - 1);
      /* opacity, not autoAlpha (2026-08-23): autoAlpha flips visibility to
         hidden at 0, which throws the panel's raster away; the next forward
         step then re-rasters a full text block at DPR 2 in the same frame
         the film is at peak speed -- traced as one 34-50ms frame on every
         forward step, never on a backward one. The panel keeps its layer
         (will-change in style.css) and just fades. pointer-events is off
         on .slide already, so an invisible panel is not clickable. */
      tl.fromTo(panel, { opacity: 0, y: 28 }, { opacity: 1, y: 0, duration: D * SYS_W * 0.14 }, D * (s - SYS_W * 0.04)); // starts just before the previous one is fully out
      const out = i < CONFIG.CHAPTERS - 1 ? s + SYS_W * 0.90 : REASSEMBLE[0];
      tl.to(panel, { opacity: 0, y: -22, duration: D * SYS_W * 0.10 }, D * out);
    }
  });
  tl.fromTo('#finale-line', { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: D * 0.045, ease: 'power2.out' }, D * (GLOW[0] + 0.015));

  /* The horizontal gallery that followed the film (THE SIX SYSTEMS / ONE
     MENTOR / CANONSBURG, PA / TALK TO STRADIGI) was scrapped 2026-08-23 -
     Keeno: every one of its four panels is said again in the sections
     below, so the film now hands off straight to "Who we help". */

  addEventListener('resize', () => { setDiscVars(); renderFrame(); });
}

preloadFrames();
