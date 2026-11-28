// The game world: everything on screen, who hit whom, score, lives,
// and the flow between playing, losing a life and game over.

import { W, H, lerp } from './config.js';
import { stamp } from './art.js';
import { Background } from './background.js';
import { Player, HIT_R, SHIELD_R } from './player.js';
import { Particles, explode, sparks } from './fx.js';
import { Meter } from './powerups.js';
import { makeEnemy, updateEnemies, drawEnemies } from './enemies.js';
import { Stage } from './stage.js';
import { STAGE1 } from './stage1.js';
import { Terrain } from './terrain.js';
import { MiningRig, Lighthouse } from './bosses.js';
import * as ui from './ui.js';
import { SILENT } from './audio.js';

const START_SPARES = 2;        // extra ships besides the one you're flying
const CELL_PICKUP_R = 36;
const HI_KEY = 'starwake.hiscore';

function loadHi() {
  try { return Number(localStorage.getItem(HI_KEY)) || 0; } catch { return 0; }
}
function saveHi(n) {
  try { localStorage.setItem(HI_KEY, String(n)); } catch { /* private mode etc. */ }
}

export class Game {
  constructor(art, input, sound = SILENT) {
    this.art = art;
    this.input = input;
    this.sound = sound;
    this.fx = new Particles();
    this.bg = new Background(art);
    this.meter = new Meter();
    this.player = new Player(art, this.fx, sound);
    this.stage = new Stage(STAGE1);
    this.terrain = new Terrain(art, STAGE1.shape);
    this.hiscore = loadHi();
    this.time = 0;
    this.hint = 1;
    this.newGame();
  }

  newGame() {
    if (this.state === 'over') this.sound.startMusic();
    this.score = 0;
    this.spares = START_SPARES;
    this.enemies = [];
    this.enemyShots = [];
    this.cells = [];
    this.popups = [];
    this.state = 'play';       // 'play' | 'dead' | 'over'
    this.stateT = 0;
    this.newHigh = false;
    this.bannerInfo = null;
    this.boss = null;
    this.whiteFlash = 0;
    this.sound.setMood('stage');
    this.player.reset();
    this.meter.reset();
    this.stage.loops = 0;
    this.stage.reset();
  }

  // clear the screen of enemies and shots (used when restarting at a checkpoint)
  clearField() {
    this.enemies = [];
    this.enemyShots = [];
    this.cells = [];
    this.popups = [];
    this.player.shots = [];
  }

  // ----- things other parts of the game call -----
  spawn(type, props) {
    const e = makeEnemy(type, props);
    if (e.side && !e.anchor) {
      // stand it on the floor or hang it from the ceiling
      const w = this.stage.walls(e.x);
      const lift = e.type === 'hatch' ? 16 : 6;
      e.y = e.py = e.side === 'ceiling' ? w.top + lift : w.bot - lift;
    }
    this.enemies.push(e);
    return e;
  }

  banner(title, sub = '', small = false) {
    this.bannerInfo = { title, sub, small, t: 0 };
  }

  onCheckpoint() {
    this.banner('CHECKPOINT', '', true);
  }

  onLoop() {
    this.clearField();
    this.banner('STAGE 1', `LOOP ${this.stage.loops + 1}`);
  }

  // ----- bosses -----
  startBoss(kind) {
    this.stage.hold = true;
    if (kind === 'rig') {
      this.boss = new MiningRig(this);
      return;
    }
    // the stage boss gets a warning first
    this.banner('WARNING', 'Huge energy reading ahead', 'warn');
    this.sound.play('warning');
    this.sound.setMood('boss');
    this.stage.after(3, () => { this.boss = new Lighthouse(this); });
  }

