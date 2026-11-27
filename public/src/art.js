// Everything you see is drawn here, once, at start-up, into off-screen
// images ("sprites"). The game then just stamps those images around,
// which keeps it fast. Sprites are drawn at 3x so they stay sharp on
// Retina screens and big windows.

import { W, H, rng } from './config.js';

const S = 3; // detail multiplier
export const SHIP_SCALE = 1.15;

// Make a sprite of logical size w x h. `draw` gets a context whose
// origin is the sprite's centre, in logical pixels.
function sprite(w, h, draw, scale = S) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale);
  c.height = Math.ceil(h * scale);
  const g = c.getContext('2d');
  g.scale(scale, scale);
  g.translate(w / 2, h / 2);
  draw(g, w, h);
  return { img: c, w, h };
}

// Draw a sprite centred on (x, y), optionally at a different size.
export function stamp(ctx, s, x, y, w = s.w, h = s.h) {
  ctx.drawImage(s.img, x - w / 2, y - h / 2, w, h);
}

// ---------- the player's ship ----------
// Side view, nose to the right. Drawn at about 84 x 40, then scaled up.
function drawShip(g) {
  g.scale(SHIP_SCALE, SHIP_SCALE);
  // lower swept wing (behind hull)
  g.beginPath();
  g.moveTo(6, 5);
  g.lineTo(-18, 17);
  g.lineTo(-33, 18);
  g.lineTo(-27, 5);
  g.closePath();
  let gr = g.createLinearGradient(0, 4, 0, 18);
  gr.addColorStop(0, '#3c4f78');
  gr.addColorStop(1, '#16203a');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(150,190,255,0.35)';
  g.lineWidth = 0.6;
  g.stroke();
  // wing tip light
  g.fillStyle = '#ff6a3d';
  g.fillRect(-31, 16, 6, 1.6);

  // top fin
  g.beginPath();
  g.moveTo(-12, -7);
  g.lineTo(-27, -18);
  g.lineTo(-34, -18);
  g.lineTo(-29, -6);
  g.closePath();
  gr = g.createLinearGradient(0, -18, 0, -6);
  gr.addColorStop(0, '#2a3a60');
  gr.addColorStop(1, '#4a5f8c');
  g.fillStyle = gr;
  g.fill();
  g.stroke();

  // engine block at the back
  g.beginPath();
  g.roundRect(-41, -7, 10, 14, 2);
  gr = g.createLinearGradient(0, -7, 0, 7);
  gr.addColorStop(0, '#5d6680');
  gr.addColorStop(1, '#1c2133');
  g.fillStyle = gr;
  g.fill();
  // nozzle glow
  gr = g.createLinearGradient(-42, 0, -36, 0);
  gr.addColorStop(0, 'rgba(160,230,255,0.95)');
  gr.addColorStop(1, 'rgba(60,140,255,0)');
  g.fillStyle = gr;
  g.fillRect(-42, -4.5, 6, 9);

  // main hull
  g.beginPath();
  g.moveTo(42, 2);
  g.bezierCurveTo(30, -3, 18, -9, 2, -9);
  g.lineTo(-24, -9);
  g.lineTo(-34, -6);
  g.lineTo(-35, 5);
  g.lineTo(-22, 9);
  g.bezierCurveTo(4, 10, 26, 7, 42, 2);
  g.closePath();
  gr = g.createLinearGradient(0, -9, 0, 10);
  gr.addColorStop(0, '#f1f5fb');
  gr.addColorStop(0.35, '#b9c4d6');
  gr.addColorStop(0.7, '#66738c');
  gr.addColorStop(1, '#2b3246');
  g.fillStyle = gr;
  g.fill();

  // panel lines
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(20,28,48,0.45)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(-14, -9); g.lineTo(-16, 9);
  g.moveTo(-26, -8); g.lineTo(-27, 8);
  g.moveTo(-34, 1); g.lineTo(30, 1);
  g.stroke();
  // accent stripe
  gr = g.createLinearGradient(-30, 0, 34, 0);
  gr.addColorStop(0, '#ff4e2a');
  gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr;
  g.fillRect(-33, 2.2, 66, 2.2);
  // underside shadow
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(-40, 6, 90, 6);
  g.restore();

  // rim light along the top edge
  g.beginPath();
  g.moveTo(40, 1.4);
  g.bezierCurveTo(30, -3.6, 18, -8.4, 2, -8.4);
  g.lineTo(-24, -8.4);
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 0.7;
  g.stroke();

  // cockpit canopy
  g.save();
  g.translate(9, -7.5);
  g.rotate(0.06);
  g.beginPath();
  g.ellipse(0, 0, 12, 4.4, 0, Math.PI, 0);
  g.lineTo(12, 0.6);
  g.lineTo(-12, 0.6);
  g.closePath();
  gr = g.createLinearGradient(0, -4.4, 0, 1);
  gr.addColorStop(0, '#bff6ff');
  gr.addColorStop(0.45, '#2fb4e6');
  gr.addColorStop(1, '#0b3a66');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(10,30,60,0.8)';
  g.lineWidth = 0.6;
  g.stroke();
  // glint
  g.beginPath();
  g.ellipse(-3, -2.4, 4.5, 1, -0.05, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fill();
  g.restore();

  // nose cap
  g.beginPath();
  g.moveTo(42, 2);
  g.lineTo(34, -0.6);
  g.lineTo(34, 4.4);
  g.closePath();
  g.fillStyle = '#ff6a3d';
  g.fill();
}

// ---------- glows, shots and flames ----------
function glow(color, size) {
  return sprite(size, size, (g) => {
    const r = size / 2;
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, color);
    gr.addColorStop(0.5, color.replace(/[\d.]+\)$/, '0.25)'));
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(-r, -r, size, size);
  }, 1);
}

