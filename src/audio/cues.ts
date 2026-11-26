import { audioContext } from './context';

/**
 * Short game sounds, synthesised with Web Audio (no audio files):
 *  - tick:    a soft wooden clock tick, for the last 5 seconds of a speech
 *  - morning: a short, warm rising chime when the town wakes up
 *  - night:   a low, quiet, slightly uneasy tone when night falls
 * All are deliberately quiet so they cue people without startling anyone.
 */

const MASTER = 0.6;

function ready(given?: BaseAudioContext): BaseAudioContext | null {
  if (given) return given;
  const ctx = audioContext();
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function output(ctx: BaseAudioContext, level: number): GainNode {
  const g = ctx.createGain();
  g.gain.value = level * MASTER;
  g.connect(ctx.destination);
  return g;
}

/** A soft wooden "tock": a short filtered noise click plus a quick low knock. */
export function playTick(given?: BaseAudioContext): void {
  const ctx = ready(given);
  if (!ctx) return;
  const t = ctx.currentTime + 0.01;
  const out = output(ctx, 0.5);

  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2400;
  band.Q.value = 3;
  const ng = ctx.createGain();
  ng.gain.value = 0.9;
  noise.connect(band).connect(ng).connect(out);
  noise.start(t);

  const knock = ctx.createOscillator();
  knock.type = 'triangle';
  knock.frequency.setValueAtTime(880, t);
  knock.frequency.exponentialRampToValueAtTime(520, t + 0.05);
  const kg = ctx.createGain();
  kg.gain.setValueAtTime(0.0001, t);
  kg.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  knock.connect(kg).connect(out);
  knock.start(t);
  knock.stop(t + 0.1);
}

/** Morning: four soft bell notes rising (C–E–G–C), about a second long. */
export function playMorning(given?: BaseAudioContext): void {
  const ctx = ready(given);
  if (!ctx) return;
  const t0 = ctx.currentTime + 0.02;
  const out = output(ctx, 0.5);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const t = t0 + i * 0.11;
    for (const [mult, level] of [
      [1, 1],
      [2, 0.18],
      [3, 0.06],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35 * level, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (i === notes.length - 1 ? 1.2 : 0.7));
      osc.connect(g).connect(out);
      osc.start(t);
      osc.stop(t + 1.3);
    }
  });
}

/** Night: a quiet low tone sinking a little, with a faint uneasy beat, ~1.6 s. */
export function playNight(given?: BaseAudioContext): void {
  const ctx = ready(given);
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  const dur = 1.6;
  const out = output(ctx, 0.45);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  // keep some upper harmonics: phone speakers can't play the low root on its own
  low.frequency.setValueAtTime(1600, t);
  low.frequency.exponentialRampToValueAtTime(450, t + dur);
  low.connect(out);

  const env = (g: GainNode, peak: number) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.25);
    g.gain.setValueAtTime(peak, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  };

  // root sinking from D3 to A2, plus a slightly detuned twin for a slow, uneasy beat
  // (a sawtooth for body, and a soft octave above so phone speakers can carry it)
  for (const [detune, peak, type, octave] of [
    [0, 0.32, 'sawtooth', 1],
    [9, 0.3, 'sine', 1],
    [0, 0.34, 'sine', 2],
  ] as const) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(146.83 * octave, t);
    osc.frequency.exponentialRampToValueAtTime(110 * octave, t + dur);
    osc.detune.value = detune * 10;
    const g = ctx.createGain();
    env(g, peak);
    osc.connect(g).connect(low);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
  // a faint minor-second shadow above, the "something's wrong" colour
  const shadow = ctx.createOscillator();
  shadow.type = 'sine';
  shadow.frequency.setValueAtTime(155.56, t);
  shadow.frequency.exponentialRampToValueAtTime(116.54, t + dur);
  const sg = ctx.createGain();
  env(sg, 0.12);
  shadow.connect(sg).connect(low);
  shadow.start(t);
  shadow.stop(t + dur + 0.05);
}