  onBossDefeated(boss) {
    this.boss = null;
    if (boss instanceof MiningRig) {
      this.stage.hold = false;
      for (let i = 0; i < 3; i++) this.dropCell(boss.core.x + 40 * i, boss.core.y - 30 + 30 * i);
      return;
    }
    // stage clear!
    this.addScore(10000);
    this.sound.play('clear');
    this.stage.after(1.2, () => this.banner('STAGE CLEAR', 'Bonus +10,000'));
    this.stage.after(7, () => {
      this.stage.loop();
      this.sound.setMood('stage');
      this.onLoop();
    });
  }

  onBossLeft() {
    this.boss = null;
    this.stage.hold = false;
    this.banner('IT GOT AWAY', '', true);
  }

  enemyShot(x, y, angle, speed) {
    this.enemyShots.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
    this.sound.play('enemyShot');
  }

  popup(text, x, y, rgb = '255,220,140') {
    this.popups.push({ text, x, y, t: 0, rgb });
  }

  addScore(n) {
    this.score += n;
    if (this.score > this.hiscore) {
      this.hiscore = this.score;
      this.newHigh = true;
    }
  }

  // ----- each step -----
  update(dt) {
    const { input, player } = this;
    this.time += dt;
    this.stateT += dt;

    this.bg.update(dt, this.stage.skySpeed * 0.6);
    if (this.state !== 'over') this.stage.update(dt, this);
    if (this.boss) this.boss.update(dt, this);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 1.2);
    if (this.bannerInfo && (this.bannerInfo.t += dt) > 3.4) this.bannerInfo = null;

    if (input.take('power') && player.alive) {
      const slot = this.meter.take(player);
      if (slot) {
        this.popup(slot.label, player.x, player.y - 36, '150,230,255');
        this.fx.ring(player.x, player.y, 20, 70, 0.35, '150,230,255');
        this.sound.play('power');
      } else if (this.meter.cursor >= 0) {
        this.sound.play('deny');
      }
    }
    this.meter.update(dt);

    player.update(dt, input, this);
    updateEnemies(this.enemies, dt, this);

    for (const s of this.enemyShots) {
      s.px = s.x;
      s.py = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (const c of this.cells) {
      c.px = c.x;
      c.py = c.y;
      c.t += dt;
      c.x -= 45 * dt;
    }

    this.collide();

    this.enemies = this.enemies.filter((e) => !e.dead && !e.gone);
    this.enemyShots = this.enemyShots.filter(
      (s) => !s.dead && s.x > -30 && s.x < W + 30 && s.y > -30 && s.y < H + 30,
    );
    this.cells = this.cells.filter((c) => !c.taken && c.x > -30);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 1.1);
    this.fx.update(dt);

    // lose a life -> short pause -> next ship, or game over
    if (this.state === 'dead' && this.stateT > 2) {
      if (this.spares > 0) {
        this.spares--;
        if (this.boss) this.boss.gone = true;
        this.boss = null;
        this.sound.setMood('stage');
        this.stage.rewind();
        this.clearField();
        player.spawn();
        this.sound.play('respawn');
        this.state = 'play';
      } else {
        this.state = 'over';
        this.stateT = 0;
        saveHi(this.hiscore);
        input.clear();
        this.sound.play('gameover');
        this.sound.fadeMusic(0, 2);
      }
    }
    // a tap anywhere also restarts (and taps during play are just thrown away)
    const tap = input.take('tap');
    if (this.state === 'over' && this.stateT > 1.2 && (input.take('fire') || tap)) this.newGame();

