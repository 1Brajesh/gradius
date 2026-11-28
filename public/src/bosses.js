// The two bosses of Stage 1. Each one:
//   update(dt, game)   moves and attacks
//   shotHit(x, y)      what a player shot at (x, y) hits: 'core', 'block' or null
//   touches(x, y)      does the player's ship at (x, y) crash into it
//   draw(ctx, a, art)
// Only the glowing core can be damaged. When hp runs out the boss
// breaks apart over a couple of seconds, then sets `done`.

import { W, PLAY, lerp, clamp } from './config.js';
import { stamp, RIG, LH } from './art.js';
import { explode, bigExplode, sparks } from './fx.js';

const MID = (PLAY.top + PLAY.bottom) / 2;
const ease = (t) => 1 - (1 - t) ** 3;
const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;

// distance from point (px, py) to the segment a-b
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

class Boss {
  constructor(game, hp, score, name) {
    this.game = game;
    this.hp = this.hpMax = hp;
    this.score = score;
    this.name = name;
    this.t = 0;
    this.flash = 0;
    this.dying = 0;       // seconds since it was destroyed (0 = still fighting)
    this.boomT = 0;
    this.done = false;
    this.gone = false;    // gun pods anchored to the boss watch this
  }

  damage(dmg, x, y) {
    if (this.hp <= 0) return;
    this.hp -= dmg;
    this.flash = 0.06;
    sparks(this.game.fx, this.game.art, x, y, 4, this.game.art.glowAmber);
    if (this.hp <= 0) this.die();
    else this.game.sound.play('hit');
  }

  die() {
    const g = this.game;
    this.dying = 0.001;
    this.beam = null;   // a beam mid-fire shouldn't hang in the air while it breaks up
    g.addScore(this.score);
    g.popup(`+${this.score}`, this.core.x, this.core.y - 50);
    for (const s of g.enemyShots) s.dead = true;
    for (const e of g.enemies) if (e.anchor === this) g.kill(e);
    g.shake.add(0.6);
    g.sound.play('boom', 2.5);
  }

  // a string of explosions across the body, then one huge one
  updateDeath(dt, points, length) {
    const g = this.game;
    this.dying += dt;
    this.boomT -= dt;
    if (this.boomT <= 0 && this.dying < length) {
      this.boomT = 0.11;
      const [ox, oy] = points[Math.floor(Math.random() * points.length)];
      const x = this.x + ox + (Math.random() - 0.5) * 50;
      const y = this.y + oy + (Math.random() - 0.5) * 50;
      explode(g.fx, g.art, x, y, 1 + Math.random() * 0.8);
      g.shake.add(0.12);
      g.sound.play('boom', 1.2);
    }
    if (this.dying >= length && !this.done) {
      bigExplode(g.fx, g.art, this.core.x, this.core.y, 4);
      g.fx.ring(this.core.x, this.core.y, 30, 420, 1.1, '255,230,180');
      g.whiteFlash = 1;
      g.shake.add(1);
      g.freeze = 0.14;
      g.sound.play('death');
      this.done = true;
      this.gone = true;
      g.onBossDefeated(this);
    }
  }
}

// ---------------------------------------------------------------
// Mid-boss: a mining rig. Its drill arm sweeps underneath it, it
// throws bursts of rock, and the reactor on its front is the weak spot.
export class MiningRig extends Boss {
  constructor(game) {
    super(game, 180, 5000, 'MINING RIG');
    this.x = this.px = W + 190;
    this.y = this.py = MID - 70;
    this.armPhase = 0;
    this.arm = this.parm = 0.5;
    this.burst = 3.5;
    this.coreShot = 2;
    this.leaveAt = 42;   // flies off if you take too long
  }

  get core() {
    return { x: this.x + RIG.core[0], y: this.y + RIG.core[1], r: 24 };
  }

  armPoints(x = this.x, y = this.y, arm = this.arm) {
    const px = x + RIG.pivot[0];
    const py = y + RIG.pivot[1];
    const dx = -Math.sin(arm);
    const dy = Math.cos(arm);
    return {
      px, py,
      tx: px + dx * RIG.arm,
      ty: py + dy * RIG.arm,
      bx: px + dx * (RIG.arm + 16),   // centre of the drill bit
      by: py + dy * (RIG.arm + 16),
    };
  }