function shot() {
  return sprite(40, 14, (g) => {
    // outer haze
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 20);
    gr.addColorStop(0, 'rgba(90,220,255,0.55)');
    gr.addColorStop(1, 'rgba(40,120,255,0)');
    g.save();
    g.scale(1, 0.35);
    g.fillStyle = gr;
    g.fillRect(-20, -20, 40, 40);
    g.restore();
    // bright core
    gr = g.createLinearGradient(-16, 0, 16, 0);
    gr.addColorStop(0, 'rgba(120,230,255,0)');
    gr.addColorStop(0.6, 'rgba(200,250,255,0.95)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.beginPath();
    g.roundRect(-16, -2, 32, 4, 2);
    g.fillStyle = gr;
    g.fill();
  });
}

function flame() {
  // Points right: the bright end sits against the engine.
  return sprite(64, 24, (g) => {
    let gr = g.createLinearGradient(-32, 0, 32, 0);
    gr.addColorStop(0, 'rgba(40,90,255,0)');
    gr.addColorStop(0.55, 'rgba(60,150,255,0.55)');
    gr.addColorStop(0.85, 'rgba(150,230,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.beginPath();
    g.moveTo(-32, 0);
    g.quadraticCurveTo(0, -12, 32, -8);
    g.lineTo(32, 8);
    g.quadraticCurveTo(0, 12, -32, 0);
    g.fillStyle = gr;
    g.fill();
    // inner white core
    gr = g.createLinearGradient(0, 0, 32, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)');
    gr.addColorStop(1, 'rgba(255,255,255,0.95)');
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(16, -4, 32, -3.5);
    g.lineTo(32, 3.5);
    g.quadraticCurveTo(16, 4, 0, 0);
    g.fillStyle = gr;
    g.fill();
  });
}

function streak() {
  // A soft horizontal line, used for the nearest, fastest stars.
  return sprite(64, 4, (g) => {
    const gr = g.createLinearGradient(-32, 0, 32, 0);
    gr.addColorStop(0, 'rgba(180,210,255,0)');
    gr.addColorStop(0.8, 'rgba(210,230,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(-32, -1, 64, 2, 1);
    g.fill();
  }, 2);
}

// ---------- backdrop ----------
function sky() {
  return sprite(W, H, (g) => {
    const gr = g.createLinearGradient(0, -H / 2, 0, H / 2);
    gr.addColorStop(0, '#060a1e');
    gr.addColorStop(0.55, '#0a1230');
    gr.addColorStop(1, '#03040d');
    g.fillStyle = gr;
    g.fillRect(-W / 2, -H / 2, W, H);
  }, 1);
}

// Soft clouds of colour. Blobs near an edge are also drawn on the other
// side, so the image tiles seamlessly as it scrolls.
export const NEBULA_W = 1800;
function nebula() {
  const rand = rng(7);
  const colors = [
    [92, 42, 160], [30, 80, 170], [16, 110, 130], [150, 40, 120], [60, 50, 150],
  ];
  return sprite(NEBULA_W, H, (g) => {
    g.translate(-NEBULA_W / 2, -H / 2);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const x = rand() * NEBULA_W;
      // keep clouds mostly in a wavy band across the middle
      const y = H * (0.5 + 0.32 * Math.sin(x / NEBULA_W * Math.PI * 2 * 2 + 1)) + (rand() - 0.5) * 220;
      const r = 120 + rand() * 260;
      const [cr, cg, cb] = colors[Math.floor(rand() * colors.length)];
      const a = 0.07 + rand() * 0.11;
      for (const dx of [-NEBULA_W, 0, NEBULA_W]) {
        const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r);
        gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
        gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        g.fillStyle = gr;
        g.fillRect(x + dx - r, y - r, r * 2, r * 2);
      }
    }
  }, 1);
}

