// Start-up and the game loop.
//
// The game updates at a fixed 60 steps per second so it plays the same
// on every screen. Drawing happens as often as the screen refreshes;
// on a 120 Hz screen, positions are blended between steps ("a") so
// movement still looks perfectly smooth.

import { W, H, STEP } from './config.js';
import { Input } from './input.js';
import { buildArt, stamp } from './art.js';
import { Background } from './background.js';
import { Player } from './player.js';
import { Particles } from './fx.js';
import { drawHint, drawPause } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let scale = 1;
let dpr = 1;

// Fit the 1280x720 world into the window, keeping its shape, and draw
// at the screen's real pixel density so it stays sharp.
function resize() {
  dpr = window.devicePixelRatio || 1;
  scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cssW = Math.floor(W * scale);
  const cssH = Math.floor(H * scale);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}
window.addEventListener('resize', resize);
resize();

const input = new Input();
const art = buildArt();
const fx = new Particles();
const bg = new Background(art);
const player = new Player(art, fx);

let paused = false;
let time = 0;          // seconds of play
let hint = 1;          // controls hint visibility, fades out

document.addEventListener('visibilitychange', () => {
  if (document.hidden) paused = true;
});
window.addEventListener('blur', () => { paused = true; });

function update(dt) {
  time += dt;
  bg.update(dt);
  player.update(dt, input);
  fx.update(dt);
  if (time > 7 || (input.touched && time > 3)) hint = Math.max(0, hint - dt * 1.5);
}

function render(a) {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  bg.draw(ctx, a);
  fx.draw(ctx, a);
  player.draw(ctx, a);
  stamp(ctx, art.vignette, W / 2, H / 2);
  drawHint(ctx, hint);
  // fade in from black at the start
  if (time < 0.8) {
    ctx.fillStyle = `rgba(0,0,0,${1 - time / 0.8})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (paused) drawPause(ctx);
}

let last = performance.now() / 1000;
let acc = 0;

function frame(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.max(0, Math.min(now - last, 0.25));
  last = now;

  if (input.take('pause')) paused = !paused;

  if (!paused) {
    acc += dt;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
  }
  render(paused ? 1 : acc / STEP);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
