// Canyon and tunnel walls. The stage describes the walls as a function
// of distance travelled: shape(d) -> { top, bot }, the y of the ceiling's
// surface and of the floor's surface. "No wall" is simply a surface
// off-screen (top < 0, bot > H), so nothing needs special cases.

import { W, H } from './config.js';
import { stamp } from './art.js';

const STEP_X = 8;         // drawing resolution along the wall
const CRYSTAL_GAP = 115;  // average distance between crystal clusters

// repeatable pseudo-random number from an integer
const hash = (k) => {
  const s = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

export class Terrain {
  constructor(art, shape) {
    this.art = art;
    this.shape = shape;
  }

  draw(ctx, pos, time) {
    const xs = [];
    const tops = [];
    const bots = [];
    let anyTop = false;
    let anyBot = false;
    for (let x = -STEP_X; x <= W + STEP_X; x += STEP_X) {
      const s = this.shape(pos + x);
      xs.push(x);
      tops.push(s.top);
      bots.push(s.bot);
      if (s.top > 0) anyTop = true;
      if (s.bot < H) anyBot = true;
    }
    if (!anyTop && !anyBot) return;

    if (anyTop) this.wall(ctx, xs, tops, -1);
    if (anyBot) this.wall(ctx, xs, bots, 1);
    this.crystals(ctx, pos, time);
  }

  // dir -1 = ceiling (rock above the edge), 1 = floor (rock below it)
  wall(ctx, xs, edge, dir) {
    const outer = dir < 0 ? -20 : H + 20;
    ctx.beginPath();
    ctx.moveTo(xs[0], outer);
    for (let i = 0; i < xs.length; i++) ctx.lineTo(xs[i], edge[i]);
    ctx.lineTo(xs[xs.length - 1], outer);
    ctx.closePath();
    const gr = dir < 0
      ? ctx.createLinearGradient(0, 0, 0, 260)
      : ctx.createLinearGradient(0, H, 0, H - 260);
    gr.addColorStop(0, '#06041a');
    gr.addColorStop(0.6, '#191443');
    gr.addColorStop(1, '#2e2670');
    ctx.fillStyle = gr;
    ctx.fill();

    // rock layers: faint lines following the edge, inside the wall
    ctx.save();
    ctx.clip();
    for (const [off, a] of [[16, 0.16], [40, 0.1], [75, 0.06]]) {
      ctx.beginPath();
      for (let i = 0; i < xs.length; i++) {
        const y = edge[i] + dir * off;
        if (i) ctx.lineTo(xs[i], y);
        else ctx.moveTo(xs[i], y);
      }
      ctx.strokeStyle = `rgba(150,140,255,${a})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();

    // glowing rim along the edge
    ctx.beginPath();
    for (let i = 0; i < xs.length; i++) {
      if (i) ctx.lineTo(xs[i], edge[i]);
      else ctx.moveTo(xs[i], edge[i]);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(120,170,255,0.18)';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,210,255,0.75)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  crystals(ctx, pos, time) {
    const { crystals, glowCyan, glowViolet } = this.art;
    const k0 = Math.floor((pos - 80) / CRYSTAL_GAP);
    const k1 = Math.ceil((pos + W + 80) / CRYSTAL_GAP);
    for (let k = k0; k <= k1; k++) {
      for (const dir of [-1, 1]) {
        const h = hash(k * 2 + (dir > 0 ? 1 : 0));
        if (h < 0.35) continue; // leave some gaps
        const d = k * CRYSTAL_GAP + hash(k * 7 + dir) * CRYSTAL_GAP;
        const s = this.shape(d);
        const y = dir < 0 ? s.top : s.bot;
        if (dir < 0 ? y < 20 : y > H - 20) continue; // only on real walls
        const x = d - pos;
        const v = Math.floor(h * 997) % crystals.length;
        const size = 0.6 + hash(k * 13 + dir) * 0.6;
        const spr = crystals[v];
        ctx.save();
        ctx.translate(x, y + dir * -2);
        if (dir < 0) ctx.rotate(Math.PI);
        stamp(ctx, spr, 0, (-spr.h / 2) * size, spr.w * size, spr.h * size);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 2 + k);
        const g = v < 2 ? glowCyan : glowViolet;
        stamp(ctx, g, 0, -22 * size, 70 * size, 70 * size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
