// The player's ship: movement, banking, engine flame, weapons,
// wingmen and shield. Upgrades come from the power-up meter.

import { W, H, PLAY, lerp, clamp } from './config.js';
import { stamp, SHIP_SCALE } from './art.js';

const BASE_SPEED = 270;     // pixels per second
const THRUST_STEP = 55;     // extra speed per Thrust level
export const MAX_THRUST = 4;
export const MAX_WINGMEN = 3;
export const SHIELD_MAX = 5;
export const HIT_R = 8;     // the ship's small, forgiving hit area
export const SHIELD_R = 48;

const FIRE_GAP = 0.1;       // seconds between shots while fire is held
const LANCE_GAP = 0.16;
const SEEKER_GAP = 0.6;
const SHOT_SPEED = 1500;
const FORK_ANGLE = 0.3;     // radians
const LANCE_HALF = 70;      // half the beam's length
const TRAIL_GAP = 13;       // path steps between each wingman

const NOSE_X = 40 * SHIP_SCALE;
const NOSE_Y = 2 * SHIP_SCALE;
const TAIL_X = -41 * SHIP_SCALE;

export class Player {
  constructor(art, fx, sound) {
    this.art = art;
    this.fx = fx;
    this.sound = sound;
    this.shots = [];
    this.t = 0;
    this.reset();
  }

  // fresh ship for a new game
  reset() {
    this.thrust = 0;
    this.seekers = false;
    this.gun = 'main';       // 'main' | 'fork' | 'lance'
    this.wingmen = [];
    this.shieldHP = 0;
    this.shots = [];
    this.spawn();
  }

  // place the ship at the start (new game or after losing a life)
  spawn() {
    this.x = this.px = 200;
    this.y = this.py = (PLAY.top + PLAY.bottom) / 2;
    this.vx = 0;
    this.vy = 0;
    this.bank = 0;
    this.cool = 0;
    this.seekCool = 0;
    this.flash = 0;
    this.shieldFlash = 0;
    this.shieldCool = 0;
    this.alive = true;
    this.invuln = 2.2;
    this.history = [];
    for (const w of this.wingmen) {
      w.x = w.px = this.x;
      w.y = w.py = this.y;
    }
  }

  get speed() {
    return BASE_SPEED + this.thrust * THRUST_STEP;
  }

  // Losing a life loses the upgrades, but one wingman stays,
  // so a comeback is still possible.
  loseUpgrades() {
    this.thrust = 0;
    this.seekers = false;
    this.gun = 'main';
    this.shieldHP = 0;
    this.wingmen = this.wingmen.slice(0, 1);
  }

  apply(key) {
    switch (key) {
      case 'thrust': this.thrust = Math.min(MAX_THRUST, this.thrust + 1); break;
      case 'seekers': this.seekers = true; break;
      case 'fork': this.gun = 'fork'; break;
      case 'lance': this.gun = 'lance'; break;
      case 'wingman':
        if (this.wingmen.length < MAX_WINGMEN) {
          this.wingmen.push({ x: this.x, y: this.y, px: this.x, py: this.y });
        }
        break;
      case 'aegis': this.shieldHP = SHIELD_MAX; break;
    }
  }

  // The shield took a hit. A short cooldown stops one big enemy
  // draining it all at once.
  shieldHit() {
    this.shieldFlash = 0.15;
    if (this.shieldCool > 0) return;
    this.shieldHP--;
    this.shieldCool = 0.25;
  }