    if (this.time > 8 || (input.touched && this.time > 4)) this.hint = Math.max(0, this.hint - dt * 1.5);
  }

  collide() {
    const p = this.player;

    // player shots -> walls
    for (const s of p.shots) {
      const hx = s.kind === 'lance' ? s.x + s.half : s.x;
      const w = this.stage.walls(hx);
      if (s.y < w.top || s.y > w.bot) {
        s.dead = true;
        sparks(this.fx, this.art, hx, s.y, 3, this.art.glowViolet);
      }
    }

    // player shots -> boss
    const boss = this.boss;
    if (boss) {
      for (const s of p.shots) {
        if (s.dead) continue;
        const hx = s.kind === 'lance' ? s.x + s.half : s.x;
        // check halfway along the last step too, so fast shots can't skip a shutter
        let hit = boss.shotHit(hx, s.y) ?? boss.shotHit((hx + s.px + (hx - s.x)) / 2, (s.y + s.py) / 2);
        if (!hit) continue;
        if (hit === 'core') {
          if (s.kind === 'lance') {
            if (s.hit.has('boss')) continue;
            s.hit.add('boss');
          } else {
            s.dead = true;
          }
          boss.damage(s.dmg, hx, s.y);
        } else {
          s.dead = true;
          sparks(this.fx, this.art, hx, s.y, 2, this.art.glowWhite);
        }
      }
    }

    // player shots -> enemies
    for (const s of p.shots) {
      if (s.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.solid) {
          // ice rocks stop shots (the Lance beam passes over them)
          if (s.kind !== 'lance' && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < e.r * e.r) {
            s.dead = true;
            sparks(this.fx, this.art, s.x, s.y, 3, this.art.glowCyan);
            break;
          }
          continue;
        }
        if (s.kind === 'lance') {
          // the beam passes through, hurting each enemy once
          if (s.hit.has(e.id)) continue;
          if (Math.abs(e.y - s.y) < e.r + 4 && e.x + e.r > s.x - s.half && e.x - e.r < s.x + s.half) {
            s.hit.add(e.id);
            this.damage(e, s.dmg, e.x - e.r * 0.6, s.y);
          }
        } else {
          const dx = e.x - s.x;
          const dy = e.y - s.y;
          const rr = e.r + 6;
          if (dx * dx + dy * dy < rr * rr) {
            s.dead = true;
            this.damage(e, s.dmg, s.x, s.y);
            break;
          }
        }
      }
    }

    // enemy shots -> walls and ice rocks
    for (const s of this.enemyShots) {
      const w = this.stage.walls(s.x);
      if (s.y < w.top || s.y > w.bot) s.dead = true;
      for (const e of this.enemies) {
        if (e.solid && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 < e.r * e.r) s.dead = true;
      }
    }

    if (!p.alive) return;

    // the ship against walls: check a few points along its length
    for (const ox of [-30, -10, 12, 36]) {
      const w = this.stage.walls(p.x + ox);
      if (p.y - 7 < w.top || p.y + 7 > w.bot) {
        this.hitPlayer();
        if (!p.alive) return;
      }
    }

    // the boss's body and beam
    if (boss && (boss.touches(p.x, p.y) || (boss.beamHits && boss.beamHits(p.x, p.y)))) {
      this.hitPlayer();
      if (!p.alive) return;
    }

    // enemy shots -> player (the shield catches them from the front)
    for (const s of this.enemyShots) {
      if (s.dead) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (p.shieldHP > 0 && dx > -6 && d2 < SHIELD_R * SHIELD_R) {
        s.dead = true;
        p.shieldHit();
        this.sound.play('shield');
        sparks(this.fx, this.art, s.x, s.y, 5, this.art.glowBlue);
        continue;
      }
      if (d2 < (HIT_R + 5) ** 2) {
        s.dead = true;
        this.hitPlayer();
        if (!p.alive) return;
      }
    }

    // enemies ramming the player
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (e.solid) {
        // ice rocks: the shield doesn't help here
        if (d2 < (e.r + HIT_R * 0.5) ** 2) {
          this.hitPlayer();
          if (!p.alive) return;
        }
        continue;
      }
      if (p.shieldHP > 0 && dx > -6 && d2 < (SHIELD_R + e.r * 0.6) ** 2) {
        p.shieldHit();
        this.sound.play('shield');
        this.damage(e, 3, e.x - e.r, e.y);
        continue;
      }
      if (d2 < (HIT_R + e.r * 0.85) ** 2) {
        this.damage(e, 4, e.x, e.y);
        this.hitPlayer();
        if (!p.alive) return;
      }
    }

    // energy cells
    for (const c of this.cells) {
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < CELL_PICKUP_R ** 2) {
        c.taken = true;
        this.meter.advance();
        this.addScore(50);
        this.sound.play('cell');
        sparks(this.fx, this.art, c.x, c.y, 8, this.art.glowAmber);
        this.fx.ring(c.x, c.y, 6, 40, 0.3, '255,210,120');
      }
    }
  }

  damage(e, dmg, hx, hy) {
    e.hp -= dmg;
    e.flash = 0.07;
    sparks(this.fx, this.art, hx, hy, 3);
    if (e.hp <= 0) this.kill(e);
    else this.sound.play('hit');
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.addScore(e.score);
    explode(this.fx, this.art, e.x, e.y, e.boom);
    this.sound.play('boom', e.boom);
    if (e.drops) this.dropCell(e.x, e.y);
    if (e.type === 'shard' && e.size === 3) {
      // big ice breaks into three smaller pieces
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + Math.random();
        this.spawn('shard', {
          size: 2,
          x: e.x,
          y: e.y,
          vx: e.vx + Math.cos(a) * 110,
          vy: Math.sin(a) * 110,
          spin: (Math.random() - 0.5) * 3,
        });
      }
    }
    if (e.group && ++e.group.killed === e.group.total) {
      this.dropCell(e.x, e.y);
      this.popup('+' + 500, e.x, e.y - 24);
      this.addScore(500);
      this.sound.play('bonus');
    }
  }

  dropCell(x, y) {
    this.cells.push({ x, y, px: x, py: y, t: 0 });
  }

  hitPlayer() {
    const p = this.player;
    if (!p.alive || p.invuln > 0) return;
    p.alive = false;
    explode(this.fx, this.art, p.x, p.y, 2.2);
    this.fx.ring(p.x, p.y, 20, 180, 0.7, '150,220,255');
    this.sound.play('death');
    this.sound.duck();
    p.loseUpgrades();
    this.meter.reset();
    this.state = 'dead';
    this.stateT = 0;
  }

  // ----- drawing -----
  draw(ctx, a) {
    const art = this.art;
    const pos = lerp(this.stage.ppos, this.stage.pos, a);
    this.bg.draw(ctx, a, this.stage.tint());
    this.terrain.draw(ctx, pos, this.time);

    // energy cells: spin and pulse
    for (const c of this.cells) {
      const x = lerp(c.px, c.x, a);
      const y = lerp(c.py, c.y, a);
      const s = 1 + 0.1 * Math.sin(c.t * 7);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(c.t * 1.8);
      stamp(ctx, art.cell, 0, 0, art.cell.w * s, art.cell.h * s);
      ctx.restore();
    }

    if (this.boss) this.boss.draw(ctx, a, art);
    drawEnemies(ctx, this.enemies, a, art);

    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.enemyShots) stamp(ctx, art.enemyShot, lerp(s.px, s.x, a), lerp(s.py, s.y, a));
    ctx.globalCompositeOperation = 'source-over';

    this.player.drawShots(ctx, a);
    this.fx.draw(ctx, a);
    this.player.draw(ctx, a);

    const touch = !!this.input.touchMode;
    ui.drawPopups(ctx, this.popups, touch);
    if (this.bannerInfo) ui.drawBanner(ctx, this.bannerInfo);
    stamp(ctx, art.vignette, W / 2, H / 2);
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,250,235,${0.85 * this.whiteFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
    ui.drawHud(ctx, this);
    if (this.boss && !this.boss.dying && this.boss.t > 1) ui.drawBossBar(ctx, this.boss, touch);
    if (this.sound.muted) ui.drawMuted(ctx, touch);
    ui.drawHint(ctx, this.hint, touch);
    if (this.state === 'over') ui.drawGameOver(ctx, this);
  }
}
