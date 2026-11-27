// Start-up and the game loop.
//
// The game updates at a fixed 60 steps per second so it plays the same
// on every screen. Drawing happens as often as the screen refreshes;
// on a 120 Hz screen, positions are blended between steps ("a") so
// movement still looks perfectly smooth.

import { W, H, STEP } from './config.js';
import { Input } from './input.js';
import { buildArt } from './art.js';
import { Game } from './game.js';
import { drawPause } from './ui.js';
import { Sound } from './audio.js';

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
const sound = new Sound();
const game = new Game(buildArt(), input, sound);

// Browsers only allow sound after the player presses something.
window.addEventListener('keydown', () => sound.unlock());
window.addEventListener('pointerdown', () => sound.unlock());

let paused = false;
let fade = 0; // fade in from black at the start

document.addEventListener('visibilitychange', () => {
  if (document.hidden) paused = true;
});
window.addEventListener('blur', () => { paused = true; });

function render(a) {
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  game.draw(ctx, a);
  if (fade < 0.8) {
    ctx.fillStyle = `rgba(0,0,0,${1 - fade / 0.8})`;
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
  if (input.take('mute')) sound.toggleMute();
  if (sound.paused !== paused) sound.setPaused(paused);

  if (!paused) {
    acc += dt;
    while (acc >= STEP) {
      game.update(STEP);
      fade += STEP;
      acc -= STEP;
    }
  }
  render(paused ? 1 : acc / STEP);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