  update(dt, input, world) {
    this.t += dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.shieldFlash = Math.max(0, this.shieldFlash - dt);
    this.shieldCool = Math.max(0, this.shieldCool - dt);
    this.updateShots(dt, world);
    if (!this.alive) return;

    this.px = this.x;
    this.py = this.y;

    // which way the player is pushing
    let ix = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    let iy = (input.isDown('down') ? 1 : 0) - (input.isDown('up') ? 1 : 0);
    if (ix && iy) { ix *= Math.SQRT1_2; iy *= Math.SQRT1_2; }

    // ease the velocity toward the target: responsive but not twitchy
    const k = 1 - Math.exp(-dt * 22);
    this.vx += (ix * this.speed - this.vx) * k;
    this.vy += (iy * this.speed - this.vy) * k;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const nx = clamp(this.x, PLAY.left + 40, PLAY.right - 40);
    const ny = clamp(this.y, PLAY.top + 16, PLAY.bottom - 16);
    if (nx !== this.x) this.vx = 0;
    if (ny !== this.y) this.vy = 0;
    this.x = nx;
    this.y = ny;

    this.bank += (iy - this.bank) * (1 - Math.exp(-dt * 9));

    // Wingmen trace the ship's path. The path only grows while the
    // ship moves, so they bunch up behind it when it stops.
    const last = this.history[this.history.length - 1];
    if (!last || Math.abs(last.x - this.x) + Math.abs(last.y - this.y) > 0.5) {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > (MAX_WINGMEN + 1) * TRAIL_GAP) this.history.shift();
    }
    this.wingmen.forEach((w, i) => {
      w.px = w.x;
      w.py = w.y;
      const h = this.history[Math.max(0, this.history.length - 1 - (i + 1) * TRAIL_GAP)];
      if (h) { w.x = h.x; w.y = h.y; }
    });

    // weapons
    this.cool -= dt;
    this.seekCool -= dt;
    if (input.isDown('fire')) {
      if (this.cool <= 0) {
        this.fireGuns();
        this.cool = this.gun === 'lance' ? LANCE_GAP : FIRE_GAP;
      }
      if (this.seekers && this.seekCool <= 0) {
        this.fireSeekers();
        this.seekCool = SEEKER_GAP;
      }
    }

