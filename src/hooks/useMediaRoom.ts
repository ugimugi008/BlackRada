import {
  Room,
  RoomEvent,
  Track,
  VideoPreset,
  VideoPresets,
  VideoQuality,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { isPhoneDevice } from '../shared/videoQuality';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

/** What this viewer wants to receive from one remote player (LiveKit mode). */
export type RemoteVideoPref = 'off' | 'low' | 'medium' | 'high';
export interface RemotePref {
  video: RemoteVideoPref;
  audio: boolean;
}

const VIDEO_QUALITY: Record<Exclude<RemoteVideoPref, 'off'>, VideoQuality> = {
  low: VideoQuality.LOW, // 180p layer (weak connections)
  medium: VideoQuality.MEDIUM, // 360p layer
  high: VideoQuality.HIGH, // 720p layer
};

// Camera publishing. The server forwards each viewer only the layer they asked
// for (dynacast stops layers nobody needs). VP8 on purpose: VP9/AV1 in LiveKit use
// SVC and are heavy to encode on phones.
//
// Smoothness first:
//  - layers 720p / 360p / 180p. The tiny 180p layer (~0.15 Mbps) is what lets the
//    server keep video moving for someone on a weak or lossy connection instead of
//    freezing it (10 people at 180p fit in ~1.5 Mbps).
//  - moderate bitrates so home upload links keep up
//  - "maintain-framerate": a struggling sender lowers resolution instead of freezing
//  - phones send at 24 fps with a lower top bitrate to stay cool
const LAYER_360 = new VideoPreset(640, 360, 450_000, 30);
const LAYER_180 = new VideoPreset(320, 180, 150_000, 15);
const LAYER_360_PHONE = new VideoPreset(640, 360, 400_000, 24);
const LAYER_180_PHONE = new VideoPreset(320, 180, 120_000, 15);
const PHONE_PUBLISHER = isPhoneDevice();
const CAMERA_PUBLISH = {
  source: Track.Source.Camera,
  simulcast: true,
  videoCodec: 'vp8' as const,
  degradationPreference: 'maintain-framerate' as RTCDegradationPreference,
  videoEncoding: PHONE_PUBLISHER
    ? { maxBitrate: 1_000_000, maxFramerate: 24 }
    : { maxBitrate: 1_500_000, maxFramerate: 30 },
  videoSimulcastLayers: PHONE_PUBLISHER ? [LAYER_180_PHONE, LAYER_360_PHONE] : [LAYER_180, LAYER_360],
};
const MIC_PUBLISH = { source: Track.Source.Microphone, dtx: false, red: true };

/** Peer-to-peer mesh sends a separate copy to every peer, so keep it light. */
function tuneMeshVideoSender(sender: RTCRtpSender) {
  if (sender.track?.kind !== 'video') return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
    params.encodings[0].scaleResolutionDownBy = 2;
    params.encodings[0].maxBitrate = 600_000;
    sender.setParameters(params).catch(() => {});
  } catch {
    // Older browsers: keep defaults
  }
}

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
  /** Per remote player: which video quality to receive and whether to receive audio. */
  remotePrefs?: Record<string, RemotePref>;
}

