import { audioContext } from './context';

/**
 * Short game sounds, synthesised with Web Audio (no audio files):
 *  - tick: a soft wooden clock tick, for the last 5 seconds of a speech
 * Deliberately quiet so it cues people without startling anyone.
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
