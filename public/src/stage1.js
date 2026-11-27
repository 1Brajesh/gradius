// Stage 1: "Halo Drift". About four minutes long.
//
//   0:00  Open space        fighters, past a ringed planet
//   0:45  Ice ring field    drifting ice shards and big ice rocks with turrets
//   1:40  CHECKPOINT        then the Mining Rig (mid-boss) and a wave of fighters
//   2:03  Crystal canyon    walls above and below, turrets and hatches
//   3:15  CHECKPOINT        then a high-speed run through a narrowing tunnel
//   end   CHECKPOINT        then the Lighthouse (stage boss)
//
// Everything is placed by distance travelled. At normal speed the stage
// moves 150 pixels per second, so T(sec) means "this many seconds in".

import { W, H, PLAY, lerp } from './config.js';
import { FLOE_R } from './art.js';

const BASE = 150;
const FAST = 330;
const T = (sec) => sec * BASE;
const MID = (PLAY.top + PLAY.bottom) / 2;
const at = (frac) => PLAY.top + (PLAY.bottom - PLAY.top) * frac;

const ICE0 = T(45);
const CP1 = T(100);
const C0 = T(123);              // canyon walls start rising
const CP2 = T(195);
const TUN0 = T(198);            // tunnel begins
const TUN1 = TUN0 + 11500;      // tunnel ends
const CP3 = TUN1 + 1400;        // just before the boss

