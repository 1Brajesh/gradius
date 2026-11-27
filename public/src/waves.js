// TEMPORARY test waves for step 2: a loop of enemy patterns that gets a
// little faster each time round. Step 3 replaces this with the real,
// hand-made Stage 1 timeline.

import { W, PLAY } from './config.js';

const MID = (PLAY.top + PLAY.bottom) / 2;
const at = (frac) => PLAY.top + (PLAY.bottom - PLAY.top) * frac;

function darts(w, g, frac, amp = 70) {
  const group = { total: 5, killed: 0 };
  const baseY = at(frac);
  for (let i = 0; i < 5; i++) {
    w.after(i * 0.24, () =>
      g.spawn('dart', { baseY, y: baseY, amp, freq: 2.6, speed: 250 * w.pace, group }));
  }
}

function sweepers(w, g) {
  g.spawn('sweeper', { x: W + 40, y: PLAY.top + 20, stopX: W - 280, stopY: MID - 140, phase: 'in' });
  w.after(0.35, () =>
    g.spawn('sweeper', { x: W + 40, y: PLAY.bottom - 20, stopX: W - 220, stopY: MID + 140, phase: 'in' }));
}

function bulb(w, g, frac) {
  const baseY = at(frac);
  g.spawn('bulb', { baseY, y: baseY, fire: 1.2 });
}

const PATTERNS = [
  { gap: 3.0, fn: (w, g) => darts(w, g, 0.3) },
  { gap: 3.0, fn: (w, g) => darts(w, g, 0.7) },
  { gap: 3.5, fn: (w, g) => sweepers(w, g) },
  { gap: 3.0, fn: (w, g) => darts(w, g, 0.5, 130) },
  { gap: 4.5, fn: (w, g) => bulb(w, g, 0.4) },
  { gap: 3.0, fn: (w, g) => { darts(w, g, 0.2); w.after(1.2, () => darts(w, g, 0.8)); } },
  { gap: 4.0, fn: (w, g) => { sweepers(w, g); w.after(1.5, () => darts(w, g, 0.5, 40)); } },
  { gap: 5.0, fn: (w, g) => { bulb(w, g, 0.25); w.after(2, () => bulb(w, g, 0.75)); } },
];

export class Waves {
  constructor() {
    this.reset();
  }

  reset() {
    this.clock = 0;
    this.next = 2.5;   // first wave after a short breather
    this.i = 0;
    this.pace = 1;
    this.queue = [];
  }

  after(delay, fn) {
    this.queue.push({ at: this.clock + delay, fn });
  }

  update(dt, game) {
    this.clock += dt;
    const due = this.queue.filter((q) => q.at <= this.clock);
    this.queue = this.queue.filter((q) => q.at > this.clock);
    for (const q of due) q.fn();

    this.next -= dt;
    if (this.next <= 0) {
      const P = PATTERNS[this.i % PATTERNS.length];
      P.fn(this, game);
      this.next = P.gap / this.pace;
      this.i++;
      if (this.i % PATTERNS.length === 0) this.pace = Math.min(1.6, this.pace + 0.1);
    }
  }
}