function vignette() {
  return sprite(W, H, (g) => {
    g.scale(1, H / W);
    const gr = g.createRadialGradient(0, 0, W * 0.25, 0, 0, W * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = gr;
    g.fillRect(-W / 2, -W / 2, W, W);
  }, 1);
}

// A small soft light, painted into a sprite.
function glowDot(g, x, y, r, rgb) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, `rgba(${rgb},0.9)`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}

// Same shape, solid white: shown for a split second when an enemy is hit.
function whiteOf(s) {
  const c = document.createElement('canvas');
  c.width = s.img.width;
  c.height = s.img.height;
  const g = c.getContext('2d');
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  return { img: c, w: s.w, h: s.h };
}

// ---------- enemies (all face left, toward the player) ----------
function dart() {
  return sprite(42, 26, (g) => {
    g.beginPath();
    g.moveTo(-20, 0);
    g.lineTo(4, -10);
    g.lineTo(19, -11);
    g.lineTo(12, 0);
    g.lineTo(19, 11);
    g.lineTo(4, 10);
    g.closePath();
    const gr = g.createLinearGradient(0, -11, 0, 11);
    gr.addColorStop(0, '#ff9cc0');
    gr.addColorStop(0.45, '#d8326f');
    gr.addColorStop(1, '#4b0b2b');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,210,230,0.55)';
    g.lineWidth = 0.7;
    g.stroke();
    g.beginPath();
    g.moveTo(-14, 0.5);
    g.lineTo(11, 0.5);
    g.strokeStyle = 'rgba(60,0,25,0.6)';
    g.lineWidth = 1.2;
    g.stroke();
    glowDot(g, 15, -6, 4, '255,170,80');
    glowDot(g, 15, 6, 4, '255,170,80');
    glowDot(g, -6, 0, 5, '255,240,140');
  });
}

function sweeper() {
  return sprite(50, 44, (g) => {
    g.beginPath();
    g.moveTo(-23, 0);
    g.quadraticCurveTo(-8, -21, 23, -19);
    g.quadraticCurveTo(8, -10, 9, 0);
    g.quadraticCurveTo(8, 10, 23, 19);
    g.quadraticCurveTo(-8, 21, -23, 0);
    g.closePath();
    const gr = g.createLinearGradient(0, -20, 0, 20);
    gr.addColorStop(0, '#8ff7dc');
    gr.addColorStop(0.5, '#1f9e8c');
    gr.addColorStop(1, '#0a3a3c');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(200,255,240,0.5)';
    g.lineWidth = 0.7;
    g.stroke();
    g.beginPath();
    g.moveTo(-14, -6);
    g.quadraticCurveTo(0, -14, 16, -15);
    g.moveTo(-14, 6);
    g.quadraticCurveTo(0, 14, 16, 15);
    g.strokeStyle = 'rgba(5,40,40,0.55)';
    g.lineWidth = 1;
    g.stroke();
    glowDot(g, -9, 0, 8, '255,220,90');
  });
}

