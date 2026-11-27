// Runs a stage: moves forward through it, fires its events when their
// distance is reached, remembers checkpoints, and rewinds to the last
// checkpoint when you lose a ship.

export class Stage {
  constructor(def) {
    this.def = def;
    this.loops = 0;
    this.reset();
  }

  reset() {
    this.pos = 0;          // distance travelled, in pixels
    this.ppos = 0;
    this.idx = 0;          // next event to run
    this.cpIdx = 0;        // next checkpoint to reach
    this.checkpoint = 0;   // where you restart after losing a ship
    this.clock = 0;
    this.queue = [];
  }

  get speed() {
    return this.def.speedAt(this.pos);
  }

  // walls at a screen x position, right now
  walls(x) {
    return this.def.shape(this.pos + x);
  }

  // run something a little later (in seconds), e.g. the 2nd..5th dart
  after(delay, fn) {
    this.queue.push({ at: this.clock + delay, fn });
  }

  update(dt, game) {
    this.clock += dt;
    this.ppos = this.pos;
    this.pos += this.speed * dt;

    const due = this.queue.filter((q) => q.at <= this.clock);
    this.queue = this.queue.filter((q) => q.at > this.clock);
    for (const q of due) q.fn();

    const ev = this.def.events;
    while (this.idx < ev.length && ev[this.idx][0] <= this.pos) {
      const [, fn] = ev[this.idx++];
      fn(this, game);
    }

    const cps = this.def.checkpoints;
    while (this.cpIdx < cps.length && cps[this.cpIdx] <= this.pos) {
      this.checkpoint = cps[this.cpIdx++];
      game.onCheckpoint();
    }
  }

  rewind() {
    this.pos = this.ppos = this.checkpoint;
    this.queue = [];
    const i = this.def.events.findIndex((e) => e[0] >= this.checkpoint);
    this.idx = i < 0 ? this.def.events.length : i;
  }

  // end of the stage: go round again
  loop() {
    this.loops++;
    this.reset();
  }

  tint() {
    return this.def.tintAt(this.pos);
  }
}
