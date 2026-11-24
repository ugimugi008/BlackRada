import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { createVoiceFilterChain, type VoiceFilterChain } from '../audio/noiseFilter';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface LiveKitCredentials {
  url: string;
  token: string;
}

interface UseMediaRoomOptions {
  socket: Socket | null;
  myPlayerId: string | null;
  roomCode: string | null;
  livekit: LiveKitCredentials | null;
  effectiveMicMuted: boolean;
  effectiveCamOff: boolean;
  noiseFilterEnabled: boolean;
}

export function useMediaRoom({
  socket,
  myPlayerId,
  roomCode,
  livekit,
  effectiveMicMuted,
  effectiveCamOff,
  noiseFilterEnabled,
}: UseMediaRoomOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
  const [sfuConnected, setSfuConnected] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const rawStreamRef = useRef<MediaStream | null>(null);
  const outgoingStreamRef = useRef<MediaStream | null>(null);
  const voiceFilterRef = useRef<VoiceFilterChain | null>(null);
  const lkRoomRef = useRef<Room | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());

  const rebuildOutgoingStream = useCallback((rawStream: MediaStream, ncEnabled: boolean) => {
    voiceFilterRef.current?.cleanup();
    voiceFilterRef.current = null;

    const tracks: MediaStreamTrack[] = [];
    const rawAudio = rawStream.getAudioTracks()[0];
    if (rawAudio) {
      const chain = createVoiceFilterChain(rawAudio, ncEnabled);
      voiceFilterRef.current = chain;
      tracks.push(chain.track);
    }
    for (const vt of rawStream.getVideoTracks()) {
      tracks.push(vt);
    }

    const combined = new MediaStream(tracks);
    outgoingStreamRef.current = combined;
    return combined;
  }, []);

  const initLocalMedia = useCallback(
    async (wantAudio: boolean, wantVideo: boolean) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setMediaError('Camera and microphone require HTTPS or localhost.');
        return null;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: wantAudio
            ? {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }
            : false,
          video: wantVideo
            ? {
                width: { ideal: 640 },
                height: { ideal: 360 },
                frameRate: { ideal: 24, max: 30 },
                facingMode: 'user',
              }
            : false,
        });

        rawStreamRef.current?.getTracks().forEach((t) => t.stop());
        rawStreamRef.current = stream;
        const processed = rebuildOutgoingStream(stream, noiseFilterEnabled);
        setLocalStream(stream);
        setMediaError(null);
        return processed;
      } catch {
        if (wantVideo && wantAudio) {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
              video: false,
            });
            rawStreamRef.current?.getTracks().forEach((t) => t.stop());
            rawStreamRef.current = audioOnly;
            const processed = rebuildOutgoingStream(audioOnly, noiseFilterEnabled);
            setLocalStream(audioOnly);
            setMediaError('Camera unavailable — audio connected.');
            return processed;
          } catch {
            setMediaError(
              'Camera/microphone not detected or permission denied. You can still play with avatar tiles.'
            );
            return null;
          }
        }
        setMediaError('Camera/microphone not detected or permission denied.');
        return null;
      }
    },
    [noiseFilterEnabled, rebuildOutgoingStream]
  );

  const stopLocalMedia = useCallback(() => {
    voiceFilterRef.current?.cleanup();
    voiceFilterRef.current = null;
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    outgoingStreamRef.current = null;
    setLocalStream(null);
  }, []);

  // Toggle noise filter dynamically without tearing down the mic stream
  useEffect(() => {
    voiceFilterRef.current?.setEnabled(noiseFilterEnabled);
  }, [noiseFilterEnabled]);

  // Apply mute & camera hide flags (personal + Night sleep + Moderator override)
  useEffect(() => {
    const raw = rawStreamRef.current;
    const out = outgoingStreamRef.current;
    if (raw) {
      raw.getAudioTracks().forEach((t) => {
        t.enabled = !effectiveMicMuted;
      });
      raw.getVideoTracks().forEach((t) => {
        t.enabled = !effectiveCamOff;
      });
    }
    if (out) {
      out.getAudioTracks().forEach((t) => {
        t.enabled = !effectiveMicMuted;
      });
      out.getVideoTracks().forEach((t) => {
        t.enabled = !effectiveCamOff;
      });
    }
    if (lkRoomRef.current) {
      lkRoomRef.current.localParticipant.setMicrophoneEnabled(!effectiveMicMuted).catch(() => {});
      lkRoomRef.current.localParticipant.setCameraEnabled(!effectiveCamOff).catch(() => {});
    }
  }, [effectiveMicMuted, effectiveCamOff, localStream]);

  // Connect to LiveKit SFU when credentials are provided by server
  useEffect(() => {
    if (!livekit || !roomCode || !myPlayerId) {
      setSfuConnected(false);
      return;
    }

    const lkRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h540.resolution,
      },
      publishDefaults: {
        simulcast: true,
      },
    });
    lkRoomRef.current = lkRoom;

    const syncRemoteParticipant = (participant: RemoteParticipant) => {
      const tracks: MediaStreamTrack[] = [];
      participant.trackPublications.forEach((pub) => {
        if (pub.track?.mediaStreamTrack) {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
      setRemoteStreams((prev) => {
        if (tracks.length === 0) {
          const copy = { ...prev };
          delete copy[participant.identity];
          return copy;
        }
        return { ...prev, [participant.identity]: new MediaStream(tracks) };
      });
    };

    lkRoom.on(
      RoomEvent.TrackSubscribed,
      (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        syncRemoteParticipant(participant);
      }
    );

    lkRoom.on(
      RoomEvent.TrackUnsubscribed,
      (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        syncRemoteParticipant(participant);
      }
    );

    lkRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[participant.identity];
        return copy;
      });
    });

    lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const next: Record<string, boolean> = {};
      for (const s of speakers) {
        next[s.identity] = true;
      }
      setSpeakingMap(next);
    });

    let cancelled = false;
    lkRoom
      .connect(livekit.url, livekit.token)
      .then(async () => {
        if (cancelled) return;
        setSfuConnected(true);
        const out = outgoingStreamRef.current;
        if (out) {
          const audioTrack = out.getAudioTracks()[0];
          const videoTrack = out.getVideoTracks()[0];
          if (audioTrack) {
            await lkRoom.localParticipant
              .publishTrack(audioTrack, { source: Track.Source.Microphone })
              .catch(() => {});
          }
          if (videoTrack) {
            await lkRoom.localParticipant
              .publishTrack(videoTrack, { source: Track.Source.Camera, simulcast: true })
              .catch(() => {});
          }
        }
      })
      .catch(() => {
        setSfuConnected(false);
      });

    return () => {
      cancelled = true;
      lkRoom.disconnect().catch(() => {});
      lkRoomRef.current = null;
      setSfuConnected(false);
    };
  }, [livekit, roomCode, myPlayerId]);

  // Publish local tracks to LiveKit if localStream arrives after room join
  useEffect(() => {
    const lkRoom = lkRoomRef.current;
    const out = outgoingStreamRef.current;
    if (!lkRoom || !sfuConnected || !out) return;

    const audioTrack = out.getAudioTracks()[0];
    const videoTrack = out.getVideoTracks()[0];
    if (audioTrack && !lkRoom.localParticipant.getTrackPublication(Track.Source.Microphone)) {
      lkRoom.localParticipant
        .publishTrack(audioTrack, { source: Track.Source.Microphone })
        .catch(() => {});
    }
    if (videoTrack && !lkRoom.localParticipant.getTrackPublication(Track.Source.Camera)) {
      lkRoom.localParticipant
        .publishTrack(videoTrack, { source: Track.Source.Camera, simulcast: true })
        .catch(() => {});
    }
  }, [localStream, sfuConnected]);

  // Attach processed local tracks to WebRTC mesh peers when NOT using LiveKit SFU
  useEffect(() => {
    if (livekit) return;
    const out = outgoingStreamRef.current;
    if (!out) return;
    for (const pc of peersRef.current.values()) {
      const senders = pc.getSenders();
      for (const track of out.getTracks()) {
        const existing = senders.find((s) => s.track?.kind === track.kind);
        if (existing) {
          existing.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, out);
        }
      }
    }
  }, [localStream, livekit]);

  const registerAudioMonitor = useCallback((peerId: string, stream: MediaStream) => {
    if (typeof window === 'undefined' || !stream.getAudioTracks().length) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analysersRef.current.set(peerId, {
        analyser,
        data: new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>,
      });
    } catch {
      // Ignore in headless browsers
    }
  }, []);

  useEffect(() => {
    const out = outgoingStreamRef.current;
    if (!livekit && myPlayerId && out) {
      registerAudioMonitor(myPlayerId, out);
    }
  }, [livekit, myPlayerId, localStream, registerAudioMonitor]);

  useEffect(() => {
    if (livekit) return;
    const timer = window.setInterval(() => {
      if (analysersRef.current.size === 0) return;
      const next: Record<string, boolean> = {};
      for (const [id, entry] of analysersRef.current.entries()) {
        if (id === myPlayerId && effectiveMicMuted) {
          next[id] = false;
          continue;
        }
        entry.analyser.getByteFrequencyData(entry.data);
        let sum = 0;
        for (let i = 0; i < entry.data.length; i++) sum += entry.data[i];
        next[id] = sum / entry.data.length > 16;
      }
      setSpeakingMap(next);
    }, 250);
    return () => window.clearInterval(timer);
  }, [livekit, myPlayerId, effectiveMicMuted]);

  const createPeerConnection = useCallback(
    (peerId: string, initiateOffer: boolean) => {
      if (livekit || !socket || !myPlayerId) return null;
      const existing = peersRef.current.get(peerId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(peerId, pc);

      const out = outgoingStreamRef.current;
      if (out) {
        for (const track of out.getTracks()) {
          pc.addTrack(track, out);
        }
      } else {
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('rtc:signal', {
            targetPlayerId: peerId,
            signal: { type: 'candidate', candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
        registerAudioMonitor(peerId, stream);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          peersRef.current.delete(peerId);
          analysersRef.current.delete(peerId);
          setRemoteStreams((prev) => {
            const copy = { ...prev };
            delete copy[peerId];
            return copy;
          });
        }
      };

      if (initiateOffer) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('rtc:signal', {
              targetPlayerId: peerId,
              signal: { type: 'sdp', description: pc.localDescription },
            });
          })
          .catch(() => {});
      }

      return pc;
    },
    [livekit, socket, myPlayerId, registerAudioMonitor]
  );

  const connectToPeers = useCallback(
    (peerIds: string[]) => {
      if (livekit) return;
      for (const peerId of peerIds) {
        if (peerId !== myPlayerId) {
          createPeerConnection(peerId, true);
        }
      }
    },
    [livekit, myPlayerId, createPeerConnection]
  );

  const closeAllPeers = useCallback(() => {
    for (const pc of peersRef.current.values()) {
      pc.close();
    }
    peersRef.current.clear();
    analysersRef.current.clear();
    lkRoomRef.current?.disconnect().catch(() => {});
    lkRoomRef.current = null;
    setRemoteStreams({});
    setSfuConnected(false);
  }, []);

  useEffect(() => {
    if (livekit || !socket || !roomCode || !myPlayerId) return;

    const onPeerJoined = ({ playerId }: { playerId: string }) => {
      if (playerId === myPlayerId) return;
      createPeerConnection(playerId, false);
    };

    const onPeerLeft = ({ playerId }: { playerId: string }) => {
      const pc = peersRef.current.get(playerId);
      if (pc) {
        pc.close();
        peersRef.current.delete(playerId);
      }
      analysersRef.current.delete(playerId);
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[playerId];
        return copy;
      });
    };

    const onSignal = async ({
      fromPlayerId,
      signal,
    }: {
      fromPlayerId: string;
      signal: {
        type: 'sdp' | 'candidate';
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
      };
    }) => {
      const pc = peersRef.current.get(fromPlayerId) ?? createPeerConnection(fromPlayerId, false);
      if (!pc) return;

      try {
        if (signal.type === 'sdp' && signal.description) {
          const polite = myPlayerId < fromPlayerId;
          const offerCollision =
            signal.description.type === 'offer' && pc.signalingState !== 'stable';
          if (offerCollision && !polite) return;

          await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
          if (signal.description.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('rtc:signal', {
              targetPlayerId: fromPlayerId,
              signal: { type: 'sdp', description: pc.localDescription },
            });
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch {
        // Ignore transient ICE race
      }
    };

    socket.on('rtc:peerJoined', onPeerJoined);
    socket.on('rtc:peerLeft', onPeerLeft);
    socket.on('rtc:signal', onSignal);

    return () => {
      socket.off('rtc:peerJoined', onPeerJoined);
      socket.off('rtc:peerLeft', onPeerLeft);
      socket.off('rtc:signal', onSignal);
    };
  }, [livekit, socket, roomCode, myPlayerId, createPeerConnection]);

  useEffect(() => {
    return () => {
      closeAllPeers();
      stopLocalMedia();
    };
  }, [closeAllPeers, stopLocalMedia]);

  return {
    localStream,
    remoteStreams,
    mediaError,
    speakingMap,
    sfuConnected,
    initLocalMedia,
    stopLocalMedia,
    connectToPeers,
    closeAllPeers,
  };
}
