// The player's ship: movement, banking, engine flame and the main gun.

import { W, H, PLAY, lerp, clamp } from './config.js';
import { stamp, SHIP_SCALE } from './art.js';

const BASE_SPEED = 330;   // pixels per second
const FIRE_GAP = 0.1;     // seconds between shots while fire is held
const SHOT_SPEED = 1500;
const NOSE_X = 40 * SHIP_SCALE;        // gun position relative to ship centre
const NOSE_Y = 2 * SHIP_SCALE;
const TAIL_X = -41 * SHIP_SCALE;       // engine position

export class Player {
  constructor(art, fx) {
    this.art = art;
    this.fx = fx;
    this.reset();
  }

  reset() {
    this.x = this.px = 230;
    this.y = this.py = H / 2 - 20;
    this.vx = 0;
    this.vy = 0;
    this.bank = 0;       // -1 climbing .. +1 diving, smoothed
    this.speed = BASE_SPEED;
    this.cool = 0;
    this.flash = 0;      // muzzle flash timer
    this.t = 0;
    this.shots = [];
  }

  update(dt, input) {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;

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

    // gun
    this.cool -= dt;
    if (input.isDown('fire') && this.cool <= 0) {
      this.fire();
      this.cool = FIRE_GAP;
    }
    this.flash = Math.max(0, this.flash - dt);

    for (const s of this.shots) {
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
    }
    this.shots = this.shots.filter((s) => s.x < W + 60);

    this.trail();
  }

  fire() {
    const x = this.x + NOSE_X;
    const y = this.y + NOSE_Y;
    this.shots.push({ x, y, px: x, py: y, vx: SHOT_SPEED });
    this.flash = 0.07;
    for (let i = 0; i < 3; i++) {
      this.fx.add({
        x, y,
        vx: 250 + Math.random() * 350,
        vy: (Math.random() - 0.5) * 260,
        life: 0.12 + Math.random() * 0.1,
        size: 6 + Math.random() * 6,
        drag: 8,
        sprite: this.art.glowBlue,
      });
    }
  }

  // engine exhaust particles drifting off behind the ship
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

  draw(ctx, a) {
    const art = this.art;
    const x = lerp(this.px, this.x, a);
    const y = lerp(this.py, this.y, a);

    ctx.globalCompositeOperation = 'lighter';

    for (const s of this.shots) {
      stamp(ctx, art.shot, lerp(s.px, s.x, a), s.y);
    }

    // engine flame: flickers, and stretches when pushing forward
    const push = this.vx / this.speed; // -1..1
    const len = 34 + 16 * push + 6 * Math.sin(this.t * 53) + 4 * Math.sin(this.t * 31);
    ctx.drawImage(art.flame.img, x + TAIL_X - len + 2, y - 8, len, 16);
    stamp(ctx, art.glowBlue, x + TAIL_X, y, 30, 30);

    ctx.globalCompositeOperation = 'source-over';

    // ship body, tilted and squashed a little to look like it banks
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.bank * 0.09);
    ctx.scale(1, 1 - Math.abs(this.bank) * 0.14);
    stamp(ctx, art.ship, 0, 0);
    ctx.restore();

    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = this.flash / 0.07;
      stamp(ctx, art.glowWhite, x + NOSE_X + 4, y + NOSE_Y, 34, 26);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