  update(dt, g) {
    this.px = this.x;
    this.py = this.y;
    this.parm = this.arm;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.armPhase += dt * (this.hp < this.hpMax / 2 ? 1.6 : 1);
    this.arm = 0.5 + 0.8 * Math.sin(this.armPhase);

    if (this.dying) {
      this.y += 30 * dt; // sinks as it breaks up
      this.updateDeath(dt, [[-90, 0], [-20, -30], [60, -20], [100, 20], [0, 30], [-40, -70]], 2.2);
      return;
    }

    if (this.t < 2.6) {
      this.x = lerp(W + 190, W - 250, ease(this.t / 2.6));
    } else if (this.t > this.leaveAt) {
      this.x += 170 * dt;
      this.y -= 50 * dt;
      if (this.x > W + 240) {
        this.done = true;
        this.gone = true;
        g.onBossLeft(this);
      }
      return;
    }

    // drift toward the player's height, slowly
    const ty = clamp(g.player.y - 40, PLAY.top + 100, PLAY.bottom - 220);
    this.y += (ty - this.y) * (1 - Math.exp(-dt * 0.7));

    if (this.t < 3.2) return;
    const angry = this.hp < this.hpMax / 2;

    // bursts of rock thrown up and forward
    this.burst -= dt;
    if (this.burst <= 0) {
      this.burst = angry ? 2.2 : 3.2;
      const cx = this.x - 118;
      const cy = this.y + 28;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI + 0.12 + i * 0.13 + (Math.random() - 0.5) * 0.06;
        const sp = 230 + Math.random() * 90;
        g.spawn('pebble', { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: (Math.random() - 0.5) * 6 });
      }
      g.shake.add(0.15);
      g.sound.play('rocks');
    }

    // when badly hurt, the reactor fires back
    if (angry) {
      this.coreShot -= dt;
      if (this.coreShot <= 0) {
        this.coreShot = 1.4;
        const c = this.core;
        const a = Math.atan2(g.player.y - c.y, g.player.x - c.x);
        for (const d of [-0.16, 0, 0.16]) g.enemyShot(c.x - 20, c.y, a + d, 250);
      }
      if (Math.random() < dt * 10) {
        g.fx.add({
          x: this.x + (Math.random() - 0.3) * 200,
          y: this.y - 40 + (Math.random() - 0.5) * 40,
          vx: -60, vy: -40 - Math.random() * 40,
          life: 0.8, size: 26, grow: 1, alpha: 0.5,
          sprite: g.art.glowOrange,
        });
      }
    }
  }

  inHull(x, y) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (dx < -126 || dx > 146 || dy < -86 || dy > 50) return false;
    if (dy < -48) return dx > -22 && dx < 102; // the cabin and stacks
    return true;
  }

  nearArm(x, y, pad) {
    const a = this.armPoints();
    return segDist(x, y, a.px, a.py, a.tx, a.ty) < 8 + pad || dist2(x, y, a.bx, a.by) < (16 + pad) ** 2;
  }

  shotHit(x, y) {
    if (this.dying) return null;
    const c = this.core;
    if (dist2(x, y, c.x, c.y) < (c.r + 4) ** 2) return 'core';
    if (this.inHull(x, y) || this.nearArm(x, y, 2)) return 'block';
    return null;
  }

  touches(x, y) {
    if (this.dying) return false;
    return this.inHull(x - 26, y) || this.inHull(x + 30, y) || this.nearArm(x, y, 7);
  }

  draw(ctx, a, art) {
    const x = lerp(this.px, this.x, a);
    const y = lerp(this.py, this.y, a);
    const arm = this.armPoints(x, y, lerp(this.parm, this.arm, a));

    // engine glow at the back
    ctx.globalCompositeOperation = 'lighter';
    stamp(ctx, art.glowOrange, x + 152, y, 70 + 10 * Math.sin(this.t * 30), 40);
    ctx.globalCompositeOperation = 'source-over';

    // drill arm, behind the hull
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(arm.px, arm.py);
    ctx.lineTo(arm.tx, arm.ty);
    ctx.strokeStyle = '#1c1f2a';
    ctx.lineWidth = 19;
    ctx.stroke();
    ctx.strokeStyle = '#9aa3b8';
    ctx.lineWidth = 13;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    // hydraulic piston alongside
    const mx = lerp(arm.px, arm.tx, 0.55);
    const my = lerp(arm.py, arm.ty, 0.55);
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 50);
    ctx.lineTo(mx + 8, my);
    ctx.strokeStyle = '#e0a830';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.save();
    ctx.translate(arm.bx, arm.by);
    ctx.rotate(lerp(this.parm, this.arm, a));
    stamp(ctx, art.drill[Math.floor(this.t * 24) % 2], 0, 0);
    ctx.restore();

    stamp(ctx, art.rig.normal, x, y);
    if (this.flash > 0) {
      ctx.globalAlpha = 0.35;
      stamp(ctx, art.rig.white, x, y);
      ctx.globalAlpha = 1;
    }

    // reactor core: pulses, and flashes white when hit
    const cx = x + RIG.core[0];
    const cy = y + RIG.core[1];
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 5);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 + 0.3 * pulse;
    stamp(ctx, art.glowOrange, cx, cy, 90 + 20 * pulse, 90 + 20 * pulse);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    stamp(ctx, art.rigCore, cx, cy);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      stamp(ctx, art.glowWhite, cx, cy, 70, 70);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// ---------------------------------------------------------------
