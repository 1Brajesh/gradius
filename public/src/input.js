// Keyboard and touch input. Actions are named so the rest of the game
// never cares which key was pressed.
//
// Touch: put a thumb down anywhere and drag. The ship moves by however
// far the thumb moves (not to where the thumb is), so the finger never
// covers the ship. The gun fires by itself in touch mode. On-screen
// buttons (in index.html) send 'power', 'pause' and 'mute'.

const BINDINGS = {
  up:    ['ArrowUp', 'KeyW'],
  down:  ['ArrowDown', 'KeyS'],
  left:  ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  fire:  ['KeyZ', 'Space'],
  power: ['KeyX', 'ShiftLeft', 'ShiftRight'],
  pause: ['KeyP', 'Escape'],
  mute:  ['KeyM'],
};

// how far the ship moves per screen pixel the thumb moves, on top of
// the game's own scaling (so it feels the same on phone and tablet)
const DRAG_GAIN = 1.25;

export class Input {
  constructor() {
    this.held = new Set();     // key codes currently down
    this.hits = new Set();     // actions pressed since last taken
    this.touched = false;      // has the player pressed anything yet
    this.codeToAction = new Map();
    for (const [action, codes] of Object.entries(BINDINGS)) {
      for (const code of codes) this.codeToAction.set(code, action);
    }

    // touch state
    this.touchMode = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.scale = 1;            // screen pixels per game pixel (set by main.js)
    this.dragX = 0;            // thumb movement not yet used by the ship, in game pixels
    this.dragY = 0;
    this.steerId = null;       // which finger is steering
    this.lastX = 0;
    this.lastY = 0;
    this.onModeChange = null;

    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', (e) => {
      const action = this.codeToAction.get(e.code);
      if (!action) return;
      e.preventDefault();
      this.touched = true;
      this.setTouchMode(false);
      if (!e.repeat) this.hits.add(action);
      this.held.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      if (this.codeToAction.has(e.code)) e.preventDefault();
      this.held.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
      this.steerId = null;
    });

    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      if (e.target.closest && e.target.closest('.tbtn')) return; // on-screen buttons handle themselves
      this.touched = true;
      this.setTouchMode(true);
      this.hits.add('tap');
      if (this.steerId === null) {
        this.steerId = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.steerId) return;
      const k = DRAG_GAIN / this.scale;
      this.dragX += (e.clientX - this.lastX) * k;
      this.dragY += (e.clientY - this.lastY) * k;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const lift = (e) => {
      if (e.pointerId === this.steerId) this.steerId = null;
    };
    window.addEventListener('pointerup', lift);
    window.addEventListener('pointercancel', lift);
  }

  setTouchMode(on) {
    if (this.touchMode === on) return;
    this.touchMode = on;
    if (this.onModeChange) this.onModeChange(on);
  }

  // an on-screen button was pressed
  press(action) {
    this.touched = true;
    this.hits.add(action);
  }

  isDown(action) {
    for (const code of BINDINGS[action]) if (this.held.has(code)) return true;
    return false;
  }

  // the thumb movement since last asked, in game pixels
  takeDrag() {
    const d = { dx: this.dragX, dy: this.dragY };
    this.dragX = 0;
    this.dragY = 0;
    return d;
  }

  // Forget presses made earlier (e.g. so a fire press during play
  // doesn't instantly restart from the game-over screen).
  clear() {
    this.hits.clear();
    this.dragX = 0;
    this.dragY = 0;
  }

  // True once per press, then cleared.
  take(action) {
    if (!this.hits.has(action)) return false;
    this.hits.delete(action);
    return true;
  }
}