function bulb() {
  return sprite(70, 70, (g) => {
    // cannon
    g.fillStyle = '#2a2140';
    g.beginPath();
    g.roundRect(-33, -6, 14, 12, 3);
    g.fill();
    glowDot(g, -32, 0, 6, '255,90,160');
    // armoured shell
    let gr = g.createRadialGradient(-9, -11, 3, 0, 0, 28);
    gr.addColorStop(0, '#c7b6ee');
    gr.addColorStop(0.45, '#6a54a0');
    gr.addColorStop(1, '#1d1433');
    g.beginPath();
    g.arc(0, 0, 27, 0, Math.PI * 2);
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(15,8,30,0.6)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.3;
      g.beginPath();
      g.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
      g.lineTo(Math.cos(a) * 27, Math.sin(a) * 27);
      g.stroke();
    }
    // glowing core
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.fillStyle = '#140b24';
    g.fill();
    gr = g.createRadialGradient(0, 0, 0, 0, 0, 13);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.3, '#ff7ae0');
    gr.addColorStop(0.75, '#8a1f9e');
    gr.addColorStop(1, 'rgba(60,10,80,0)');
    g.beginPath();
    g.arc(0, 0, 13, 0, Math.PI * 2);
    g.fillStyle = gr;
    g.fill();
    g.beginPath();
    g.arc(0, 0, 14, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(230,200,255,0.6)';
    g.lineWidth = 1;
    g.stroke();
    // rim light
    g.beginPath();
    g.arc(0, 0, 26.5, Math.PI * 1.05, Math.PI * 1.6);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.stroke();
  });
}

function enemyShot() {
  return sprite(20, 20, (g) => {
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 10);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.3, 'rgba(255,120,170,1)');
    gr.addColorStop(0.6, 'rgba(255,60,120,0.45)');
    gr.addColorStop(1, 'rgba(255,40,100,0)');
    g.fillStyle = gr;
    g.fillRect(-10, -10, 20, 20);
  });
}

// ---------- pickups and player extras ----------
function cell() {
  return sprite(34, 34, (g) => {
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 17);
    gr.addColorStop(0, 'rgba(255,200,90,0.6)');
    gr.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = gr;
    g.fillRect(-17, -17, 34, 34);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
    }
    g.closePath();
    gr = g.createLinearGradient(0, -10, 0, 10);
    gr.addColorStop(0, '#ffe9a8');
    gr.addColorStop(1, '#e07a12');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = '#fff3cf';
    g.lineWidth = 1.2;
    g.stroke();
    glowDot(g, 0, 0, 6, '255,255,220');
  });
}

function lance() {
  return sprite(150, 16, (g) => {
    g.save();
    g.scale(1, 0.12);
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 75);
    gr.addColorStop(0, 'rgba(120,230,255,0.6)');
    gr.addColorStop(1, 'rgba(60,140,255,0)');
    g.fillStyle = gr;
    g.fillRect(-75, -75, 150, 150);
    g.restore();
    gr = g.createLinearGradient(-70, 0, 70, 0);
    gr.addColorStop(0, 'rgba(120,220,255,0)');
    gr.addColorStop(0.25, 'rgba(170,240,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.beginPath();
    g.roundRect(-70, -2.5, 140, 5, 2.5);
    g.fillStyle = gr;
    g.fill();
  });
}

function seeker() {
  return sprite(24, 10, (g) => {
    g.beginPath();
    g.moveTo(11, 0);
    g.lineTo(5, -3);
    g.lineTo(-9, -3);
    g.lineTo(-11, -5);
    g.lineTo(-11, 5);
    g.lineTo(-9, 3);
    g.lineTo(5, 3);
    g.closePath();
    const gr = g.createLinearGradient(0, -3, 0, 3);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(1, '#8a96ad');
    g.fillStyle = gr;
    g.fill();
    g.beginPath();
    g.moveTo(11, 0);
    g.lineTo(6, -2.6);
    g.lineTo(6, 2.6);
    g.closePath();
    g.fillStyle = '#ff5a2a';
    g.fill();
  });
}

