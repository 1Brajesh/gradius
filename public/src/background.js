// The scrolling backdrop: sky colour, drifting nebula and three layers
// of stars moving at different speeds (far = slow, near = fast), which
// gives the feeling of depth.

import { W, H, SCROLL_SPEED, lerp, rng } from './config.js';
import { stamp, NEBULA_W } from './art.js';

const SPAN = W + 80; // stars wrap around this width

const LAYERS = [
  { count: 160, depth: 0.25, size: [0.6, 1.4], bright: [0.25, 0.6], kind: 'dot' },
  { count: 70,  depth: 0.8,  size: [5, 9],     bright: [0.35, 0.75], kind: 'glow' },
  { count: 22,  depth: 2.8,  size: [26, 54],   bright: [0.25, 0.5], kind: 'streak' },
];

export class Background {
  constructor(art) {
    this.art = art;
    this.scroll = 0;   // total distance travelled
    this.pscroll = 0;
    this.t = 0;
    const rand = rng(42);
    this.layers = LAYERS.map((L) => ({
      ...L,
      stars: Array.from({ length: L.count }, () => ({
        x: rand() * SPAN,
        y: rand() * H,
        size: lerp(L.size[0], L.size[1], rand()),
        bright: lerp(L.bright[0], L.bright[1], rand()),
        tw: 1 + rand() * 3,          // twinkle speed
        ph: rand() * Math.PI * 2,    // twinkle phase
        warm: rand() < 0.2,          // a few warmer-coloured stars
      })),
    }));
  }

  update(dt, speed = SCROLL_SPEED) {
    // (speed comes from the stage: faster in the tunnel)
    this.pscroll = this.scroll;
    this.scroll += speed * dt;
    this.t += dt;
  }

  // tint: [r, g, b, alpha] colour wash for the current part of the stage
  draw(ctx, a, tint) {
    const art = this.art;
    const s = lerp(this.pscroll, this.scroll, a);

    stamp(ctx, art.sky, W / 2, H / 2);

    // nebula, two copies side by side
    const off = (s * 0.12) % NEBULA_W;
    ctx.drawImage(art.nebula.img, -off, 0, NEBULA_W, H);
    ctx.drawImage(art.nebula.img, NEBULA_W - off, 0, NEBULA_W, H);

    if (tint && tint[3] > 0.002) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${tint[0] | 0},${tint[1] | 0},${tint[2] | 0},${tint[3]})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }

    // the ringed planet, very far away, drifting past very slowly
    const px = 980 - s * 0.045;
    if (px > -400) {
      ctx.globalAlpha = 0.9;
      stamp(ctx, art.planet, px, 250);
      ctx.globalAlpha = 1;
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const L of this.layers) {
      const shift = s * L.depth;
      for (const st of L.stars) {
        let x = (st.x - shift) % SPAN;
        if (x < 0) x += SPAN;
        x -= 40;
        const tw = 0.75 + 0.25 * Math.sin(this.t * st.tw + st.ph);
        ctx.globalAlpha = st.bright * tw;
        if (L.kind === 'dot') {
          ctx.fillStyle = st.warm ? '#ffe2c0' : '#cfe0ff';
          ctx.fillRect(x, st.y, st.size, st.size);
        } else if (L.kind === 'glow') {
          stamp(ctx, st.warm ? art.glowOrange : art.glowWhite, x, st.y, st.size, st.size);
        } else {
          stamp(ctx, art.streak, x, st.y, st.size, 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
