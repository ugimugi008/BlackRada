export interface VoiceFilterChain {
  track: MediaStreamTrack;
  setEnabled: (enabled: boolean) => void;
  cleanup: () => void;
}

/**
 * Applies a real-time studio voice chain (rumble high-pass, hiss low-pass,
 * speech presence EQ, compressor, and smooth RMS noise gate) to a mic track.
 * Works locally in browser for both LiveKit SFU and WebRTC fallback.
 */
export function createVoiceFilterChain(
  rawAudioTrack: MediaStreamTrack,
  initialEnabled = true
): VoiceFilterChain {
  if (typeof window === 'undefined') {
    return {
      track: rawAudioTrack,
      setEnabled: () => {},
      cleanup: () => {},
    };
  }

  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioCtx) {
    return {
      track: rawAudioTrack,
      setEnabled: () => {},
      cleanup: () => {},
    };
  }

  try {
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(new MediaStream([rawAudioTrack]));
    const destination = ctx.createMediaStreamDestination();

    // High-pass cut below 95Hz removes AC hum, desk bumps, and wind
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 95;
    highpass.Q.value = 0.7;

    // Gentle low-pass above 7.5kHz tames mic hiss
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 7500;
    lowpass.Q.value = 0.7;

    // Speech clarity boost around 2.6kHz
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 2600;
    presence.gain.value = 2.5;
    presence.Q.value = 1.0;

    // Voice leveler
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.16;

    const gateGain = ctx.createGain();
    gateGain.gain.value = 1;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const samples = new Uint8Array(analyser.fftSize);

    // Bypass gain vs filtered chain
    const bypassGain = ctx.createGain();
    const wetGain = ctx.createGain();

    let enabled = initialEnabled;
    bypassGain.gain.value = enabled ? 0 : 1;
    wetGain.gain.value = enabled ? 1 : 0;

    // Dry path
    source.connect(bypassGain);
    bypassGain.connect(destination);

    // Filtered path
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(presence);
    presence.connect(analyser);
    analyser.connect(gateGain);
    gateGain.connect(compressor);
    compressor.connect(wetGain);
    wetGain.connect(destination);

    let holdUntil = 0;
    const intervalId = window.setInterval(() => {
      if (!enabled) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      analyser.getByteTimeDomainData(samples);
      let sumSquares = 0;
      for (let i = 0; i < samples.length; i++) {
        const centered = (samples[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / samples.length);
      const now = performance.now();

      // Open gate cleanly above noise floor (~ -44dB) and hold 240ms after speech
      if (rms > 0.0075) {
        holdUntil = now + 240;
      }
      const targetGain = now <= holdUntil ? 1 : 0.04;
      gateGain.gain.setTargetAtTime(targetGain, ctx.currentTime, now <= holdUntil ? 0.015 : 0.08);
    }, 30);

    const processedTrack = destination.stream.getAudioTracks()[0] ?? rawAudioTrack;

    return {
      track: processedTrack,
      setEnabled: (next: boolean) => {
        enabled = next;
        bypassGain.gain.setTargetAtTime(next ? 0 : 1, ctx.currentTime, 0.02);
        wetGain.gain.setTargetAtTime(next ? 1 : 0, ctx.currentTime, 0.02);
      },
      cleanup: () => {
        window.clearInterval(intervalId);
        try {
          source.disconnect();
          destination.disconnect();
          ctx.close().catch(() => {});
        } catch {
          // Ignore close errors
        }
      },
    };
  } catch {
    return {
      track: rawAudioTrack,
      setEnabled: () => {},
      cleanup: () => {},
    };
  }
}