function wingman() {
  return sprite(34, 34, (g) => {
    let gr = g.createRadialGradient(0, 0, 0, 0, 0, 17);
    gr.addColorStop(0, 'rgba(120,210,255,0.55)');
    gr.addColorStop(1, 'rgba(80,160,255,0)');
    g.fillStyle = gr;
    g.fillRect(-17, -17, 34, 34);
    g.beginPath();
    g.moveTo(10, 0);
    g.lineTo(0, -8);
    g.lineTo(-8, 0);
    g.lineTo(0, 8);
    g.closePath();
    gr = g.createLinearGradient(0, -8, 0, 8);
    gr.addColorStop(0, '#eef6ff');
    gr.addColorStop(1, '#5c7aa8');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = 0.8;
    g.stroke();
    glowDot(g, 1, 0, 5, '140,230,255');
  });
}

function withFlash(s) {
  return { normal: s, white: whiteOf(s) };
}

// ---------- Stage 1: ice, rock, ground enemies, crystals, planet ----------
export const SHARD_R = { 2: 15, 3: 26 };   // ice shard sizes (radius)
export const FLOE_R = [62, 82, 104];        // big ice rocks (radius)
export const FLOE_TOP = 0.86;               // flat top, as a share of radius

// An irregular ring of points. `flatTop` keeps the top level so a
// turret can sit on it.
function blobPoints(r, rand, count, jag, flatTop = false) {
  const pts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / count);
    let rr = r * (1 - jag / 2 + rand() * jag);
    if (flatTop && Math.sin(a) < -0.82) rr = (r * FLOE_TOP) / -Math.sin(a);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  return pts;
}

function tracePoly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function drawIce(g, pts, r, [c0, c1, c2], rim) {
  tracePoly(g, pts);
  const gr = g.createLinearGradient(-r, -r, r, r);
  gr.addColorStop(0, c0);
  gr.addColorStop(0.5, c1);
  gr.addColorStop(1, c2);
  g.fillStyle = gr;
  g.fill();
  g.save();
  g.clip();
  // facets: lines from an off-centre point to each corner
  const cx = -r * 0.18;
  const cy = -r * 0.2;
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 1;
  for (const [x, y] of pts) {
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(x, y);
    g.stroke();
  }
  // a shaded face on the lower right
  g.beginPath();
  g.moveTo(cx, cy);
  const a0 = Math.floor(pts.length * 0.05);
  const a1 = Math.floor(pts.length * 0.4);
  for (let i = a0; i <= a1; i++) g.lineTo(...pts[i]);
  g.closePath();
  g.fillStyle = 'rgba(0,15,50,0.28)';
  g.fill();
  // highlight on the upper left
  const hl = g.createRadialGradient(-r * 0.45, -r * 0.45, 0, -r * 0.45, -r * 0.45, r * 0.7);
  hl.addColorStop(0, 'rgba(255,255,255,0.35)');
  hl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = hl;
  g.fillRect(-r, -r, r * 2, r * 2);
  g.restore();
  tracePoly(g, pts);
  g.strokeStyle = rim;
  g.lineWidth = 1.2;
  g.stroke();
}

function shard(size, seed) {
  const r = SHARD_R[size];
  return sprite(r * 2 + 8, r * 2 + 8, (g) => {
    drawIce(g, blobPoints(r, rng(seed), 7, 0.4), r, ['#effcff', '#7fcbef', '#1c5797'], 'rgba(225,248,255,0.8)');
  });
}

