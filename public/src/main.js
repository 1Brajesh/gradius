// Start-up and the game loop.
//
// The game updates at a fixed 60 steps per second so it plays the same
// on every screen. Drawing happens as often as the screen refreshes;
// on a 120 Hz screen, positions are blended between steps ("a") so
// movement still looks perfectly smooth.
//
// On phones and tablets it also places the on-screen buttons, asks to
// be turned sideways, keeps the screen awake while playing, and sets
// up the offline app (service worker).

import { W, H, STEP } from './config.js';
import { Input } from './input.js';
import { buildArt } from './art.js';
import { Game } from './game.js';
import { drawPause } from './ui.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const touchUI = document.getElementById('touch');
const rotateUI = document.getElementById('rotate');
const btn = {
  pause: document.getElementById('btn-pause'),
  mute: document.getElementById('btn-sound'),
  power: document.getElementById('btn-power'),
};

const input = new Input();
const sound = new Sound();
const game = new Game(buildArt(), input, sound);
if (input.touchMode) game.fx.max = 1500; // fewer sparks on phones keeps it smooth

let scale = 1;
let dpr = 1;

// read the phone's notch / rounded-corner margins (set as CSS vars in style.css)
function safeInsets() {
  const cs = getComputedStyle(document.documentElement);
  const px = (name) => parseFloat(cs.getPropertyValue(name)) || 0;
  return { l: px('--sal'), r: px('--sar'), t: px('--sat'), b: px('--sab') };
}

const place = (el, x, y, size) => {
  el.style.left = `${Math.round(x)}px`;
  el.style.top = `${Math.round(y)}px`;
  el.style.width = el.style.height = `${Math.round(size)}px`;
};

// Fit the 1280x720 world into the window, keeping its shape, and draw
// at the screen's real pixel density (up to 2x) so it stays sharp.
function resize() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  scale = Math.min(vw / W, vh / H);
  const cssW = Math.floor(W * scale);
  const cssH = Math.floor(H * scale);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  input.scale = scale;

  // on-screen buttons: in the empty side bars if there's room, otherwise
  // over the corners of the game, clear of the score and the meter
  const left = (vw - cssW) / 2;
  const top = (vh - cssH) / 2;
  const right = left + cssW;
  const bottom = top + cssH;
  const safe = safeInsets();
  const barL = left - safe.l;
  const barR = vw - right - safe.r;

  const P = Math.round(Math.min(92, Math.max(66, 120 * scale)));  // power button
  const B = Math.round(Math.min(52, Math.max(42, 60 * scale)));   // pause / sound
  if (barR >= P + 8) {
    place(btn.power, right + (barR - P) / 2, bottom - P - Math.max(16, safe.b), P);
  } else {
    place(btn.power, right - P - 10, bottom - P - 10, P);
  }
  if (barL >= B + 12) {
    const x = left - B - (barL - B) / 2;
    place(btn.pause, x, top + Math.max(12, safe.t), B);
    place(btn.mute, x, top + Math.max(12, safe.t) + B + 10, B);
  } else {
    // just right of the score
    const x = left + Math.max(185 * scale, 96);
    place(btn.pause, x, top + 8, B);
    place(btn.mute, x + B + 8, top + 8, B);
  }
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 300));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

// Browsers only allow sound after the player presses something.
// (iPhones want it on touchend, so listen for that too.)
for (const ev of ['keydown', 'pointerdown', 'touchend', 'click']) {
  window.addEventListener(ev, () => sound.unlock());
}

// ----- on-screen buttons -----
for (const [action, el] of Object.entries(btn)) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sound.unlock();
    input.setTouchMode(true);
    input.press(action);
    el.classList.add('down');
  });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
window.addEventListener('contextmenu', (e) => { if (input.touchMode) e.preventDefault(); });
document.addEventListener('gesturestart', (e) => e.preventDefault()); // no pinch-zoom on iPhone

function showTouchUI(on) {
  touchUI.hidden = !on;
}
input.onModeChange = showTouchUI;
showTouchUI(input.touchMode);

// ----- full screen and keep-awake on phones -----
const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches
  || navigator.standalone === true;
let askedFullscreen = false;
let wakeLock = null;

async function keepAwake() {
  if (!('wakeLock' in navigator) || wakeLock || document.hidden) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* not allowed right now */ }
}

window.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  keepAwake();
  // in the browser (not installed), go full screen on the first touch where allowed
  if (!askedFullscreen && !standalone && document.fullscreenEnabled && !document.fullscreenElement) {
    askedFullscreen = true;
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
});

// ----- pause -----
let paused = false;
let fade = 0; // fade in from black at the start

function pause() {
  paused = true;
  input.hits.delete('tap'); // the tap that paused shouldn't also unpause
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pause();
  else if (input.touchMode) keepAwake();
});
window.addEventListener('blur', pause);

function isPortrait() {
  return input.touchMode && window.innerHeight > window.innerWidth;
}

function render(a) {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  game.draw(ctx, a);
  if (fade < 0.8) {
    ctx.fillStyle = `rgba(0,0,0,${1 - fade / 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (paused) drawPause(ctx, input.touchMode);
}

// keep the buttons' look in step with the game (only touch the page when it changes)
let lastLook = '';
function updateButtons() {
  const ready = game.meter.cursor >= 0 && game.player.alive;
  const look = `${ready}|${sound.muted}|${paused}`;
  if (look === lastLook) return;
  lastLook = look;
  btn.power.classList.toggle('ready', ready);
  btn.mute.classList.toggle('off', sound.muted);
  btn.pause.classList.toggle('on', paused);
}

let last = performance.now() / 1000;
let acc = 0;
let slowT = 0; // how long frames have been coming too slowly

function frame(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.max(0, Math.min(now - last, 0.25));
  last = now;

  // if this device can't keep up (under ~40 frames a second for a few
  // seconds), turn off the glow pass and use fewer particles
  if (!paused && !game.lowFx && !document.hidden) {
    slowT = dt > 1 / 40 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
    if (slowT > 3) {
      game.lowFx = true;
      game.fx.max = Math.min(game.fx.max, 900);
    }
  }

  const portrait = isPortrait();
  rotateUI.hidden = !portrait;
  if (portrait && !paused) pause();

  if (input.take('pause')) {
    if (paused) paused = false;
    else pause();
  }
  if (paused && !portrait && input.take('tap')) paused = false;
  if (input.take('mute')) sound.toggleMute();
  if (sound.paused !== paused) sound.setPaused(paused);
  if (paused) input.takeDrag(); // thumb moves while paused don't count

  if (!paused) {
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP);
      fade += STEP;
      acc -= STEP;
    }
  }
  render(paused ? 1 : acc / STEP);
  updateButtons();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ----- installable, works offline -----
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

// handy in the browser console (and for automated tests)
window.starwake = { game, isPaused: () => paused };
