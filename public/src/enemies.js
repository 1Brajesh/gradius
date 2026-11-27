// Enemy types and how each one moves and attacks.
// Sprites face left (toward the player); `angle` tilts them.

import { W, H, lerp } from './config.js';
import { stamp } from './art.js';

let nextId = 1;

const TYPES = {
  dart:    { r: 13, hp: 1, score: 100, boom: 0.7 },
  sweeper: { r: 17, hp: 2, score: 200, boom: 0.9 },
  bulb:    { r: 27, hp: 8, score: 500, boom: 1.6, drops: true },
};

export function makeEnemy(type, props = {}) {
  const T = TYPES[type];
  const e = {
    id: nextId++,
    type,
    r: T.r,
    hp: T.hp,
    score: T.score,
    boom: T.boom,
    drops: !!T.drops,   // always leaves an energy cell
    x: W + 50,
    y: H / 2,
    vx: 0,
    vy: 0,
    t: 0,
    flash: 0,
    angle: 0,
    dead: false,
    gone: false,
    group: null,        // darts in a group drop a cell if all are shot
    ...props,
  };
  e.px = e.x;
  e.py = e.y;
  return e;
}

// turn `from` toward `to` by at most `step` radians
function turnToward(from, to, step) {
  const diff = ((to - from + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return from + Math.max(-step, Math.min(step, diff));
}

const BEHAVIOUR = {
  // Flies left along a wave. A group follows the same path, like a snake.
  dart(e, dt) {
    const dx = e.speed * dt;
    e.x -= dx;
    const ny = e.baseY + e.amp * Math.sin(e.t * e.freq);
    e.angle = -Math.atan2(ny - e.y, dx) * 0.7;
    e.y = ny;
  },

  // Glides in, stops, turns to face you, then dives.
  sweeper(e, dt, world) {
    const p = world.player;
    if (e.phase === 'in') {
      const k = 1 - Math.exp(-dt * 2.6);
      e.x += (e.stopX - e.x) * k;
      e.y += (e.stopY - e.y) * k;
      if (e.t > 1.4) { e.phase = 'aim'; e.pt = 0; }
    } else if (e.phase === 'aim') {
      e.pt += dt;
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.angle = turnToward(e.angle, a - Math.PI, dt * 8);
      if (e.pt > 0.45) {
        e.phase = 'dive';
        e.vx = Math.cos(a) * 440;
        e.vy = Math.sin(a) * 440;
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  },

  // Slow, tough, bobs along and fires a fan of three shots at you.
  bulb(e, dt, world) {
    e.x -= 55 * dt;
    e.y = e.baseY + 16 * Math.sin(e.t * 1.3);
    e.fire -= dt;
    const p = world.player;
    if (e.fire <= 0 && e.x < W - 30 && p.alive) {
      e.fire = 2.3;
      const gx = e.x - 30;
      const a = Math.atan2(p.y - e.y, p.x - gx);
      for (const d of [-0.22, 0, 0.22]) world.enemyShot(gx, e.y, a + d, 240);
    }
  },
};

export function updateEnemies(list, dt, world) {
  for (const e of list) {
    e.px = e.x;
    e.py = e.y;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    BEHAVIOUR[e.type](e, dt, world);
    if (e.x < -90 || e.y < -90 || e.y > H + 90) e.gone = true;
  }
}

export function drawEnemies(ctx, list, a, art) {
  for (const e of list) {
    const x = lerp(e.px, e.x, a);
    const y = lerp(e.py, e.y, a);
    const spr = art.enemies[e.type];
    ctx.save();
    ctx.translate(x, y);
    if (e.angle) ctx.rotate(e.angle);
    stamp(ctx, spr.normal, 0, 0);
    if (e.flash > 0) {
      // a quick white tint when hit
      ctx.globalAlpha = 0.6;
      stamp(ctx, spr.white, 0, 0);
    }
    ctx.restore();
    if (e.type === 'bulb') {
      // the core breathes; it glows brighter just before firing
      const charge = Math.max(0, 1 - e.fire / 0.6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(e.t * 4) + 0.5 * charge;
      stamp(ctx, art.glowPink, x, y, 46 + 20 * charge, 46 + 20 * charge);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
