// Bloom: makes bright things (shots, fire, engines) spill a soft glow
// onto what's around them.
//
// How: shrink the frame drawn so far down to a tiny copy (shrinking
// blurs it), keep only the bright parts by multiplying the copy by
// itself a few times (dim colours fall towards black, bright ones stay bright),
// soften it, then stretch it back over the frame with 'lighter'
// blending. All on small images, so it's cheap.

const BW = 320;
const BH = 180;

function small(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, g: c.getContext('2d') };
}

export class Bloom {
  constructor(strength = 0.9) {
    this.strength = strength;
    this.a = small(BW, BH);
    this.b = small(BW * 2, BH * 2);   // half the game size; also reused for the blur
    this.canBlur = 'filter' in this.b.g;
  }

  apply(ctx) {
    const src = ctx.canvas;
    const { a, b } = this;

    // shrink in two steps (one big jump would flicker)
    b.g.globalCompositeOperation = 'copy';
    b.g.imageSmoothingQuality = 'high';
    b.g.drawImage(src, 0, 0, BW * 2, BH * 2);
    a.g.globalCompositeOperation = 'copy';
    a.g.imageSmoothingQuality = 'high';
    a.g.drawImage(b.c, 0, 0, BW * 2, BH * 2, 0, 0, BW, BH);

    // bright pass: colour to the 4th power (square it, then square again),
    // so the dim sky and planets drop out and only real light is left
    a.g.globalCompositeOperation = 'multiply';
    a.g.drawImage(a.c, 0, 0);
    a.g.drawImage(a.c, 0, 0);

    // soften (where the browser can't blur, shrink-and-stretch does it)
    b.g.globalCompositeOperation = 'copy';
    if (this.canBlur) {
      b.g.filter = 'blur(4px)';
      b.g.drawImage(a.c, 0, 0);
      b.g.filter = 'none';
    } else {
      b.g.drawImage(a.c, 0, 0, BW / 4, BH / 4);
      b.g.drawImage(b.c, 0, 0, BW / 4, BH / 4, 0, 0, BW, BH);
    }

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = this.strength;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(b.c, 0, 0, BW, BH, 0, 0, src.width, src.height);
    ctx.restore();
  }
}