function floe(i) {
  const r = FLOE_R[i];
  return sprite(r * 2 + 10, r * 2 + 10, (g) => {
    const pts = blobPoints(r, rng(100 + i), 14, 0.26, true);
    drawIce(g, pts, r, ['#e4edf7', '#7d90b5', '#262f50'], 'rgba(210,230,255,0.55)');
    // snow on the flat top
    g.save();
    tracePoly(g, pts);
    g.clip();
    const sg = g.createLinearGradient(0, -r * FLOE_TOP, 0, -r * FLOE_TOP + 14);
    sg.addColorStop(0, 'rgba(255,255,255,0.75)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sg;
    g.fillRect(-r, -r, r * 2, r);
    g.restore();
  });
}

// Turret base: a dome on a plate. The gun pivots 6px above the plate's
// underside; the sprite's centre sits 6px below the pivot.
function turretBase() {
  return sprite(40, 24, (g) => {
    let gr = g.createLinearGradient(0, 6, 0, 12);
    gr.addColorStop(0, '#4a5374');
    gr.addColorStop(1, '#171b2c');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(-18, 5, 36, 7, 2);
    g.fill();
    g.beginPath();
    g.arc(0, 6, 12, Math.PI, 0);
    g.closePath();
    gr = g.createRadialGradient(-4, -2, 1, 0, 4, 13);
    gr.addColorStop(0, '#dfe6f4');
    gr.addColorStop(0.5, '#69738f');
    gr.addColorStop(1, '#252a3d');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(200,215,255,0.4)';
    g.lineWidth = 0.8;
    g.stroke();
    glowDot(g, 0, 0, 4, '255,120,60');
  });
}

function barrel() {
  return sprite(24, 8, (g) => {
    const gr = g.createLinearGradient(0, -3, 0, 3);
    gr.addColorStop(0, '#c9d1e3');
    gr.addColorStop(1, '#4b5470');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(-10, -2.6, 21, 5.2, 1.5);
    g.fill();
    g.fillStyle = '#20253a';
    g.fillRect(8, -3, 3, 6);
  });
}

// Hatch: a bunker with a door on top. Centre is 16px above the ground.
function hatchBase() {
  return sprite(64, 34, (g) => {
    g.beginPath();
    g.moveTo(-31, 16);
    g.lineTo(-22, -5);
    g.quadraticCurveTo(0, -15, 22, -5);
    g.lineTo(31, 16);
    g.closePath();
    const gr = g.createLinearGradient(0, -14, 0, 16);
    gr.addColorStop(0, '#a493d4');
    gr.addColorStop(0.45, '#4a3b7a');
    gr.addColorStop(1, '#1b1433');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(220,205,255,0.5)';
    g.lineWidth = 0.8;
    g.stroke();
    g.beginPath();
    g.roundRect(-13, -10, 26, 7, 3);
    g.fillStyle = '#0b0716';
    g.fill();
    g.strokeStyle = 'rgba(20,10,40,0.6)';
    g.beginPath();
    g.moveTo(-26, 6);
    g.lineTo(26, 6);
    g.stroke();
    glowDot(g, -20, 10, 3.5, '255,200,80');
    glowDot(g, 20, 10, 3.5, '255,200,80');
  });
}

function mite() {
  return sprite(26, 26, (g) => {
    g.fillStyle = '#ff9a5a';
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i * Math.PI) / 2);
      g.beginPath();
      g.moveTo(5, -2.5);
      g.lineTo(11, 0);
      g.lineTo(5, 2.5);
      g.closePath();
      g.fill();
      g.restore();
    }
    const gr = g.createRadialGradient(-2, -2, 0, 0, 0, 7);
    gr.addColorStop(0, '#ffe2b0');
    gr.addColorStop(0.5, '#ff6a2a');
    gr.addColorStop(1, '#7a1a08');
    g.beginPath();
    g.arc(0, 0, 6.5, 0, Math.PI * 2);
    g.fillStyle = gr;
    g.fill();
    glowDot(g, 0, 0, 4, '255,240,180');
  });
}

// Crystal cluster, growing upward from its base at the sprite's bottom.
function crystal(seed, [light, mid, dark]) {
  return sprite(44, 70, (g) => {
    const rand = rng(seed);
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const lean = (rand() - 0.5) * 0.8;
      const len = 20 + rand() * 38;
      const w = 5 + rand() * 6;
      g.save();
      g.translate((rand() - 0.5) * 20, 35);
      g.rotate(lean);
      g.beginPath();
      g.moveTo(-w / 2, 2);
      g.lineTo(-w / 2, -len + w);
      g.lineTo(0, -len);
      g.lineTo(w / 2, -len + w);
      g.lineTo(w / 2, 2);
      g.closePath();
      const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0);
      gr.addColorStop(0, light);
      gr.addColorStop(0.5, mid);
      gr.addColorStop(1, dark);
      g.fillStyle = gr;
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 0.7;
      g.stroke();
      g.restore();
    }
  });
}

