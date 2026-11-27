// The power-up meter. Each energy cell moves the highlight one slot
// to the right (wrapping round). Pressing Take gives you whatever is
// highlighted and resets the meter.

import { MAX_THRUST, MAX_WINGMEN, SHIELD_MAX } from './player.js';

export const SLOTS = [
  { key: 'thrust', label: 'THRUST' },
  { key: 'seekers', label: 'SEEKERS' },
  { key: 'fork', label: 'FORK' },
  { key: 'lance', label: 'LANCE' },
  { key: 'wingman', label: 'WINGMAN' },
  { key: 'aegis', label: 'AEGIS' },
];

export class Meter {
  constructor() {
    this.reset();
  }

  reset() {
    this.cursor = -1;  // -1 = nothing highlighted
    this.bump = 0;     // brief glow when the highlight moves
  }

  advance() {
    this.cursor = (this.cursor + 1) % SLOTS.length;
    this.bump = 1;
  }

  update(dt) {
    this.bump = Math.max(0, this.bump - dt * 4);
  }

  canTake(i, p) {
    switch (SLOTS[i].key) {
      case 'thrust': return p.thrust < MAX_THRUST;
      case 'seekers': return !p.seekers;
      case 'fork': return p.gun !== 'fork';
      case 'lance': return p.gun !== 'lance';
      case 'wingman': return p.wingmen.length < MAX_WINGMEN;
      case 'aegis': return p.shieldHP < SHIELD_MAX;
    }
    return false;
  }

  // [filled, total] little lights shown under each slot
  level(i, p) {
    switch (SLOTS[i].key) {
      case 'thrust': return [p.thrust, MAX_THRUST];
      case 'seekers': return [p.seekers ? 1 : 0, 1];
      case 'fork': return [p.gun === 'fork' ? 1 : 0, 1];
      case 'lance': return [p.gun === 'lance' ? 1 : 0, 1];
      case 'wingman': return [p.wingmen.length, MAX_WINGMEN];
      case 'aegis': return [p.shieldHP, SHIELD_MAX];
    }
    return [0, 0];
  }

  // Returns the slot taken, or null if nothing happened.
  take(p) {
    if (this.cursor < 0 || !this.canTake(this.cursor, p)) return null;
    const slot = SLOTS[this.cursor];
    p.apply(slot.key);
    this.cursor = -1;
    return slot;
  }
}