export function useMediaRoom({
  socket,
  myPlayerId,
  roomCode,
  livekit,
  effectiveMicMuted,
  effectiveCamOff,
  noiseFilterEnabled,
  remotePrefs,
}: UseMediaRoomOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [speakingMap, setSpeakingMap] = useState<Record<string, boolean>>({});
  const [sfuConnected, setSfuConnected] = useState(false);

  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const rawStreamRef = useRef<MediaStream | null>(null);
  const outgoingStreamRef = useRef<MediaStream | null>(null);
  const lkRoomRef = useRef<Room | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());

  // The mic goes out exactly as the browser captured it: the browser's own echo
  // cancellation, noise suppression and auto-gain (the same processing Google Meet
  // relies on). No extra noise gate — on phones it cut off quiet words.
  const rebuildOutgoingStream = useCallback((rawStream: MediaStream) => {
    const tracks: MediaStreamTrack[] = [];
    const rawAudio = rawStream.getAudioTracks()[0];
    if (rawAudio) tracks.push(rawAudio);
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
                noiseSuppression: noiseFilterEnabled,
                autoGainControl: true,
              }
            : false,
          video: wantVideo
            ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
                facingMode: 'user',
              }
            : false,
        });

        rawStreamRef.current?.getTracks().forEach((t) => t.stop());
        rawStreamRef.current = stream;
        const processed = rebuildOutgoingStream(stream);
        setLocalStream(stream);
        setMediaError(null);
        return processed;
      } catch {
        if (wantVideo && wantAudio) {
          try {
            const audioOnly = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: noiseFilterEnabled,
                autoGainControl: true,
              },
              video: false,
            });
            rawStreamRef.current?.getTracks().forEach((t) => t.stop());
            rawStreamRef.current = audioOnly;
            const processed = rebuildOutgoingStream(audioOnly);
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
    rawStreamRef.current?.getTracks().forEach((t) => t.stop());
    rawStreamRef.current = null;
    outgoingStreamRef.current = null;
    setLocalStream(null);
  }, []);

  // "Noise filter" = the browser's built-in noise suppression. Browsers (Chrome)
  // ignore changing it on a live track, and while the old mic is open a new one
  // inherits its processing — so we close the mic, re-open it with the new setting
  // and swap it into the call (a fraction of a second; camera untouched, mute kept).
  useEffect(() => {
    const raw = rawStreamRef.current;
    const old = raw?.getAudioTracks()[0];
    if (!raw || !old || old.readyState !== 'live') return;
    if (old.getSettings().noiseSuppression === noiseFilterEnabled) return;
    let cancelled = false;
    const deviceId = old.getSettings().deviceId;
    const wasEnabled = old.enabled;
    const openMic = (noiseSuppression: boolean) =>
      navigator.mediaDevices.getUserMedia({
        audio: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression,
        },
      });
    old.stop();
    openMic(noiseFilterEnabled)
      // if the browser refuses, re-open with the previous setting rather than leave the mic dead
      .catch(() => openMic(!noiseFilterEnabled))
      .then(async (fresh) => {
        const track = fresh.getAudioTracks()[0];
        if (cancelled || !track || rawStreamRef.current !== raw) {
          fresh.getTracks().forEach((t) => t.stop());
          return;
        }
        track.enabled = wasEnabled;
        raw.removeTrack(old);
        raw.addTrack(track);
        const out = outgoingStreamRef.current;
        if (out && out !== raw) {
          out.removeTrack(old);
          out.addTrack(track);
        }
        // LiveKit
        const pub = lkRoomRef.current?.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (pub?.audioTrack) await pub.audioTrack.replaceTrack(track, true).catch(() => {});
        // direct (mesh) fallback
        peersRef.current.forEach((pc) =>
          pc.getSenders().forEach((sender) => {
            if (sender.track === old) sender.replaceTrack(track).catch(() => {});
          })
        );
        setLocalStream(new MediaStream(raw.getTracks()));
      })
      .catch(() => {
        // no microphone available at all; the mic button will show the problem
      });
    return () => {
      cancelled = true;
    };
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

  // Latest per-player receive preferences (read inside LiveKit event handlers).
  const prefsRef = useRef<Record<string, RemotePref> | undefined>(remotePrefs);
  prefsRef.current = remotePrefs;
  const prefsKey = JSON.stringify(remotePrefs ?? {});

  useEffect(() => {
    const lkRoom = lkRoomRef.current;
    if (!lkRoom || !sfuConnected) return;
    lkRoom.remoteParticipants.forEach((participant) => {
      const pref = prefsRef.current?.[participant.identity];
      participant.trackPublications.forEach((pub) => applyPref(pub, pref));
    });
  }, [prefsKey, sfuConnected]);

  // Connect to LiveKit SFU when credentials are provided by server
  useEffect(() => {
    if (!livekit || !roomCode || !myPlayerId) {
      setSfuConnected(false);
      return;
    }

    // adaptiveStream must stay OFF: it sizes video by elements attached through
    // LiveKit, and our tiles use their own <video> elements, so it treated every
    // remote camera as hidden (paused / lowest quality). We request quality per
    // tile ourselves via remotePrefs instead.
    const lkRoom = new Room({
      adaptiveStream: false,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: CAMERA_PUBLISH.videoSimulcastLayers,
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
      (_track: RemoteTrack, pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        applyPref(pub, prefsRef.current?.[participant.identity]);
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
              .publishTrack(audioTrack, MIC_PUBLISH)
              .catch(() => {});
          }
          if (videoTrack) {
            await lkRoom.localParticipant.publishTrack(videoTrack, CAMERA_PUBLISH).catch(() => {});
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
        .publishTrack(audioTrack, MIC_PUBLISH)
        .catch(() => {});
    }
    if (videoTrack && !lkRoom.localParticipant.getTrackPublication(Track.Source.Camera)) {
      lkRoom.localParticipant.publishTrack(videoTrack, CAMERA_PUBLISH).catch(() => {});
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
          tuneMeshVideoSender(pc.addTrack(track, out));
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
          tuneMeshVideoSender(pc.addTrack(track, out));
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

/**
 * Tell the LiveKit server what to send us for one publication. Turning a track
 * off means the server stops forwarding it entirely (saves bandwidth, and the
 * audio/video of people we may not perceive never reaches this browser).
 */
function applyPref(pub: RemoteTrackPublication, pref: RemotePref | undefined) {
  const wanted: RemotePref = pref ?? { video: 'medium', audio: true };
  if (pub.kind === Track.Kind.Video) {
    if (wanted.video === 'off') {
      pub.setEnabled(false);
    } else {
      pub.setEnabled(true);
      pub.setVideoQuality(VIDEO_QUALITY[wanted.video]);
    }
  } else if (pub.kind === Track.Kind.Audio) {
    pub.setEnabled(wanted.audio);
  }
}
