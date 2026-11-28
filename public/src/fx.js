// Particles: glowing dots for engine trails, sparks and explosions,
// plus smoke, tumbling wreckage and expanding shock rings.
//
// Each particle sits on a layer, drawn in this order:
//   'smoke'  dark puffs, drawn normally (they darken what's behind)
//   'debris' small chunks of hull that spin as they fly
//   'light'  glows, drawn with 'lighter' blending so light adds up
//   'fire'   the same, but they stay bright longer before fading
//   'spark'  fast streaks, drawn as short lines along their path
//
// Also here: the screen shake and the delayed follow-up blasts.

import { lerp } from './config.js';
import { stamp } from './art.js';

const MAX = 3000;

export class Particles {
  constructor() {
    this.list = [];
    this.rings = [];
    this.timers = [];
    this.max = MAX;   // main.js lowers this on phones
    this.clock = 0;
  }

  // p: { x, y, vx, vy, life, size, sprite, drag?, alpha?, grow?, layer?, spin?, flicker? }
  add(p) {
    if (this.list.length >= this.max) return;
    p.px = p.x;
    p.py = p.y;
    p.age = 0;
    p.drag ??= 0;
    p.alpha ??= 1;
    p.grow ??= -0.6; // size change over its life (-0.6 = shrinks to 40%)
    p.layer ??= 'light';
    p.rot ??= 0;
    p.spin ??= 0;
    this.list.push(p);
  }

  ring(x, y, r0, r1, life, rgb = '255,200,150', width = 3) {
    this.rings.push({ x, y, r0, r1, life, rgb, width, age: 0 });
  }

  // run something a little later (e.g. the second pop of a big blast)
  later(delay, fn) {
    this.timers.push({ at: this.clock + delay, fn });
  }

  clear() {
    this.timers = [];
  }

