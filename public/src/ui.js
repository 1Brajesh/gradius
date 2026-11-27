// On-screen text: the controls hint and the pause screen.
// The score, lives and power-up meter join this file in later steps.

import { W, H } from './config.js';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

export function drawHint(ctx, alpha) {
  if (alpha <= 0) return;
  ctx.globalAlpha = alpha;
  ctx.font = `500 17px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(210,225,255,0.85)';
  ctx.fillText('Move  ←↑↓→ / WASD      Fire  Z / Space      Pause  P', W / 2, H - 30);
  ctx.globalAlpha = 1;
}

export function drawPause(ctx) {
  ctx.fillStyle = 'rgba(3,5,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eaf2ff';
  ctx.font = `700 54px ${FONT}`;
  ctx.fillText('PAUSED', W / 2, H / 2 - 14);
  ctx.font = `500 18px ${FONT}`;
  ctx.fillStyle = 'rgba(200,215,245,0.8)';
  ctx.fillText('Press P to carry on', W / 2, H / 2 + 34);
}
