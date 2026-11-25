import { useEffect, useRef } from 'react';

interface RemoteAudioProps {
  streams: Record<string, MediaStream>;
  /** Whether this viewer should hear the given player right now. */
  isAudible: (playerId: string) => boolean;
  /** This viewer's personal volume for a player: 0 to 2 (200%). */
  volumeOf: (playerId: string) => number;
}

/**
 * Plays every remote participant's audio, independent of the video tiles.
 *
 * Sound used to come from each tile's <video> element, so a player with their
 * camera off (or hidden, or filtered out of the grid) was silent for everyone.
 * Audibility is decided by the shared media policy (night secrecy, Graveyard);
 * loudness by each viewer's own per-player volume.
 */
export function RemoteAudio({ streams, isAudible, volumeOf }: RemoteAudioProps) {
  return (
    <div aria-hidden="true" className="hidden">
      {Object.entries(streams).map(([playerId, stream]) => (
        <AudioSink
          key={playerId}
          playerId={playerId}
          stream={stream}
          muted={!isAudible(playerId)}
          volume={volumeOf(playerId)}
        />
      ))}
    </div>
  );
}

// ---- Volume plumbing -------------------------------------------------------
//
// Up to 100% we use the <audio> element's own volume: it keeps the browser's
// echo cancellation intact on laptops. Above 100% (boosting a quiet friend),
// and on iPhones/iPads where element volume is read-only, we route the sound
// through a Web Audio gain node instead.

let sharedContext: AudioContext | null = null;
function audioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  const Ctor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  sharedContext = new Ctor();
  // Browsers start audio contexts suspended until the user interacts.
  const resume = () => {
    sharedContext?.resume().catch(() => {});
  };
  document.addEventListener('pointerdown', resume);
  document.addEventListener('keydown', resume);
  return sharedContext;
}

let elementVolumeWorks: boolean | null = null;
function canSetElementVolume(): boolean {
  if (elementVolumeWorks !== null) return elementVolumeWorks;
  try {
    const probe = document.createElement('audio');
    probe.volume = 0.5;
    elementVolumeWorks = Math.abs(probe.volume - 0.5) < 0.01; // iOS keeps it at 1
  } catch {
    elementVolumeWorks = false;
  }
  return elementVolumeWorks;
}

function AudioSink({
  playerId,
  stream,
  muted,
  volume,
}: {
  playerId: string;
  stream: MediaStream;
  muted: boolean;
  volume: number;
}) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const graphRef = useRef<{ source: MediaStreamAudioSourceNode; gain: GainNode } | null>(null);

  const useGain = volume > 1 || !canSetElementVolume();

  // Attach the stream to the element (needed even when Web Audio does the
  // playing: Chrome only feeds remote WebRTC audio into Web Audio when the
  // stream is also attached to a media element).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const audioTracks = stream.getAudioTracks();
    el.srcObject = audioTracks.length ? new MediaStream(audioTracks) : null;

    el.play().catch(() => {
      // Autoplay blocked (no user gesture yet): retry on the next tap/click.
      document.addEventListener(
        'pointerdown',
        () => {
          el.play().catch(() => {});
        },
        { once: true }
      );
    });
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  // Build / tear down the gain path when it's needed.
  useEffect(() => {
    if (!useGain) return;
    const ctx = audioContext();
    const tracks = stream.getAudioTracks();
    if (!ctx || tracks.length === 0) return;
    let graph: { source: MediaStreamAudioSourceNode; gain: GainNode } | null = null;
    try {
      const source = ctx.createMediaStreamSource(new MediaStream(tracks));
      const gain = ctx.createGain();
      source.connect(gain).connect(ctx.destination);
      graph = { source, gain };
      graphRef.current = graph;
      ctx.resume().catch(() => {});
    } catch {
      graphRef.current = null;
    }
    return () => {
      if (graph) {
        graph.source.disconnect();
        graph.gain.disconnect();
      }
      graphRef.current = null;
    };
  }, [stream, useGain]);

  // Apply mute + volume to whichever path is active.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const graph = graphRef.current;
    if (useGain && graph) {
      el.muted = true; // the gain path plays it
      graph.gain.gain.value = muted ? 0 : volume;
    } else {
      el.muted = muted || volume === 0;
      if (canSetElementVolume()) el.volume = Math.min(1, Math.max(0, volume));
    }
  });

  return (
    <audio
      ref={ref}
      data-player-id={playerId}
      data-volume={volume}
      data-mode={useGain ? 'gain' : 'element'}
      data-audible={muted ? 'false' : 'true'}
      autoPlay
      playsInline
    />
  );
}