// Stage boss: the Lighthouse. Four shutters spin around its lamp; shoot
// the lamp through the gaps. It gets more dangerous as it weakens.
export class Lighthouse extends Boss {
  constructor(game) {
    super(game, 150, 20000, 'THE LIGHTHOUSE');
    this.x = this.px = W + 230;
    this.y = this.py = MID;
    this.rot = 0;
    this.spin = 0;
    this.spinDir = 1;
    this.flipT = 3;
    this.bob = 0;
    this.volley = 2.5;
    this.beam = null;
    this.beamT = 2;
    this.spiralA = Math.PI;
    this.spiralT = 0;
    this.phaseSeen = 1;
    // gun pods on ledges near the top and bottom
    game.spawn('turret', { side: 'floor', anchor: this, ox: -49, oy: -224, hp: 10, score: 1000 });
    game.spawn('turret', { side: 'ceiling', anchor: this, ox: -49, oy: 224, hp: 10, score: 1000 });
  }

  get core() {
    return { x: this.x, y: this.y, r: LH.core };
  }

  get phase() {
    const f = this.hp / this.hpMax;
    return f > 0.66 ? 1 : f > 0.33 ? 2 : 3;
  }

  // is this angle (seen from the lamp) covered by a shutter?
  covered(angle) {
    const q = Math.PI / 2;
    const rel = (((angle - this.rot) % q) + q) % q;
    return rel < LH.plate;
  }

  gapAngles() {
    const out = [];
    for (let k = 0; k < 4; k++) out.push(this.rot + k * (Math.PI / 2) + LH.plate + Math.PI / 12);
    return out;
  }

  update(dt, g) {
    this.px = this.x;
    this.py = this.y;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.rot += this.spin * dt;

    if (this.dying) {
      this.spin *= Math.exp(-dt);
      this.updateDeath(dt, [[0, 0], [0, -150], [0, 150], [0, -250], [0, 250], [80, -160], [80, 160]], 2.8);
      return;
    }

    if (this.t < 3) this.x = lerp(W + 230, W - 215, ease(this.t / 3));

    const ph = this.phase;
    if (ph !== this.phaseSeen) {
      this.phaseSeen = ph;
      g.fx.ring(this.x, this.y, 40, 260, 0.6, '255,210,140');
      if (ph > 1) g.shake.add(0.45);
      g.sound.play('phase');
    }

    this.bob += dt * (ph === 3 ? 0.85 : 0.5);
    this.y = MID + (ph === 3 ? 85 : 45) * Math.sin(this.bob);

    if (ph === 3) {
      this.flipT -= dt;
      if (this.flipT <= 0) {
        this.flipT = 2.2 + Math.random() * 1.6;
        this.spinDir *= -1;
      }
    }
    const want = (ph === 1 ? 0.7 : ph === 2 ? 1.0 : 1.5) * this.spinDir;
    this.spin += (want - this.spin) * (1 - Math.exp(-dt * 2));

    if (this.t < 3.6) return;
    const p = g.player;

    // shots out through the gaps that face the player's side
    this.volley -= dt;
    if (this.volley <= 0) {
      this.volley = ph === 1 ? 1.5 : 2.1;
      for (const a of this.gapAngles()) {
        if (Math.cos(a) < -0.1) g.enemyShot(this.x + Math.cos(a) * (LH.R + 14), this.y + Math.sin(a) * (LH.R + 14), a, 220);
      }
    }

    // the lamp beam: a warning line, then a deadly beam along it
    if (ph >= 2) {
      if (!this.beam) {
        this.beamT -= dt;
        if (this.beamT <= 0) {
          let a = Math.atan2(p.y - this.y, p.x - this.x);
          if (a < 0) a += Math.PI * 2;
          this.beam = { a: clamp(a, Math.PI * 0.62, Math.PI * 1.38), t: 0, fired: false };
          g.sound.play('charge');
        }
      } else {
        const b = this.beam;
        b.t += dt;
        if (b.t > 1.0 && !b.fired) {
          b.fired = true;
          g.shake.add(0.5);
          g.sound.play('laser');
        }
        if (this.beamActive()) g.shake.hold(0.38); // the beam rumbles while it fires
        if (b.t > 1.75) {
          this.beam = null;
          this.beamT = ph === 3 ? 4.2 : 5.2;
        }
      }
    }

    // a spiral of shots in the last phase
    if (ph === 3) {
      this.spiralT -= dt;
      if (this.spiralT <= 0) {
        this.spiralT = 0.1;
        this.spiralA += 0.43;
        const a = this.spiralA;
        if (Math.cos(a) < 0.25) g.enemyShot(this.x + Math.cos(a) * 36, this.y + Math.sin(a) * 36, a, 190);
      }
    }
  }