// A ringed gas giant far in the background.
function planet() {
  return sprite(720, 420, (g) => {
    const R = 150;
    const ring = (from, to) => {
      g.save();
      g.rotate(-0.24);
      for (const [rx, ry, w, a] of [[300, 64, 14, 0.18], [272, 58, 5, 0.32], [330, 71, 3, 0.2]]) {
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, from, to);
        g.strokeStyle = `rgba(205,225,255,${a})`;
        g.lineWidth = w;
        g.stroke();
      }
      g.restore();
    };
    ring(Math.PI, Math.PI * 2); // back half, behind the planet
    g.save();
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.clip();
    let gr = g.createRadialGradient(-60, -50, 10, 0, 0, R);
    gr.addColorStop(0, '#7cc7d6');
    gr.addColorStop(0.55, '#2f6595');
    gr.addColorStop(1, '#0e1b40');
    g.fillStyle = gr;
    g.fillRect(-R, -R, R * 2, R * 2);
    const rand = rng(9);
    g.rotate(-0.24);
    for (let y = -R; y < R; y += 9 + rand() * 12) {
      g.fillStyle = rand() < 0.5 ? `rgba(255,255,255,${0.03 + rand() * 0.05})` : `rgba(10,20,60,${0.05 + rand() * 0.08})`;
      g.fillRect(-R * 1.2, y, R * 2.4, 4 + rand() * 9);
    }
    g.rotate(0.24);
    gr = g.createLinearGradient(-R * 0.2, 0, R, 0);
    gr.addColorStop(0, 'rgba(0,0,15,0)');
    gr.addColorStop(1, 'rgba(0,0,15,0.85)');
    g.fillStyle = gr;
    g.fillRect(-R, -R, R * 2, R * 2);
    g.restore();
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.strokeStyle = 'rgba(140,220,255,0.35)';
    g.lineWidth = 2.5;
    g.stroke();
    ring(0, Math.PI); // front half
  }, 1);
}

export function buildStageArt() {
  return {
    shards: {
      2: [withFlash(shard(2, 11)), withFlash(shard(2, 12))],
      3: [withFlash(shard(3, 21)), withFlash(shard(3, 22))],
    },
    floes: FLOE_R.map((_, i) => floe(i)),
    turret: withFlash(turretBase()),
    barrel: barrel(),
    hatch: withFlash(hatchBase()),
    mite: withFlash(mite()),
    crystals: [
      crystal(31, ['#d8fbff', '#5fd6f0', '#12607e']),
      crystal(32, ['#d8fbff', '#5fd6f0', '#12607e']),
      crystal(33, ['#f2dcff', '#b072f0', '#4a1f86']),
      crystal(34, ['#f2dcff', '#b072f0', '#4a1f86']),
    ],
    planet: planet(),
  };
}

export function buildArt() {
  return {
    ship: sprite(88 * SHIP_SCALE, 42 * SHIP_SCALE, drawShip),
    shot: shot(),
    lance: lance(),
    seeker: seeker(),
    wingman: wingman(),
    cell: cell(),
    flame: flame(),
    streak: streak(),
    enemyShot: enemyShot(),
    enemies: {
      dart: withFlash(dart()),
      sweeper: withFlash(sweeper()),
      bulb: withFlash(bulb()),
    },
    glowBlue: glow('rgba(80,180,255,1)', 64),
    glowWhite: glow('rgba(220,235,255,1)', 64),
    glowOrange: glow('rgba(255,140,60,1)', 64),
    glowPink: glow('rgba(255,90,180,1)', 64),
    glowAmber: glow('rgba(255,190,70,1)', 64),
    glowCyan: glow('rgba(90,230,255,1)', 64),
    glowViolet: glow('rgba(180,110,255,1)', 64),
    sky: sky(),
    nebula: nebula(),
    vignette: vignette(),
    ...buildStageArt(),
  };
}
