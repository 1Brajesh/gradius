// All sound is synthesised live with the Web Audio API: no sound files.
//
// Browsers only allow sound after the player presses something, so the
// audio starts on the first key press (see main.js).
//
// Layout:   sfx ─┐
//                ├─> master ─> compressor ─> speakers
//   music bus ───┘      ▲
//   (pads, bass, arp,   │
//    lead, drums)   reverb + echo

const MUTE_KEY = 'starwake.muted';
const BPM = 118;
const S16 = 60 / BPM / 4;          // length of a 16th note in seconds

const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// ---------- the music (original) ----------
// A minor: Am(add9) - Fmaj7 - C - G, one chord per bar.
const CHORDS = [
  { root: 33, pad: [57, 60, 64, 71] },
  { root: 29, pad: [53, 57, 60, 64] },
  { root: 36, pad: [55, 60, 64, 67] },
  { root: 31, pad: [55, 59, 62, 67] },
];
// Lead melody over 8 bars: [step in bar, note, length in 16ths]
const LEAD = [
  [[0, 76, 6], [6, 74, 2], [8, 72, 4], [12, 71, 4]],
  [[0, 72, 6], [6, 69, 2], [8, 72, 4], [12, 77, 4]],
  [[0, 76, 8], [8, 79, 4], [12, 76, 4]],
  [[0, 74, 12], [12, 71, 4]],
  [[0, 76, 4], [4, 79, 4], [8, 81, 6], [14, 79, 2]],
  [[0, 77, 4], [4, 76, 4], [8, 72, 8]],
  [[0, 76, 4], [4, 74, 4], [8, 72, 4], [12, 74, 4]],
  [[0, 74, 8], [8, 71, 8]],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];

// Boss music: D minor - Bb - C - A, driving 16th-note bass, no lead.
const BOSS_CHORDS = [
  { root: 26, pad: [50, 53, 57, 62] },
  { root: 34, pad: [50, 53, 58, 62] },
  { root: 36, pad: [52, 55, 60, 64] },
  { root: 33, pad: [49, 52, 57, 61] },
];

// Song shape: bars 0-3 pads + arp only, then bass and drums join,
// then the lead plays every other 8 bars.
function section(bar) {
  const groove = bar >= 4;
  const lead = bar >= 8 && Math.floor((bar - 8) / 8) % 2 === 0;
  return { groove, lead };
}

