// Synthesised sound effects (no audio files to license). Browsers allow audio only after a user
// gesture, so call unlock() from the first click / key press.

export function createSound() {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const ready = () => ctx && !muted;

  /** One oscillator note with a pitch glide and a quick attack/decay envelope. */
  function note({ type = 'sine', from, to = from, dur, gain = 0.4, at = 0, vibrato = 0 }) {
    const t0 = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Filtered white-noise burst (crunches, thuds, snores). */
  function noise({ dur, freq = 1200, q = 1, gain = 0.3, at = 0, type = 'bandpass' }) {
    const t0 = ctx.currentTime + at;
    const length = Math.ceil(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
  }

  const EFFECTS = {
    yip: () => {
      note({ type: 'triangle', from: 700, to: 1300, dur: 0.07, gain: 0.35 });
      note({ type: 'triangle', from: 1250, to: 650, dur: 0.12, gain: 0.35, at: 0.06 });
    },
    woof: () => {
      [0, 0.22].forEach((at) => {
        note({ type: 'sawtooth', from: 420, to: 260, dur: 0.14, gain: 0.18, at });
        noise({ dur: 0.1, freq: 700, q: 2, gain: 0.25, at });
      });
    },
    boing: () => note({ type: 'sine', from: 220, to: 660, dur: 0.25, gain: 0.3, vibrato: 30 }),
    land: () => noise({ dur: 0.08, freq: 220, q: 0.8, gain: 0.5, type: 'lowpass' }),
    crunch: () => [0, 0.05, 0.11].forEach((at) => noise({ dur: 0.05, freq: 2500, q: 0.7, gain: 0.35, at })),
    chime: () => [523, 659, 784, 1047].forEach((f, i) => note({ from: f, dur: 0.35, gain: 0.22, at: i * 0.08 })),
    pop: () => note({ from: 900, to: 300, dur: 0.1, gain: 0.3 }),
    whistle: () => note({ from: 900, to: 1600, dur: 0.5, gain: 0.15, vibrato: 25 }),
    trumpet: () => {
      note({ type: 'sawtooth', from: 330, to: 520, dur: 0.25, gain: 0.18, vibrato: 18 });
      note({ type: 'sawtooth', from: 520, to: 440, dur: 0.6, gain: 0.2, at: 0.22, vibrato: 25 });
    },
    monkey: () => [0, 0.18, 0.36].forEach((at, i) => note({ from: 500 + i * 120, to: 900 + i * 200, dur: 0.15, gain: 0.25, at })),
    tinkle: () => [0, 0.07, 0.14].forEach((at, i) => note({ from: 1568 + i * 330, dur: 0.18, gain: 0.08, at })),
    honk: () => [0, 0.2].forEach((at) => note({ type: 'square', from: 520, to: 430, dur: 0.14, gain: 0.12, at })),
    squeak: () => [0, 0.12].forEach((at) => note({ from: 2400, to: 3200, dur: 0.07, gain: 0.15, at })),
    snore: () => noise({ dur: 0.9, freq: 160, q: 3, gain: 0.25 }),
  };

  function play(name) {
    if (!ready() || !EFFECTS[name]) return;
    try {
      EFFECTS[name]();
    } catch (err) {
      console.warn(`sound ${name} failed`, err);
    }
  }

  return { unlock, play, toggleMute: () => { muted = !muted; return muted; } };
}
