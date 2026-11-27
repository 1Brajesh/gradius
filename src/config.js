// Shared constants. The game always thinks in a 1280x720 world;
// main.js scales that to fit the window.

export const W = 1280;
export const H = 720;
export const STEP = 1 / 60;          // fixed update rate (seconds)

// Area the ship may move in (bottom strip is kept for the power-up meter).
export const PLAY = { left: 28, right: W - 28, top: 28, bottom: H - 64 };

// Base speed the world scrolls past, in pixels per second.
export const SCROLL_SPEED = 90;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Small seeded random generator so backgrounds look the same every run.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
