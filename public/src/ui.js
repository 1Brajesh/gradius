// On-screen text and panels: score, lives, the power-up meter,
// floating labels, the controls hint, pause and game over.

import { W, H } from './config.js';
import { SLOTS } from './powerups.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

function text(ctx, str, x, y, { size = 16, weight = 600, color = '#eaf2ff', align = 'left', base = 'top', spacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = color;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

const pad = (n) => String(n).padStart(7, '0');

export function drawHud(ctx, game) {
  // scores
  text(ctx, 'SCORE', 28, 20, { size: 12, color: 'rgba(170,190,230,0.8)', spacing: 2 });
  text(ctx, pad(game.score), 28, 36, { size: 24, weight: 700, spacing: 1 });
  text(ctx, 'HIGH', W - 28, 20, { size: 12, color: 'rgba(170,190,230,0.8)', align: 'right', spacing: 2 });
  text(ctx, pad(game.hiscore), W - 28, 36, { size: 24, weight: 700, align: 'right', spacing: 1, color: 'rgba(234,242,255,0.75)' });

  // spare ships, bottom left
  const ship = game.art.ship;
  for (let i = 0; i < game.spares; i++) {
    ctx.drawImage(ship.img, 26 + i * 46, H - 42, 40, 19);
  }

  drawMeter(ctx, game);
}

function drawMeter(ctx, game) {
  const { meter, player } = game;
  const bw = 112;
  const bh = 32;
  const gap = 8;
  const x0 = (W - (SLOTS.length * bw + (SLOTS.length - 1) * gap)) / 2;
  const y = H - 48;

  SLOTS.forEach((slot, i) => {
    const x = x0 + i * (bw + gap);
    const on = meter.cursor === i;
    const can = meter.canTake(i, player);

    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 7);
    if (on) {
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, '#ffe08a');
      g.addColorStop(1, '#ff9a3a');
      ctx.save();
      ctx.shadowColor = 'rgba(255,170,60,0.9)';
      ctx.shadowBlur = 16 + 18 * meter.bump;
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(12,18,42,0.72)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(130,170,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    const labelColor = on
      ? (can ? '#2a1200' : 'rgba(42,18,0,0.45)')
      : (can ? 'rgba(220,232,255,0.92)' : 'rgba(220,232,255,0.3)');
    text(ctx, slot.label, x + bw / 2, y + 6, { size: 12, weight: 700, color: labelColor, align: 'center', spacing: 1.5 });

    // little lights: how much of this upgrade you have
    const [filled, total] = meter.level(i, player);
    const pw = 9;
    const pg = 4;
    const px0 = x + bw / 2 - (total * pw + (total - 1) * pg) / 2;
    for (let k = 0; k < total; k++) {
      ctx.beginPath();
      ctx.roundRect(px0 + k * (pw + pg), y + 23, pw, 3, 1.5);
      if (k < filled) ctx.fillStyle = on ? '#2a1200' : '#7fdcff';
      else ctx.fillStyle = on ? 'rgba(42,18,0,0.25)' : 'rgba(150,180,240,0.2)';
      ctx.fill();
    }
  });
}

export function drawPopups(ctx, popups) {
  for (const p of popups) {
    const k = p.t / 1.1;
    ctx.globalAlpha = 1 - k * k;
    text(ctx, p.text, p.x, p.y - 30 * k, { size: 16, weight: 800, color: `rgb(${p.rgb})`, align: 'center', base: 'middle', spacing: 2 });
  }
  ctx.globalAlpha = 1;
}

export function drawHint(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  text(ctx, 'Move  ←↑↓→ / WASD      Fire  Z / Space      Power-up  X / Shift      Pause  P',
    W / 2, H - 78, { size: 15, weight: 500, color: 'rgba(210,225,255,0.85)', align: 'center', base: 'middle' });
  ctx.globalAlpha = 1;
}

export function drawGameOver(ctx, game) {
  const k = Math.min(1, game.stateT / 0.6);
  ctx.fillStyle = `rgba(3,5,14,${0.6 * k})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  text(ctx, 'GAME OVER', W / 2, H / 2 - 40, { size: 60, weight: 800, align: 'center', base: 'middle', spacing: 6 });
  text(ctx, `Score ${game.score.toLocaleString()}`, W / 2, H / 2 + 14, { size: 22, weight: 600, align: 'center', base: 'middle', color: 'rgba(220,232,255,0.9)' });
  if (game.newHigh) {
    text(ctx, 'New high score!', W / 2, H / 2 + 46, { size: 18, weight: 700, align: 'center', base: 'middle', color: '#ffd27a' });
  }
  if (game.stateT > 1.2) {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(game.stateT * 4);
    text(ctx, 'Press Z or Space to play again', W / 2, H / 2 + 90, { size: 17, weight: 500, align: 'center', base: 'middle', color: 'rgba(200,215,245,0.9)' });
  }
  ctx.globalAlpha = 1;
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(3,5,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  text(ctx, 'PAUSED', W / 2, H / 2 - 14, { size: 54, weight: 800, align: 'center', base: 'middle', spacing: 6 });
  text(ctx, 'Press P to carry on', W / 2, H / 2 + 34, { size: 18, weight: 500, align: 'center', base: 'middle', color: 'rgba(200,215,245,0.8)' });
}