  beamActive() {
    return this.beam && this.beam.fired && this.beam.t < 1.7;
  }

  beamHits(x, y) {
    if (!this.beamActive()) return false;
    const dx = Math.cos(this.beam.a);
    const dy = Math.sin(this.beam.a);
    const t = (x - this.x) * dx + (y - this.y) * dy;
    if (t < 0) return false;
    return Math.abs((x - this.x) * dy - (y - this.y) * dx) < 18;
  }

  inBody(x, y, pad = 0) {
    const dx = x - this.x;
    const dy = y - this.y;
    if (Math.abs(dx) < LH.towerW + pad && Math.abs(dy) < LH.towerH + pad) return true;
    // solar fins
    if (dx > 34 - pad && dx < 140 + pad && Math.abs(dy) > 105 - pad && Math.abs(dy) < 215 + pad) return true;
    return false;
  }

  shotHit(x, y) {
    if (this.dying) return null;
    const d = Math.sqrt(dist2(x, y, this.x, this.y));
    if (d < LH.core) return 'core';
    if (d < LH.R - 13) return null; // inside the shutter ring, flying at the lamp
    if (d <= LH.R + 13) return this.covered(Math.atan2(y - this.y, x - this.x)) ? 'block' : null;
    if (d > LH.housing && this.inBody(x, y)) return 'block';
    return null;
  }

  touches(x, y) {
    if (this.dying) return false;
    if (dist2(x, y, this.x, this.y) < (LH.R + 13 + 8) ** 2) return true;
    return this.inBody(x - 26, y, 6) || this.inBody(x + 30, y, 6);
  }

  draw(ctx, a, art) {
    const x = lerp(this.px, this.x, a);
    const y = lerp(this.py, this.y, a);

    stamp(ctx, art.lighthouse.normal, x, y);
    if (this.flash > 0) {
      ctx.globalAlpha = 0.25;
      stamp(ctx, art.lighthouse.white, x, y);
      ctx.globalAlpha = 1;
    }

    // the lamp
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 4);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.55 + 0.25 * pulse;
    stamp(ctx, art.glowAmber, x, y, 170 + 30 * pulse, 170 + 30 * pulse);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    stamp(ctx, art.lamp, x, y);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      stamp(ctx, art.glowWhite, x, y, 90, 90);
      ctx.globalCompositeOperation = 'source-over';
    }

    // the four spinning shutters
    ctx.lineCap = 'butt';
    for (let k = 0; k < 4; k++) {
      const a0 = this.rot + k * (Math.PI / 2);
      const a1 = a0 + LH.plate;
      ctx.beginPath();
      ctx.arc(x, y, LH.R, a0, a1);
      ctx.strokeStyle = '#151a2a';
      ctx.lineWidth = 28;
      ctx.stroke();
      ctx.strokeStyle = '#8d99b5';
      ctx.lineWidth = 22;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, LH.R + 7, a0 + 0.03, a1 - 0.03);
      ctx.strokeStyle = 'rgba(240,245,255,0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, LH.R - 6, a0 + 0.03, a1 - 0.03);
      ctx.strokeStyle = 'rgba(20,25,40,0.6)';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // the beam
    if (this.beam) {
      const b = this.beam;
      const ex = x + Math.cos(b.a) * 1700;
      const ey = y + Math.sin(b.a) * 1700;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(ex, ey);
      ctx.lineCap = 'round';
      if (!b.fired) {
        // warning: a thin flickering red line
        ctx.strokeStyle = `rgba(255,70,70,${0.35 + 0.35 * Math.sin(b.t * 40)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        const k = Math.min(1, (b.t - 1) / 0.08) * Math.min(1, (1.75 - b.t) / 0.2);
        for (const [w, col] of [[54, `rgba(255,190,90,${0.14 * k})`], [26, `rgba(255,220,150,${0.35 * k})`], [9, `rgba(255,255,240,${0.95 * k})`]]) {
          ctx.strokeStyle = col;
          ctx.lineWidth = w;
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
