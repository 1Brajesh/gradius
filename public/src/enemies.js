// Enemy types and how each one moves and attacks.
// Sprites face left (toward the player); `angle` tilts them.
// "Ground" enemies sit on walls or rocks and scroll with the stage.

import { W, H, PLAY, lerp, clamp } from './config.js';
import { stamp, FLOE_R, FLOE_TOP } from './art.js';

let nextId = 1;

const TYPES = {
  dart:    { r: 13, hp: 1, score: 100, boom: 0.7 },
  sweeper: { r: 17, hp: 2, score: 200, boom: 0.9 },
  bulb:    { r: 27, hp: 8, score: 500, boom: 1.6, drops: true },
  turret:  { r: 14, hp: 3, score: 300, boom: 1.0 },
  hatch:   { r: 24, hp: 10, score: 800, boom: 1.5, drops: true },
  mite:    { r: 8, hp: 1, score: 50, boom: 0.5 },
  shard:   { r: 26, hp: 4, score: 150, boom: 0.9 },
  floe:    { r: 80, hp: Infinity, score: 0, boom: 0, solid: true },
  pebble:  { r: 10, hp: 2, score: 30, boom: 0.5 },
};
const SHARD = {
  3: { r: 24, hp: 4, score: 150, boom: 0.9 },
  2: { r: 14, hp: 2, score: 80, boom: 0.6 },
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
    solid: !!T.solid,   // can't be destroyed; blocks shots
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
  if (type === 'shard') Object.assign(e, SHARD[e.size]);
  if (type === 'floe') e.r = FLOE_R[e.variant] * 0.84; // collision circle
  if (type === 'turret') { e.fire = 1 + Math.random(); e.aim = e.side === 'ceiling' ? Math.PI / 2 : -Math.PI / 2; }
  if (type === 'hatch') { e.cycle = 0; e.open = 0; e.rel = 0; }
  if (e.anchor) {
    if (e.oy === undefined) {
      // sit on top of an ice rock
      e.ox = 0;
      e.oy = -FLOE_R[e.anchor.variant] * FLOE_TOP - 6;
    }
    e.x = e.anchor.x + e.ox;
    e.y = e.anchor.y + e.oy;
  }
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
  // Tracking darts follow the middle of the canyon or tunnel.
  dart(e, dt, world) {
    const dx = e.speed * dt;
    e.x -= dx;
    if (e.track) e.baseY = clamp(world.stage.def.centreAt(world.stage.pos + e.x), PLAY.top + 40, PLAY.bottom - 40);
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

  // Fixed gun on a wall or rock. Swings toward you and fires.
  turret(e, dt, world) {
    if (e.anchor) {
      if (e.anchor.gone) { e.gone = true; return; }
      e.x = e.anchor.x + e.ox;
      e.y = e.anchor.y + e.oy;
    } else {
      e.x -= world.stage.speed * dt;
    }
    const p = world.player;
    let a = Math.atan2(p.y - e.y, p.x - e.x);
    // the gun can only point away from the surface it's fixed to
    if (e.side === 'ceiling') {
      if (a < 0) a = a < -Math.PI / 2 ? Math.PI - 0.2 : 0.2;
      a = clamp(a, 0.2, Math.PI - 0.2);
    } else {
      if (a > 0) a = a > Math.PI / 2 ? -Math.PI + 0.2 : -0.2;
      a = clamp(a, -Math.PI + 0.2, -0.2);
    }
    e.aim = turnToward(e.aim, a, dt * 3);
    e.fire -= dt;
    if (e.fire <= 0 && e.x < W - 20 && e.x > 40 && p.alive) {
      e.fire = 1.9 + Math.random() * 0.8;
      world.enemyShot(e.x + Math.cos(e.aim) * 18, e.y + Math.sin(e.aim) * 18, e.aim, 230);
    }
  },

  // Bunker that opens and lets out a stream of Mites.
  hatch(e, dt, world) {
    e.x -= world.stage.speed * dt;
    e.cycle += dt;
    const c = e.cycle % 4.6;
    e.open = c < 2.4 ? 0 : c < 2.8 ? (c - 2.4) / 0.4 : c < 4.2 ? 1 : 1 - (c - 4.2) / 0.4;
    const out = e.side === 'ceiling' ? 1 : -1;
    if (c >= 2.8 && c < 4.2 && e.x < W - 30 && e.x > 60) {
      e.rel -= dt;
      if (e.rel <= 0) {
        e.rel = 0.34;
        world.spawn('mite', { x: e.x, y: e.y + out * 12, vx: -60 + (Math.random() - 0.5) * 80, vy: out * 240 });
      }
    } else {
      e.rel = 0;
    }
  },

  // Small and quick: shoots out of a hatch, then curves toward you
  // for a couple of seconds before flying straight.
  mite(e, dt, world) {
    const p = world.player;
    let a = Math.atan2(e.vy, e.vx);
    if (e.t > 0.3 && e.t < 2.6) a = turnToward(a, Math.atan2(p.y - e.y, p.x - e.x), dt * 2.6);
    const cur = Math.hypot(e.vx, e.vy);
    const sp = cur + (230 - cur) * (1 - Math.exp(-dt * 3));
    e.vx = Math.cos(a) * sp;
    e.vy = Math.sin(a) * sp;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle += dt * 7;
  },

  // Tumbling ice. Big ones break into smaller ones (see game.js).
  shard(e, dt, world) {
    e.x += (e.vx - world.stage.speed * 0.4) * dt;
    e.y += e.vy * dt;
    e.angle += e.spin * dt;
  },

  // Rocks thrown by the mining rig: they arc down under gravity.
  pebble(e, dt) {
    e.vy += 230 * dt;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.angle += e.spin * dt;
  },

  // Big ice rock: can't be destroyed, so fly around it.
  floe(e, dt, world) {
    e.x -= (world.stage.speed + e.drift) * dt;
    e.y = e.baseY + 6 * Math.sin(e.t * 0.8);
  },
};

export function updateEnemies(list, dt, world) {
  for (const e of list) {
    e.px = e.x;
    e.py = e.y;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    BEHAVIOUR[e.type](e, dt, world);
    const m = e.solid ? FLOE_R[e.variant] + 30 : 90;
    if (e.x < -m || e.y < -m || e.y > H + m) e.gone = true;
  }
}

function withFlash(ctx, spr, e, x = 0, y = 0) {
  stamp(ctx, spr.normal, x, y);
  if (e.flash > 0) {
    ctx.globalAlpha = 0.6;   // a quick white tint when hit
    stamp(ctx, spr.white, x, y);
    ctx.globalAlpha = 1;
  }
}

export function drawEnemies(ctx, list, a, art) {
  // big rocks first, so everything else draws over them
  for (const e of list) {
    if (e.type !== 'floe') continue;
    stamp(ctx, art.floes[e.variant], lerp(e.px, e.x, a), lerp(e.py, e.y, a));
  }
  for (const e of list) {
    if (e.type === 'floe') continue;
    const x = lerp(e.px, e.x, a);
    const y = lerp(e.py, e.y, a);
    ctx.save();
    ctx.translate(x, y);
    switch (e.type) {
      case 'turret': {
        ctx.save();
        ctx.rotate(e.aim);
        stamp(ctx, art.barrel, 10, 0);
        ctx.restore();
        if (e.side === 'ceiling') ctx.scale(1, -1);
        withFlash(ctx, art.turret, e, 0, 6);
        break;
      }
      case 'hatch': {
        if (e.side === 'ceiling') ctx.scale(1, -1);
        withFlash(ctx, art.hatch, e);
        if (e.open > 0) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = e.open;
          stamp(ctx, art.glowOrange, 0, -7, 40, 26);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
        }
        // the two door halves slide apart
        ctx.fillStyle = '#7564ad';
        const k = e.open * 12;
        ctx.fillRect(-13 - k, -10, 13, 7);
        ctx.fillRect(k, -10, 13, 7);
        break;
      }
      case 'shard':
        ctx.rotate(e.angle);
        withFlash(ctx, art.shards[e.size][e.id % 2], e);
        break;
      default: {
        if (e.angle) ctx.rotate(e.angle);
        withFlash(ctx, art.enemies[e.type] ?? art[e.type], e);
      }
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
