import { useEffect, useRef } from 'react';

interface RemoteAudioProps {
  streams: Record<string, MediaStream>;
  /** Whether this viewer should hear the given player right now. */
  isAudible: (playerId: string) => boolean;
}

/**
 * Plays every remote participant's audio, independent of the video tiles.
 *
 * Before this, sound came from each tile's <video> element, so a player with
 * their camera off (or hidden, or filtered out of the grid) was silent for
 * everyone. Audibility is decided by the shared media policy (night secrecy,
 * Graveyard), not by what happens to be on screen.
 */
export function RemoteAudio({ streams, isAudible }: RemoteAudioProps) {
  return (
    <div aria-hidden="true" className="hidden">
      {Object.entries(streams).map(([playerId, stream]) => (
        <AudioSink key={playerId} playerId={playerId} stream={stream} muted={!isAudible(playerId)} />
      ))}
    </div>
  );
}

function AudioSink({ playerId, stream, muted }: { playerId: string; stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const audioTracks = stream.getAudioTracks();
    el.srcObject = audioTracks.length ? new MediaStream(audioTracks) : null;

    const tryPlay = () => {
      el.play().catch(() => {
        // Autoplay blocked (no user gesture yet): retry on the next tap/click.
        const retry = () => {
          el.play().catch(() => {});
        };
        document.addEventListener('pointerdown', retry, { once: true });
      });
    };
    tryPlay();
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return <audio ref={ref} data-player-id={playerId} autoPlay playsInline muted={muted} />;
}