  update(dt) {
    this.clock += dt;
    if (this.timers.length) {
      const due = this.timers.filter((t) => t.at <= this.clock);
      this.timers = this.timers.filter((t) => t.at > this.clock);
      for (const t of due) t.fn();
    }

    const list = this.list;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      p.px = p.x;
      p.py = p.y;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      list[n++] = p;
    }
    list.length = n;
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  draw(ctx, a) {
    const list = this.list;

    // smoke and wreckage: normal blending
    for (const p of list) {
      if (p.layer !== 'smoke') continue;
      const t = p.age / p.life;
      const size = p.size * (1 + p.grow * t);
      // fade in quickly, then thin out slowly
      ctx.globalAlpha = p.alpha * Math.min(1, t * 8) * (1 - t) * (1 - t);
      stamp(ctx, p.sprite, lerp(p.px, p.x, a), lerp(p.py, p.y, a), size, size);
    }
    for (const p of list) {
      if (p.layer !== 'debris') continue;
      const t = p.age / p.life;
      ctx.globalAlpha = t < 0.7 ? 1 : (1 - t) / 0.3;
      ctx.save();
      ctx.translate(lerp(p.px, p.x, a), lerp(p.py, p.y, a));
      ctx.rotate(p.rot);
      stamp(ctx, p.sprite, 0, 0, p.size * 1.4, p.size);
      ctx.restore();
    }

    // light
    ctx.globalCompositeOperation = 'lighter';
    for (const p of list) {
      if (p.layer !== 'light' && p.layer !== 'fire') continue;
      const t = p.age / p.life;
      const size = p.size * (1 + p.grow * t);
      let al = p.alpha * (p.layer === 'fire' ? 1 - t * t : 1 - t);
      if (p.flicker) al *= 0.55 + 0.45 * Math.sin(p.age * 40 + p.x);
      ctx.globalAlpha = al;
      stamp(ctx, p.sprite, lerp(p.px, p.x, a), lerp(p.py, p.y, a), size, size);
    }

    // sparks: one path of short lines, each as long as its recent travel
    ctx.globalAlpha = 1;
    ctx.beginPath();
    let any = false;
    for (const p of list) {
      if (p.layer !== 'spark') continue;
      const t = p.age / p.life;
      const x = lerp(p.px, p.x, a);
      const y = lerp(p.py, p.y, a);
      const k = 0.035 * (1 - t);
      ctx.moveTo(x, y);
      ctx.lineTo(x - p.vx * k, y - p.vy * k);
      any = true;
    }
    if (any) {
      ctx.strokeStyle = 'rgba(255,225,170,0.85)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    for (const r of this.rings) {
      const t = r.age / r.life;
      const ease = 1 - (1 - t) * (1 - t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.rgb},${0.7 * (1 - t)})`;
      ctx.lineWidth = 0.5 + r.width * (1 - t);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);

// A blast: flash, fireball, sparks, embers, wreckage, smoke and a shock
// ring. size 1 = small enemy, 2+ = the player's ship or a boss part.
export function explode(fx, art, x, y, size = 1) {
  const rs = Math.sqrt(size);

  // a flash, and light thrown over the surroundings
  fx.add({ x, y, vx: 0, vy: 0, life: 0.16, size: 80 * size, grow: 0.6, sprite: art.glowWhite });
  fx.add({ x, y, vx: 0, vy: 0, life: 0.35, size: 240 * rs, grow: 0.4, alpha: 0.3, sprite: art.glowOrange });

  // the fireball: a few billowing balls of flame
  const balls = Math.round(3 + 2 * size);
  for (let i = 0; i < balls; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(20, 110) * size;
    fx.add({
      x: x + Math.cos(a) * 6 * size,
      y: y + Math.sin(a) * 6 * size,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rnd(0.45, 0.85),
      size: rnd(30, 50) * rs,
      drag: 3,
      grow: 1.0,
      alpha: 0.55,
      layer: 'fire',
      sprite: art.fireball,
    });
  }

  // flames flung outward
  const n = Math.round(10 * size);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(60, 300) * size;
    fx.add({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: rnd(0.3, 0.75),
      size: rnd(14, 34) * rs,
      drag: 4,
      grow: 0.3,
      alpha: 0.75,
      sprite: Math.random() < 0.3 ? art.glowAmber : art.glowOrange,
    });
  }

  // fast spark streaks
  for (let i = 0; i < n + 4; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(300, 800) * rs;
    fx.add({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.15, 0.4), size: 1, drag: 4, layer: 'spark' });
  }

  // embers that drift and flicker for a while after
  for (let i = 0; i < Math.round(4 * size); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(40, 160) * rs;
    fx.add({
      x, y,
      vx: Math.cos(a) * sp - 30,
      vy: Math.sin(a) * sp,
      life: rnd(0.8, 1.6),
      size: rnd(5, 9),
      drag: 1.5,
      grow: -0.5,
      flicker: true,
      sprite: art.glowAmber,
    });
  }

  // chunks of wreckage
  if (size >= 0.9) {
    for (let i = 0; i < Math.round(2 + 2 * size); i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = rnd(90, 280) * rs;
      fx.add({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.7, 1.3),
        size: rnd(6, 11) * rs,
        drag: 1.2,
        layer: 'debris',
        rot: Math.random() * 6.3,
        spin: rnd(-14, 14),
        sprite: art.debris,
      });
    }
  }

  // smoke left behind, drifting away with the scenery
  for (let i = 0; i < Math.round(2 + 2.5 * size); i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = rnd(10, 60) * rs;
    fx.add({
      x: x + rnd(-10, 10) * rs,
      y: y + rnd(-10, 10) * rs,
      vx: Math.cos(a) * sp - 40,
      vy: Math.sin(a) * sp,
      life: rnd(1.0, 1.9),
      size: rnd(34, 56) * rs,
      drag: 1,
      grow: 1.4,
      alpha: 0.9,
      layer: 'smoke',
      sprite: art.smoke,
    });
  }

  fx.ring(x, y, 8 * size, 60 * size, 0.3 + 0.12 * size);
  if (size >= 1.5) fx.ring(x, y, 4 * size, 110 * size, 0.22 + 0.06 * size, '255,250,240', 1.5);
}

// A big blast followed by a couple of smaller pops around it.
export function bigExplode(fx, art, x, y, size = 2) {
  explode(fx, art, x, y, size);
  fx.later(0.12, () => explode(fx, art, x + rnd(-30, 30), y + rnd(-22, 22), size * 0.5));
  fx.later(0.26, () => explode(fx, art, x + rnd(-36, 36), y + rnd(-26, 26), size * 0.4));
}

// A few small sparks, e.g. where a shot hits armour.
export function sparks(fx, art, x, y, n = 4, sprite = art.glowWhite) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 120 + Math.random() * 260;
    fx.add({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.12 + Math.random() * 0.15,
      size: 5 + Math.random() * 6,
      drag: 6,
      sprite,
    });
  }
}

// ---------- screen shake ----------
// "Trauma" goes up with each hit and drains away; the shake is trauma
// squared, so small hits barely nudge and big ones really rattle.
// A slight zoom goes with it so the screen's edges never show.

const SHAKE_PX = 12;
const SHAKE_ROT = 0.006;
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Shake {
  constructor() {
    this.trauma = 0;
    this.t = 0;
    this.scale = reduceMotion ? 0.4 : 1;
  }

  add(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  // keep it at least this strong (e.g. while a beam is firing)
  hold(amount) {
    this.trauma = Math.max(this.trauma, amount);
  }

  update(dt) {
    this.t += dt;
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
  }

  // move the world for drawing; returns false when there's no shake
  apply(ctx, W, H) {
    const s = this.trauma * this.trauma * this.scale;
    if (s < 0.002) return false;
    const t = this.t;
    // smooth wobble from a few sine waves at odd speeds
    const nx = Math.sin(t * 47) * 0.6 + Math.sin(t * 83 + 1.7) * 0.4;
    const ny = Math.sin(t * 53 + 0.6) * 0.6 + Math.sin(t * 91 + 2.9) * 0.4;
    const nr = Math.sin(t * 37 + 4.1);
    const zoom = 1 + s * 0.05;
    ctx.translate(W / 2 + nx * SHAKE_PX * s, H / 2 + ny * SHAKE_PX * s);
    ctx.rotate(nr * SHAKE_ROT * s);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    return true;
  }
}
