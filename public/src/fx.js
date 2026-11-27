// Particles: little glowing dots for engine trails, sparks and (later)
// explosions. Added together with 'lighter' blending so they glow.

import { lerp } from './config.js';
import { stamp } from './art.js';

const MAX = 2500;

export class Particles {
  constructor() {
    this.list = [];
  }

  // p: { x, y, vx, vy, life, size, sprite, drag?, alpha?, grow? }
  add(p) {
    if (this.list.length >= MAX) return;
    p.px = p.x;
    p.py = p.y;
    p.age = 0;
    p.drag ??= 0;
    p.alpha ??= 1;
    p.grow ??= -0.6; // size change over its life (-0.6 = shrinks to 40%)
    this.list.push(p);
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
    ctx.globalCompositeOperation = 'source-over';
  }
}
