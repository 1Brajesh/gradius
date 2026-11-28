// Particles: little glowing dots for engine trails, sparks and
// explosions, plus expanding shock rings. All drawn with 'lighter'
// blending so overlapping light adds up and glows.

import { lerp } from './config.js';
import { stamp } from './art.js';

const MAX = 3000;

export class Particles {
  constructor() {
    this.list = [];
    this.rings = [];
    this.max = MAX;   // main.js lowers this on phones
  }

  // p: { x, y, vx, vy, life, size, sprite, drag?, alpha?, grow? }
  add(p) {
    if (this.list.length >= this.max) return;
    p.px = p.x;
    p.py = p.y;
    p.age = 0;
    p.drag ??= 0;
    p.alpha ??= 1;
    p.grow ??= -0.6; // size change over its life (-0.6 = shrinks to 40%)
    this.list.push(p);
  }

  ring(x, y, r0, r1, life, rgb = '255,200,150') {
    this.rings.push({ x, y, r0, r1, life, rgb, age: 0 });
  }

  update(dt) {
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
      list[n++] = p;
    }
    list.length = n;
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < r.life);
  }

  draw(ctx, a) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const t = p.age / p.life;
      const size = p.size * (1 + p.grow * t);
      ctx.globalAlpha = p.alpha * (1 - t);
      stamp(ctx, p.sprite, lerp(p.px, p.x, a), lerp(p.py, p.y, a), size, size);
    }
    ctx.globalAlpha = 1;
    for (const r of this.rings) {
      const t = r.age / r.life;
      const ease = 1 - (1 - t) * (1 - t);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * ease, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r.rgb},${0.7 * (1 - t)})`;
      ctx.lineWidth = 0.5 + 3 * (1 - t);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// A burst of fire, sparks and a shock ring. size 1 = small enemy.
export function explode(fx, art, x, y, size = 1) {
  const n = Math.round(14 * size);
  fx.add({ x, y, vx: 0, vy: 0, life: 0.18, size: 70 * size, grow: 0.6, sprite: art.glowWhite });
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (50 + Math.random() * 260) * size;
    fx.add({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.35 + Math.random() * 0.5,
      size: (16 + Math.random() * 24) * Math.sqrt(size),
      drag: 4,
      grow: 0.3,
      alpha: 0.8,
      sprite: Math.random() < 0.3 ? art.glowAmber : art.glowOrange,
    });
  }
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (250 + Math.random() * 450) * size;
    fx.add({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.2 + Math.random() * 0.3,
      size: 4 + Math.random() * 5,
      drag: 5,
      sprite: art.glowWhite,
    });
  }
  fx.ring(x, y, 8 * size, 60 * size, 0.3 + 0.12 * size);
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
