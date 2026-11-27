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

export function buildArt() {
  return {
    ship: sprite(88 * SHIP_SCALE, 42 * SHIP_SCALE, drawShip),
    shot: shot(),
    flame: flame(),
    streak: streak(),
    glowBlue: glow('rgba(80,180,255,1)', 64),
    glowWhite: glow('rgba(220,235,255,1)', 64),
    glowOrange: glow('rgba(255,140,60,1)', 64),
    sky: sky(),
    nebula: nebula(),
    vignette: vignette(),
  };
}