    this.trail();
  }

  // the ship plus every wingman: they all fire together
  sources() {
    return [
      { x: this.x + NOSE_X, y: this.y + NOSE_Y },
      ...this.wingmen.map((w) => ({ x: w.x + 12, y: w.y })),
    ];
  }

  addShot(s) {
    s.px = s.x;
    s.py = s.y;
    this.shots.push(s);
  }

  fireGuns() {
    this.sound.play(this.gun === 'lance' ? 'lance' : 'shot');
    for (const { x, y } of this.sources()) {
      if (this.gun === 'lance') {
        this.addShot({ kind: 'lance', x: x + LANCE_HALF, y, vx: 1700, vy: 0, dmg: 1, hit: new Set(), half: LANCE_HALF });
        continue;
      }
      this.addShot({ kind: 'shot', x, y, vx: SHOT_SPEED, vy: 0, dmg: 1 });
      if (this.gun === 'fork') {
        for (const sgn of [-1, 1]) {
          const a = sgn * FORK_ANGLE;
          this.addShot({ kind: 'fork', x, y, vx: Math.cos(a) * 1350, vy: Math.sin(a) * 1350, dmg: 1, angle: a });
        }
      }
    }
    this.flash = 0.07;
    const nx = this.x + NOSE_X;
    const ny = this.y + NOSE_Y;
    for (let i = 0; i < 3; i++) {
      this.fx.add({
        x: nx, y: ny,
        vx: 250 + Math.random() * 350,
        vy: (Math.random() - 0.5) * 260,
        life: 0.12 + Math.random() * 0.1,
        size: 6 + Math.random() * 6,
        drag: 8,
        sprite: this.art.glowBlue,
      });
    }
  }

  fireSeekers() {
    this.sound.play('seeker');
    for (const { x, y } of this.sources()) {
      this.addShot({ kind: 'seeker', x: x - 20, y: y + 10, vx: 160, vy: 190, dmg: 2, life: 2.4 });
    }
  }

  updateShots(dt, world) {
    for (const s of this.shots) {
      s.px = s.x;
      s.py = s.y;
      if (s.kind === 'seeker') this.steer(s, dt, world.enemies);
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.shots = this.shots.filter(
      (s) => !s.dead && s.x < W + 160 && s.x > -60 && s.y > -40 && s.y < H + 40,
    );
  }

  // Seekers turn toward the nearest enemy ahead of them.
  steer(s, dt, enemies) {
    s.life -= dt;
    if (s.life <= 0) { s.dead = true; return; }
    let best = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (e.dead || e.x > W + 10 || e.x < s.x - 40) continue;
      const d = (e.x - s.x) ** 2 + (e.y - s.y) ** 2;
      if (d < bestD) { bestD = d; best = e; }
    }
    const a = Math.atan2(s.vy, s.vx);
    const want = best ? Math.atan2(best.y - s.y, best.x - s.x) : 0;
    const diff = ((want - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const turn = 6 * dt;
    const na = a + clamp(diff, -turn, turn);
    const sp = Math.min(700, Math.hypot(s.vx, s.vy) + 900 * dt);
    s.vx = Math.cos(na) * sp;
    s.vy = Math.sin(na) * sp;
    this.fx.add({
      x: s.x - Math.cos(na) * 10,
      y: s.y - Math.sin(na) * 10,
      vx: -Math.cos(na) * 60,
      vy: -Math.sin(na) * 60,
      life: 0.22,
      size: 9,
      alpha: 0.6,
      sprite: this.art.glowOrange,
    });
  }

  // engine exhaust drifting off behind the ship
  trail() {
    const thrust = 0.6 + 0.4 * Math.max(0, this.vx / this.speed);
    for (let i = 0; i < 2; i++) {
      this.fx.add({
        x: this.x + TAIL_X - 6,
        y: this.y + (Math.random() - 0.5) * 6,
        vx: -260 - Math.random() * 180 * thrust + this.vx * 0.2,
        vy: (Math.random() - 0.5) * 40 + this.vy * 0.1,
        life: 0.18 + Math.random() * 0.18,
        size: 9 + Math.random() * 8 * thrust,
        drag: 3,
        alpha: 0.5,
        sprite: this.art.glowBlue,
      });
    }
  }

  drawShots(ctx, a) {
    const art = this.art;
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shots) {
      const x = lerp(s.px, s.x, a);
      const y = lerp(s.py, s.y, a);
      if (s.kind === 'shot') {
        stamp(ctx, art.shot, x, y);
      } else if (s.kind === 'lance') {
        stamp(ctx, art.lance, x, y);
      } else {
        const ang = s.kind === 'fork' ? s.angle : Math.atan2(s.vy, s.vx);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        if (s.kind === 'fork') stamp(ctx, art.shot, 0, 0);
        else {
          ctx.globalCompositeOperation = 'source-over';
          stamp(ctx, art.seeker, 0, 0);
        }
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  draw(ctx, a) {
    if (!this.alive) return;
    const art = this.art;
    const x = lerp(this.px, this.x, a);
    const y = lerp(this.py, this.y, a);

    // wingmen
    ctx.globalCompositeOperation = 'lighter';
    this.wingmen.forEach((w, i) => {
      const wx = lerp(w.px, w.x, a);
      const wy = lerp(w.py, w.y, a);
      stamp(ctx, art.wingman, wx, wy);
      ctx.beginPath();
      ctx.ellipse(wx, wy, 15, 5.5, this.t * 2.2 + i * 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(150,220,255,0.55)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    // engine flame: flickers, and stretches when pushing forward
    const push = this.vx / this.speed; // -1..1
    const len = 34 + 16 * push + 6 * Math.sin(this.t * 53) + 4 * Math.sin(this.t * 31);
    ctx.drawImage(art.flame.img, x + TAIL_X - len + 2, y - 8, len, 16);
    stamp(ctx, art.glowBlue, x + TAIL_X, y, 30, 30);
    ctx.globalCompositeOperation = 'source-over';

    // blink while protected after coming back
    const blink = this.invuln > 0 && Math.floor(this.t * 14) % 2 === 0;
    if (!blink) {
      // ship body, tilted and squashed a little to look like it banks
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.bank * 0.09);
      ctx.scale(1, 1 - Math.abs(this.bank) * 0.14);
      stamp(ctx, art.ship, 0, 0);
      ctx.restore();
    }

    ctx.globalCompositeOperation = 'lighter';
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash / 0.07;
      stamp(ctx, art.glowWhite, x + NOSE_X + 4, y + NOSE_Y, 34, 26);
      ctx.globalAlpha = 1;
    }

    // Aegis: a curved energy screen in front of the ship
    if (this.shieldHP > 0) {
      const k = this.shieldHP / SHIELD_MAX;
      const flick = 0.8 + 0.2 * Math.sin(this.t * 20);
      const rgb = this.shieldFlash > 0 ? '255,255,255' : '110,220,255';
      ctx.lineCap = 'round';
      for (const [w, al] of [[12, 0.15], [5, 0.4], [1.6, 0.95]]) {
        ctx.beginPath();
        ctx.arc(x + 4, y, SHIELD_R - 2, -1.15, 1.15);
        ctx.strokeStyle = `rgba(${rgb},${al * (0.35 + 0.65 * k) * flick})`;
        ctx.lineWidth = w;
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