// Shortest gap allowed between repeats of the same effect, so
// rapid fire or a chain of explosions doesn't turn into a roar.
const THROTTLE = { shot: 0.05, lance: 0.08, enemyShot: 0.09, hit: 0.035, boom: 0.03, seeker: 0.1, rocks: 0.2 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.paused = false;
    this.mood = 'stage';
    this.nextMood = 'stage';
    this.last = {};
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { this.muted = false; }
  }

  // Called on the first key press or touch. `ctx` can be passed in for testing.
  unlock(ctx) {
    if (this.ctx) {
      if (!this.paused && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!ctx && !AC) return;
    // iPhones mute web pages when the silent switch is on; asking for
    // 'playback' lets the game's sound through, like a music app
    try { if (!ctx && navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* older Safari */ }
    this.ctx = ctx || new AC();
    this.build();
    if (this.paused && this.ctx.suspend) this.ctx.suspend();
    if (!ctx) this.startMusic();
  }

  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(c.destination);

    this.sfx = c.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    this.music = c.createGain();
    this.music.gain.value = 0.42;
    this.music.connect(this.master);

    // pads get their own bus so the kick drum can "pump" them
    this.padBus = c.createGain();
    this.padBus.connect(this.music);

    // reverb: a cloud of decaying noise as the room's echo
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.impulse(2.6);
    const wet = c.createGain();
    wet.gain.value = 0.55;
    this.reverb.connect(wet).connect(this.master);

    // echo: dotted-eighth delay with filtered feedback
    this.delay = c.createDelay(2);
    this.delay.delayTime.value = S16 * 3;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    this.delay.connect(tone).connect(fb).connect(this.delay);
    const delayOut = c.createGain();
    delayOut.gain.value = 0.35;
    tone.connect(delayOut).connect(this.music);

    // one shared second of white noise
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  impulse(secs) {
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * secs);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  // ---------- controls ----------
  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  setPaused(p) {
    this.paused = p;
    if (!this.ctx) return;
    if (p) this.ctx.suspend();
    else this.ctx.resume();
  }

  // ---------- building blocks ----------
  get now() {
    return this.ctx.currentTime;
  }

  // An oscillator with a pitch sweep and a quick fade-out.
  tone({ type = 'sine', f0, f1 = f0, dur, vol, at = this.now, attack = 0.004, dest = this.sfx, cutoff, send = 0, detune = 0 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    let node = o;
    if (cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      node = node.connect(f);
    }
    node.connect(g).connect(dest);
    if (send) this.sendTo(g, this.reverb, send);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  // Filtered noise with a sweep: whooshes, hats, explosions.
  noise({ dur, vol, at = this.now, type = 'lowpass', f0, f1 = f0, q = 0.8, attack = 0.002, dest = this.sfx, send = 0, rate = 1 }) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, at);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(dest);
    if (send) this.sendTo(g, this.reverb, send);
    src.start(at, Math.random() * 1.5);
    src.stop(at + dur + 0.05);
  }

  sendTo(node, target, amount) {
    const s = this.ctx.createGain();
    s.gain.value = amount;
    node.connect(s).connect(target);
  }

  // ---------- sound effects ----------
  play(name, arg) {
    if (!this.ctx || this.paused) return;
    const t = this.now;
    const gap = THROTTLE[name];
    if (gap) {
      if (t - (this.last[name] ?? -1) < gap) return;
      this.last[name] = t;
    }
    const fx = SFX[name];
    if (fx) fx.call(this, arg);
  }

  // ---------- music ----------
  startMusic() {
    if (!this.ctx) return;
    this.bar = 0;
    this.step = 0;
    this.nextTime = this.now + 0.15;
    this.music.gain.cancelScheduledValues(this.now);
    this.music.gain.setValueAtTime(0.42, this.now);
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
  }

  // Look a little ahead and book the notes that fall in that window.
  schedule() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const ahead = this.now + 0.12;
    if (this.nextTime < this.now - 0.05) this.nextTime = this.now + 0.05; // skip, don't burst
    while (this.nextTime < ahead) {
      this.playStep(this.bar, this.step, this.nextTime);
      this.nextTime += S16;
      if (++this.step === 16) { this.step = 0; this.bar++; }
    }
  }

  // 'stage' or 'boss'. Switches at the start of the next bar so the
  // beat never stumbles.
  setMood(m) {
    this.nextMood = m;
    if (this.ctx) this.fadeMusic(0.42, 0.5);
  }

  fadeMusic(to, secs) {
    if (!this.ctx) return;
    this.music.gain.cancelScheduledValues(this.now);
    this.music.gain.setTargetAtTime(to, this.now, secs / 3);
  }

  // dip the music briefly (e.g. when the player's ship blows up)
  duck() {
    if (!this.ctx) return;
    const g = this.music.gain;
    g.cancelScheduledValues(this.now);
    g.setTargetAtTime(0.15, this.now, 0.05);
    g.setTargetAtTime(0.42, this.now + 1.2, 0.5);
  }

  playStep(bar, step, t) {
    if (step === 0) this.mood = this.nextMood;
    if (this.mood === 'boss') return this.bossStep(bar, step, t);
    const chord = CHORDS[bar % 4];
    const { groove, lead } = section(bar);
    const music = this.music;

    if (step === 0) this.pad(chord.pad, t, S16 * 16);

    // arpeggio: chord notes an octave up, 16ths, into the echo
    const arpNote = chord.pad[ARP[step] % chord.pad.length] + 12;
    const accent = step % 4 === 0 ? 1 : 0.65;
    this.voice({ type: 'square', f: mtof(arpNote), at: t, dur: S16 * 0.9, vol: 0.035 * accent, cutoff: 2600, dest: music, echo: 0.6 });

    if (groove) {
      // bass: pumping eighths, octave jump on the off-beat
      if (step % 2 === 0) {
        const n = chord.root + (step % 4 === 2 ? 12 : 0);
        this.voice({ type: 'sawtooth', f: mtof(n), at: t, dur: S16 * 1.7, vol: 0.16, cutoff: 520, pluck: true, dest: music });
      }
      // drums
      if (step % 4 === 0) this.kick(t);
      if (step === 4 || step === 12) this.snare(t);
      if (step % 2 === 1) this.noise({ at: t, dur: 0.035, vol: step % 4 === 3 ? 0.06 : 0.03, type: 'highpass', f0: 7500, dest: music });
    }

    if (lead) {
      const phrase = LEAD[(bar - 8) % 8];
      for (const [s, n, len] of phrase) {
        if (s === step) this.leadNote(mtof(n), t, len * S16);
      }
    }
  }

  bossStep(bar, step, t) {
    const chord = BOSS_CHORDS[bar % 4];
    const music = this.music;
    if (step === 0) this.pad(chord.pad, t, S16 * 16);
    // bass on every 16th, jumping octaves
    const n = chord.root + ([0, 0, 12, 0, 0, 12, 0, 7][step % 8]);
    this.voice({ type: 'sawtooth', f: mtof(n), at: t, dur: S16 * 0.9, vol: 0.14, cutoff: 700, pluck: true, dest: music });
    // high, urgent arpeggio
    const arpNote = chord.pad[ARP[(step * 3) % 16] % 4] + 24;
    this.voice({ type: 'square', f: mtof(arpNote), at: t, dur: S16 * 0.6, vol: 0.025, cutoff: 3200, dest: music, echo: 0.4 });
    // drums
    if (step % 4 === 0) this.kick(t);
    if (step === 4 || step === 12) this.snare(t);
    if (bar % 4 === 3 && step >= 12) this.snare(t);
    this.noise({ at: t, dur: 0.03, vol: step % 2 ? 0.035 : 0.06, type: 'highpass', f0: 8000, dest: music });
  }

  // a soft held chord: two slightly detuned saws per note
  pad(notes, t, dur) {
    const c = this.ctx;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.5);
    f.frequency.linearRampToValueAtTime(800, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.5);
    g.gain.setValueAtTime(0.05, t + dur - 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    f.connect(g).connect(this.padBus);
    this.sendTo(g, this.reverb, 0.7);
    for (const n of notes) {
      for (const det of [-8, 8]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(n);
        o.detune.value = det;
        o.connect(f);
        o.start(t);
        o.stop(t + dur + 0.9);
      }
    }
  }

  voice({ type, f, at, dur, vol, cutoff, pluck = false, dest, echo = 0 }) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.Q.value = pluck ? 6 : 1;
    if (pluck) {
      fl.frequency.setValueAtTime(cutoff * 3, at);
      fl.frequency.exponentialRampToValueAtTime(cutoff * 0.6, at + dur);
    } else {
      fl.frequency.value = cutoff;
    }
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(vol, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(fl).connect(g).connect(dest);
    if (echo) this.sendTo(g, this.delay, echo);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  leadNote(f, t, dur) {
    const c = this.ctx;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(1800, t);
    fl.frequency.linearRampToValueAtTime(3200, t + 0.08);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.03);
    g.gain.setValueAtTime(0.055, t + dur * 0.85);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
    fl.connect(g).connect(this.music);
    this.sendTo(g, this.delay, 0.5);
    this.sendTo(g, this.reverb, 0.4);
    // gentle vibrato that fades in
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = c.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(12, t + Math.min(0.4, dur));
    lfo.connect(depth);
    for (const [type, det] of [['sawtooth', -6], ['square', 6]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      depth.connect(o.detune);
      o.connect(fl);
      o.start(t);
      o.stop(t + dur + 0.3);
    }
    lfo.start(t);
    lfo.stop(t + dur + 0.3);
  }

  kick(t) {
    this.tone({ type: 'sine', f0: 150, f1: 42, dur: 0.32, vol: 0.55, at: t, dest: this.music });
    // make the pads "breathe" with the kick
    const g = this.padBus.gain;
    g.setValueAtTime(0.45, t);
    g.linearRampToValueAtTime(1, t + 0.22);
  }

  snare(t) {
    this.noise({ at: t, dur: 0.18, vol: 0.16, type: 'bandpass', f0: 1900, q: 0.7, dest: this.music, send: 0.3 });
    this.tone({ type: 'triangle', f0: 200, f1: 150, dur: 0.09, vol: 0.12, at: t, dest: this.music });
  }
}

// Each effect is a short recipe of tones and noise.
const SFX = {
  shot() {
    this.tone({ type: 'square', f0: 1500, f1: 420, dur: 0.07, vol: 0.03, cutoff: 4200 });
    this.tone({ type: 'sine', f0: 900, f1: 300, dur: 0.06, vol: 0.04 });
  },
  lance() {
    this.tone({ type: 'sawtooth', f0: 2400, f1: 500, dur: 0.16, vol: 0.045, cutoff: 3500 });
    this.tone({ type: 'sine', f0: 600, f1: 250, dur: 0.14, vol: 0.05 });
  },
  seeker() {
    this.noise({ dur: 0.16, vol: 0.2, type: 'bandpass', f0: 1200, f1: 4200, q: 2 });
  },
  enemyShot() {
    this.tone({ type: 'sine', f0: 760, f1: 330, dur: 0.14, vol: 0.05 });
    this.tone({ type: 'triangle', f0: 380, f1: 165, dur: 0.12, vol: 0.03 });
  },
  hit() {
    this.tone({ type: 'triangle', f0: 1100, f1: 700, dur: 0.035, vol: 0.05 });
  },
  boom(size = 1) {
    const s = Math.min(2.5, size);
    const dur = 0.3 + 0.45 * s;
    this.noise({ dur, vol: 0.22 + 0.12 * s, type: 'lowpass', f0: 3500 + 1500 * s, f1: 90, q: 0.9, send: 0.25, rate: 0.7 + Math.random() * 0.5 });
    this.tone({ type: 'sine', f0: 160 - 25 * s, f1: 34, dur: 0.18 + 0.18 * s, vol: 0.28 + 0.12 * s });
  },
  cell() {
    const t = this.now;
    this.tone({ type: 'sine', f0: mtof(88), dur: 0.16, vol: 0.09, at: t, send: 0.4 });
    this.tone({ type: 'sine', f0: mtof(95), dur: 0.26, vol: 0.09, at: t + 0.06, send: 0.4 });
  },
  power() {
    const t = this.now;
    [72, 76, 79, 84, 88].forEach((n, i) => {
      this.tone({ type: 'square', f0: mtof(n), dur: 0.14, vol: 0.045, at: t + i * 0.045, cutoff: 3000, send: 0.35 });
      this.tone({ type: 'sine', f0: mtof(n + 12), dur: 0.2, vol: 0.04, at: t + i * 0.045, send: 0.35 });
    });
  },
  deny() {
    this.tone({ type: 'square', f0: 150, f1: 120, dur: 0.14, vol: 0.05, cutoff: 900 });
  },
  shield() {
    this.tone({ type: 'sine', f0: 2100, f1: 1700, dur: 0.25, vol: 0.06, send: 0.5 });
    this.tone({ type: 'sine', f0: 3150, f1: 2600, dur: 0.18, vol: 0.035, send: 0.5 });
  },
  bonus() {
    const t = this.now;
    [84, 88, 91, 96].forEach((n, i) => this.tone({ type: 'triangle', f0: mtof(n), dur: 0.18, vol: 0.06, at: t + i * 0.06, send: 0.4 }));
  },
  death() {
    SFX.boom.call(this, 2.5);
    this.tone({ type: 'sawtooth', f0: 500, f1: 50, dur: 1.1, vol: 0.09, cutoff: 1500, send: 0.4 });
    this.noise({ dur: 1.6, vol: 0.12, type: 'lowpass', f0: 1200, f1: 60, send: 0.5 });
  },
  respawn() {
    this.tone({ type: 'sine', f0: 220, f1: 990, dur: 0.5, vol: 0.06, attack: 0.15, send: 0.4 });
    this.noise({ dur: 0.5, vol: 0.05, type: 'bandpass', f0: 600, f1: 5000, q: 1.5, attack: 0.2 });
  },
  rocks() {
    this.noise({ dur: 0.35, vol: 0.25, type: 'lowpass', f0: 900, f1: 200, q: 2, rate: 0.6 });
    this.tone({ type: 'square', f0: 90, f1: 50, dur: 0.2, vol: 0.08, cutoff: 400 });
  },
  warning() {
    const t = this.now;
    for (let i = 0; i < 6; i++) {
      this.tone({ type: 'square', f0: i % 2 ? 660 : 880, dur: 0.24, vol: 0.06, at: t + i * 0.25, cutoff: 2000, attack: 0.01 });
    }
  },
  charge() {
    this.tone({ type: 'sawtooth', f0: 120, f1: 1400, dur: 1.0, vol: 0.06, cutoff: 2500, attack: 0.3, send: 0.3 });
  },
  laser() {
    this.noise({ dur: 0.8, vol: 0.22, type: 'bandpass', f0: 3000, f1: 400, q: 0.8, send: 0.4 });
    this.tone({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.75, vol: 0.12, cutoff: 1800 });
  },
  phase() {
    this.tone({ type: 'sawtooth', f0: 60, f1: 30, dur: 0.9, vol: 0.18, cutoff: 600, send: 0.4 });
  },
  clear() {
    const t = this.now + 1;
    [72, 76, 79, 84, 79, 84, 88].forEach((n, i) => {
      const len = i === 6 ? 0.9 : 0.16;
      this.tone({ type: 'square', f0: mtof(n), dur: len, vol: 0.05, at: t + i * 0.14, cutoff: 3200, send: 0.4 });
      this.tone({ type: 'triangle', f0: mtof(n - 12), dur: len, vol: 0.06, at: t + i * 0.14, send: 0.3 });
    });
  },
  gameover() {
    const t = this.now + 0.3;
    [69, 65, 62, 57].forEach((n, i) => this.tone({ type: 'triangle', f0: mtof(n), dur: 0.6, vol: 0.08, at: t + i * 0.32, send: 0.6, attack: 0.02 }));
  },
};

// Stand-in used when there's no sound (tests, very old browsers).
export const SILENT = {
  play() {}, duck() {}, fadeMusic() {}, startMusic() {}, toggleMute() {}, setPaused() {}, unlock() {}, setMood() {}, muted: false,
};
