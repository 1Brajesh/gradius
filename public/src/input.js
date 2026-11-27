// Keyboard input. Actions are named so the rest of the game never
// cares which key was pressed. Controller support comes in step 6.

const BINDINGS = {
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire:  ['KeyZ', 'Space'],
  power: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape'],
};

export class Input {
  constructor() {
    this.held = new Set();     // key codes currently down
    this.hits = new Set();     // actions pressed since last taken
    this.touched = false;      // has the player pressed anything yet
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(BINDINGS)) {
      for (const code of codes) this.codeToAction.set(code, action);
    }

    window.addEventListener('keydown', (e) => {
      const action = this.codeToAction.get(e.code);
      if (!action) return;
      e.preventDefault();
      this.touched = true;
      if (!e.repeat) this.hits.add(action);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (this.codeToAction.has(e.code)) e.preventDefault();
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => this.held.clear());
  }

  isDown(action) {
    for (const code of BINDINGS[action]) if (this.held.has(code)) return true;
    return false;
  }

  // Forget presses made earlier (e.g. so a fire press during play
  // doesn't instantly restart from the game-over screen).
  clear() {
    this.hits.clear();
  }

  // True once per press, then cleared.
  take(action) {
    if (!this.hits.has(action)) return false;
    this.hits.delete(action);
    return true;
  }
}