const smooth = (a, b, d) => {
  const t = Math.min(1, Math.max(0, (d - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// smooth bumpy value in -1..1, different for each (a, b, c)
const bumpy = (d, a, b, c) =>
  0.5 * Math.sin(d / 310 + a) + 0.3 * Math.sin(d / 127 + b) + 0.2 * Math.sin(d / 53 + c);

// ----- walls -----
function shape(d) {
  let top = -60;
  let bot = H + 60;
  const canyon = smooth(C0, C0 + 900, d) * (1 - smooth(TUN0, TUN0 + 900, d));
  if (canyon > 0) {
    top = Math.max(top, lerp(-60, 118 + 48 * bumpy(d, 1, 2, 3) + 5 * Math.sin(d / 11), canyon));
    bot = Math.min(bot, lerp(H + 60, PLAY.bottom - 96 - 48 * bumpy(d, 4, 5, 6) - 5 * Math.sin(d / 13), canyon));
  }
  const tunnel = smooth(TUN0, TUN0 + 900, d) * (1 - smooth(TUN1, TUN1 + 1200, d));
  if (tunnel > 0) {
    const c = tunnelCentre(d);
    const gap = tunnelGap(d);
    top = Math.max(top, lerp(-60, c - gap / 2 + 5 * Math.sin(d / 9), tunnel));
    bot = Math.min(bot, lerp(H + 60, c + gap / 2 + 5 * Math.sin(d / 10), tunnel));
  }
  return { top, bot };
}
function tunnelCentre(d) {
  const k = smooth(TUN0, TUN1, d);
  return MID + (60 + 70 * k) * Math.sin((d - TUN0) / 650);
}
function tunnelGap(d) {
  return lerp(430, 235, smooth(TUN0, TUN1, d));
}

function speedAt(d) {
  return lerp(BASE, FAST, smooth(TUN0 - 600, TUN0 + 300, d) * (1 - smooth(TUN1, TUN1 + 1500, d)));
}

// ----- background colour wash per section -----
const TINTS = [
  [0, [0, 0, 0, 0]],
  [ICE0, [60, 140, 255, 0.07]],
  [CP1, [0, 0, 0, 0]],
  [C0, [150, 70, 230, 0.06]],
  [TUN0, [255, 80, 170, 0.06]],
  [TUN1, [0, 0, 0, 0]],
];
function tintAt(d) {
  let prev = TINTS[0][1];
  let cur = TINTS[0][1];
  let since = Infinity;
  for (const [start, t] of TINTS) {
    if (d >= start) { prev = cur; cur = t; since = d - start; }
  }
  const k = smooth(0, 1500, since);
  return prev.map((v, i) => lerp(v, cur[i], k));
}

// ----- wave helpers -----
function darts(s, g, frac, amp = 70, track = false) {
  const group = { total: 5, killed: 0 };
  const baseY = at(frac);
  for (let i = 0; i < 5; i++) {
    s.after(i * 0.24, () => g.spawn('dart', { baseY, y: baseY, amp, freq: 2.6, speed: 250, group, track }));
  }
}
// darts that follow the middle of the canyon or tunnel
const trackDarts = (s, g, amp = 40) => darts(s, g, 0.5, amp, true);

function sweepers(s, g, y1 = PLAY.top + 20, y2 = PLAY.bottom - 20, spread = 140) {
  g.spawn('sweeper', { x: W + 40, y: y1, stopX: W - 280, stopY: MID - spread, phase: 'in' });
  s.after(0.35, () => g.spawn('sweeper', { x: W + 40, y: y2, stopX: W - 220, stopY: MID + spread, phase: 'in' }));
}
const bulb = (g, frac) => g.spawn('bulb', { baseY: at(frac), y: at(frac), fire: 1.2 });

function shards(s, g, n) {
  for (let i = 0; i < n; i++) {
    s.after(i * 0.45, () => g.spawn('shard', {
      size: 3,
      x: W + 40,
      y: at(0.1 + Math.random() * 0.8),
      vx: -40 - Math.random() * 60,
      vy: (Math.random() - 0.5) * 50,
      spin: (Math.random() - 0.5) * 1.6,
    }));
  }
}
function floe(g, frac, size, turret = false) {
  const f = g.spawn('floe', { variant: size, x: W + FLOE_R[size] + 10, baseY: at(frac), y: at(frac), drift: 25 });
  if (turret) g.spawn('turret', { side: 'floor', anchor: f });
}
const turret = (g, side, x = W + 30) => g.spawn('turret', { side, x });
const hatch = (g, side, x = W + 40) => g.spawn('hatch', { side, x });

// ----- the timeline: [distance, what happens] -----
const EVENTS = [
  // open space
  [T(1), (s, g) => g.banner('STAGE 1', 'HALO DRIFT')],
  [T(4), (s, g) => darts(s, g, 0.3)],
  [T(7), (s, g) => darts(s, g, 0.7)],
  [T(10), (s, g) => sweepers(s, g)],
  [T(13), (s, g) => darts(s, g, 0.5, 130)],
  [T(16), (s, g) => bulb(g, 0.4)],
  [T(20), (s, g) => darts(s, g, 0.2)],
  [T(21.2), (s, g) => darts(s, g, 0.8)],
  [T(25), (s, g) => sweepers(s, g)],
  [T(26.5), (s, g) => darts(s, g, 0.5, 40)],
  [T(30), (s, g) => bulb(g, 0.25)],
  [T(32), (s, g) => bulb(g, 0.75)],
  [T(35), (s, g) => darts(s, g, 0.35)],
  [T(36), (s, g) => darts(s, g, 0.65)],
  [T(39), (s, g) => { sweepers(s, g); s.after(1.2, () => sweepers(s, g, PLAY.top + 60, PLAY.bottom - 60, 60)); }],
  [T(43), (s, g) => darts(s, g, 0.5, 160)],

  // ice ring field
  [ICE0, (s, g) => g.banner('ICE RING FIELD', '', true)],
  [T(46), (s, g) => shards(s, g, 3)],
  [T(49), (s, g) => floe(g, 0.32, 1, true)],
  [T(53), (s, g) => { shards(s, g, 3); darts(s, g, 0.8, 50); }],
  [T(57), (s, g) => floe(g, 0.75, 2, true)],
  [T(59), (s, g) => floe(g, 0.18, 0)],
  [T(62), (s, g) => sweepers(s, g)],
  [T(65), (s, g) => shards(s, g, 5)],
  [T(69), (s, g) => { floe(g, 0.55, 2, true); darts(s, g, 0.12, 30); }],
  [T(73), (s, g) => { bulb(g, 0.25); shards(s, g, 2); }],
  [T(77), (s, g) => floe(g, 0.22, 1, true)],
  [T(78), (s, g) => floe(g, 0.82, 1)],
  [T(79), (s, g) => darts(s, g, 0.52, 35)],
  [T(83), (s, g) => shards(s, g, 6)],
  [T(87), (s, g) => { floe(g, 0.62, 0, true); sweepers(s, g); }],
  [T(91), (s, g) => { darts(s, g, 0.3); s.after(1.2, () => darts(s, g, 0.72)); }],
  [T(95), (s, g) => { bulb(g, 0.5); shards(s, g, 3); }],

  // mid-boss, then a wave of fighters
  [T(101), (s, g) => g.startBoss('rig')],
  [T(106), (s, g) => { darts(s, g, 0.4); s.after(0.6, () => darts(s, g, 0.6)); }],
  [T(110), (s, g) => { sweepers(s, g); s.after(1.5, () => sweepers(s, g, PLAY.top + 60, PLAY.bottom - 60, 60)); }],
  [T(114), (s, g) => { bulb(g, 0.5); darts(s, g, 0.15, 30); darts(s, g, 0.85, 30); }],
  [T(119), (s, g) => sweepers(s, g)],

  // crystal canyon
  [T(126), (s, g) => g.banner('CRYSTAL CANYON', '', true)],
  [T(129), (s, g) => turret(g, 'floor')],
  [T(131), (s, g) => turret(g, 'ceiling')],
  [T(133), (s, g) => trackDarts(s, g, 50)],
  [T(136), (s, g) => hatch(g, 'floor')],
  [T(139), (s, g) => { turret(g, 'floor'); s.after(0.6, () => turret(g, 'floor')); }],
  [T(142), (s, g) => sweepers(s, g, MID - 60, MID + 60, 90)],
  [T(146), (s, g) => { hatch(g, 'ceiling'); trackDarts(s, g, 30); }],
  [T(150), (s, g) => { turret(g, 'ceiling'); s.after(0.7, () => turret(g, 'ceiling')); }],
  [T(153), (s, g) => bulb(g, 0.5)],
  [T(157), (s, g) => hatch(g, 'floor')],
  [T(160), (s, g) => hatch(g, 'ceiling')],
  [T(163), (s, g) => { trackDarts(s, g, 45); s.after(1.6, () => trackDarts(s, g, 20)); }],
  [T(168), (s, g) => { turret(g, 'floor'); turret(g, 'ceiling'); }],
  [T(171), (s, g) => sweepers(s, g, MID - 60, MID + 60, 80)],
  [T(175), (s, g) => { hatch(g, 'floor'); turret(g, 'ceiling'); }],
  [T(180), (s, g) => bulb(g, 0.45)],
  [T(184), (s, g) => trackDarts(s, g, 60)],
  [T(188), (s, g) => { turret(g, 'floor'); s.after(0.5, () => turret(g, 'ceiling')); s.after(1, () => turret(g, 'floor')); }],

  // high-speed run
  [TUN0 + 200, (s, g) => g.banner('HIGH-SPEED RUN', 'Mind the walls', true)],
  [TUN0 + 2200, (s, g) => trackDarts(s, g, 25)],
  [TUN0 + 3600, (s, g) => turret(g, 'floor')],
  [TUN0 + 4400, (s, g) => turret(g, 'ceiling')],
  [TUN0 + 5600, (s, g) => trackDarts(s, g, 20)],
  [TUN0 + 7000, (s, g) => { turret(g, 'floor'); turret(g, 'ceiling'); }],
  [TUN0 + 8600, (s, g) => trackDarts(s, g, 15)],
  [TUN0 + 9800, (s, g) => hatch(g, 'floor')],

  // the stage boss
  [CP3 + 300, (s, g) => g.startBoss('lighthouse')],
];

export const STAGE1 = {
  name: 'Halo Drift',
  shape,
  speedAt,
  tintAt,
  checkpoints: [CP1, CP2, CP3],
  events: EVENTS.sort((a, b) => a[0] - b[0]),
  // the middle of the open space between the walls at distance d
  centreAt(d) {
    const s = shape(d);
    const top = Math.max(s.top, PLAY.top);
    const bot = Math.min(s.bot, PLAY.bottom);
    return (top + bot) / 2;
  },
};
