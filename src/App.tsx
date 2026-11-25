import {
  AudioLines,
  Camera,
  CameraOff,
  Check,
  ChevronRight,
  Copy,
  Crown,
  Ghost,
  LogOut,
  Maximize,
  Mic,
  MicOff,
  Minimize,
  Moon,
  PanelRight,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
  Vote,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { JoinScreen } from './components/JoinScreen';
import { ModeratorPanel } from './components/ModeratorPanel';
import { PlayerSidePanel } from './components/PlayerSidePanel';
import { RemoteAudio } from './components/RemoteAudio';
import { WebcamTile, type TileDisplay, type TileSize } from './components/WebcamTile';
import { useMediaRoom, type LiveKitCredentials, type RemotePref } from './hooks/useMediaRoom';
import { formatLog, type LogEntry } from './shared/gameLog';
import { TRANSLATIONS, formatPhaseLabel, type Language } from './shared/i18n';
import { isAwakeForMedia, isGraveyardActive, isInGraveyard, perceive } from './shared/mediaPolicy';
import {
  isPlayerAwakeDuringNight,
  tallyVotes,
  type MafiaRole,
  type NightStep,
  type RoleConfig,
  type RoomPublicState,
} from './shared/mafiaEngine';
import BrandLogo from './components/BrandLogo';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;
const LANG_STORAGE_KEY = 'black_rada_lang';

function resolveInitialLanguage(urlParams: URLSearchParams): Language {
  const paramLang = urlParams.get('lang');
  if (paramLang === 'uk' || paramLang === 'en') return paramLang;
  try {
    const saved = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (saved === 'uk' || saved === 'en') return saved;
  } catch {
    // Ignore storage access errors
  }
  return 'en';
}

export default function App() {
  const urlParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const [lang, setLang] = useState<Language>(() => resolveInitialLanguage(urlParams));
  const t = TRANSLATIONS[lang];

  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<RoomPublicState | null>(null);
  const [livekit, setLivekit] = useState<LiveKitCredentials | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [noiseFilterEnabled, setNoiseFilterEnabled] = useState(true);
  const [seatFilter, setSeatFilter] = useState<'all' | 'alive'>('all');
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [moderatorListening, setModeratorListening] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false); // Moderator: collapsed by default
  const [graveyardMuted, setGraveyardMuted] = useState(false); // eliminated player: focus on the game
  const [isFullscreen, setIsFullscreen] = useState(false);
  const focusStageRef = useRef<HTMLDivElement | null>(null);
  const pendingPeerIdsRef = useRef<string[] | null>(null);
  // Stored as a translatable entry so it follows the EN/UA switch.
  const [nightFeedback, setNightFeedback] = useState<LogEntry | string | null>(null);
  const [errorEntry, setErrorEntry] = useState<LogEntry | null>(null);
  const [takeoverError, setTakeoverError] = useState<string | null>(null);
  const [selectedNightTargetId, setSelectedNightTargetId] = useState<string | null>(null);

  // Auth tokens live strictly in memory (not localStorage/sessionStorage)
  const playerIdRef = useRef<string | null>(null);
  const playerTokenRef = useRef<string | null>(null);
  const moderatorTokenRef = useRef<string | null>(null);
  const roomCodeRef = useRef<string | null>(null);

  const initialRoomCode = (urlParams.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const autostart = urlParams.get('autostart') === '1';
  const autostartTriggeredRef = useRef(false);

  const handleChangeLang = useCallback((nextLang: Language) => {
    setLang(nextLang);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, nextLang);
    } catch {
      // Ignore storage access errors
    }
  }, []);

  const me = room?.players.find((p) => p.id === room.myPlayerId) ?? null;
  // Sleeping players go dark at night; eliminated players stay live (only the Graveyard sees them).
  const mediaAwake = !room || !me ? true : isAwakeForMedia(me, room.phase, room.nightStep);

  const effectiveMicMuted = Boolean(micMuted || me?.modForceMuted || !mediaAwake);
  const effectiveCamOff = Boolean(camOff || me?.modForceCamHidden || !mediaAwake);

  // What to receive from each remote player (LiveKit mode): nothing for people this
  // viewer may not see/hear, and a video layer sized to how big their tile is.
  const remotePrefs = useMemo(() => {
    const prefs: Record<string, RemotePref> = {};
    if (!room || !me) return prefs;
    const ctx = {
      phase: room.phase,
      nightStep: room.nightStep,
      moderatorListeningToGraveyard: moderatorListening,
      deadViewerMutedGraveyard: graveyardMuted,
    };
    const narrow = typeof window !== 'undefined' && window.innerWidth < 768;
    const gridTiles = room.players.filter((p) => seatFilter === 'all' || p.isAlive || p.isModerator).length;
    const gridQuality: RemotePref['video'] = gridTiles <= 4 ? 'high' : narrow && gridTiles > 6 ? 'low' : 'medium';
    for (const p of room.players) {
      if (p.id === me.id) continue;
      const perc = perceive(me, p, ctx);
      let video: RemotePref['video'] = gridQuality;
      if (!perc.see || p.camOff || p.modForceCamHidden) video = 'off';
      else if (focusedId) video = focusedId === p.id ? 'high' : 'low';
      else if (me.isModerator && isInGraveyard(p, room.phase) && !graveyardOpen) video = 'off';
      else if (seatFilter === 'alive' && !p.isAlive && !p.isModerator) video = 'off';
      prefs[p.id] = { video, audio: perc.hear };
    }
    return prefs;
  }, [room, me, focusedId, moderatorListening, graveyardMuted, graveyardOpen, seatFilter]);

  const {
    localStream,
    remoteStreams,
    mediaError,
    speakingMap,
    initLocalMedia,
    connectToPeers,
    closeAllPeers,
  } = useMediaRoom({
    socket,
    myPlayerId: room?.myPlayerId ?? null,
    roomCode: room?.code ?? null,
    livekit,
    effectiveMicMuted,
    effectiveCamOff,
    noiseFilterEnabled,
    remotePrefs,
  });

  // Peer-to-peer mode: dial the existing players only after our own id is known;
  // calling earlier silently did nothing, so joiners never connected.
  useEffect(() => {
    const pending = pendingPeerIdsRef.current;
    if (!pending || !room?.myPlayerId) return;
    pendingPeerIdsRef.current = null;
    connectToPeers(pending);
  }, [room?.myPlayerId, connectToPeers]);

  // Focus view: Esc leaves it (the browser handles Esc for real fullscreen first).
  useEffect(() => {
    if (!focusedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.fullscreenElement) setFocusedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedId]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Drop focus if that player left; stop Graveyard listening once the game is over.
  useEffect(() => {
    if (focusedId && room && !room.players.some((p) => p.id === focusedId)) setFocusedId(null);
    if (room && !isGraveyardActive(room.phase)) {
      setModeratorListening(false);
      setGraveyardOpen(false);
      setGraveyardMuted(false);
    }
  }, [room, focusedId]);

  const toggleFullscreen = useCallback(() => {
    const el = focusStageRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    setSocket(s);

    s.on('room:state', (nextState: RoomPublicState) => {
      if (!nextState.isMeModerator) moderatorTokenRef.current = null;
      setRoom(nextState);
      roomCodeRef.current = nextState.code;
    });

    s.on('room:moderatorToken', (payload: { moderatorToken?: string }) => {
      if (payload?.moderatorToken) moderatorTokenRef.current = payload.moderatorToken;
    });

    s.on('room:kicked', (payload: { reason?: string }) => {
      setRoom(null);
      setLivekit(null);
      playerIdRef.current = null;
      playerTokenRef.current = null;
      moderatorTokenRef.current = null;
      roomCodeRef.current = null;
      setErrorMessage(payload?.reason || 'You were removed from the room.');
    });

    s.on('connect', () => {
      if (roomCodeRef.current && playerIdRef.current && playerTokenRef.current) {
        s.emit(
          'room:join',
          {
            code: roomCodeRef.current,
            reconnectPlayerId: playerIdRef.current,
            reconnectToken: playerTokenRef.current,
            micMuted,
            camOff,
          },
          (res: {
            ok?: boolean;
            state?: RoomPublicState;
            peerIds?: string[];
            livekit?: LiveKitCredentials | null;
          }) => {
            if (res?.ok && res.state) {
              setRoom(res.state);
              setLivekit(res.livekit ?? null);
              if (res.peerIds?.length) pendingPeerIdsRef.current = res.peerIds;
            }
          }
        );
      }
    });

    return () => {
      s.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setNightFeedback(null);
    setSelectedNightTargetId(null);
  }, [room?.phase, room?.nightStep]);

  const handleCreateRoom = useCallback(
    async (nickname: string, roomName: string) => {
      if (!socket) return;
      setConnecting(true);
      setErrorMessage(null);
      socket.emit(
        'room:create',
        { nickname, roomName, micMuted, camOff },
        (res: {
          ok?: boolean;
          error?: string;
          code?: string;
          playerId?: string;
          playerToken?: string;
          moderatorToken?: string;
          state?: RoomPublicState;
          livekit?: LiveKitCredentials | null;
        }) => {
          setConnecting(false);
          if (!res?.ok || !res.state) {
            setErrorMessage(res?.error || 'Could not create room.');
            return;
          }
          playerIdRef.current = res.playerId ?? null;
          playerTokenRef.current = res.playerToken ?? null;
          moderatorTokenRef.current = res.moderatorToken ?? null;
          roomCodeRef.current = res.code ?? null;
          setLivekit(res.livekit ?? null);
          setRoom(res.state);
        }
      );
    },
    [socket, micMuted, camOff]
  );

  const handleJoinRoom = useCallback(
    async (code: string, nickname: string) => {
      if (!socket) return;
      setConnecting(true);
      setErrorMessage(null);
      setErrorEntry(null);
      socket.emit(
        'room:join',
        { code, nickname, micMuted, camOff },
        (res: {
          ok?: boolean;
          error?: string;
          errorEntry?: LogEntry;
          code?: string;
          playerId?: string;
          playerToken?: string;
          state?: RoomPublicState;
          peerIds?: string[];
          livekit?: LiveKitCredentials | null;
        }) => {
          setConnecting(false);
          if (!res?.ok || !res.state) {
            setErrorEntry(res?.errorEntry ?? null);
            setErrorMessage(res?.error || 'Could not join room.');
            return;
          }
          playerIdRef.current = res.playerId ?? null;
          playerTokenRef.current = res.playerToken ?? null;
          moderatorTokenRef.current = null;
          roomCodeRef.current = res.code ?? null;
          setLivekit(res.livekit ?? null);
          setRoom(res.state);
          // Connect once this client knows its own player id (set by setRoom above).
          if (res.peerIds?.length) pendingPeerIdsRef.current = res.peerIds;
        }
      );
    },
    [socket, micMuted, camOff, connectToPeers]
  );

  useEffect(() => {
    if (autostart && socket && !room && !autostartTriggeredRef.current) {
      autostartTriggeredRef.current = true;
      handleCreateRoom(lang === 'uk' ? 'Ведучий' : 'Moderator', 'Friday Night Mafia');
    }
  }, [autostart, socket, room, handleCreateRoom, lang]);

  const handleToggleMic = () => {
    const next = !micMuted;
    setMicMuted(next);
    socket?.emit('player:mediaState', { micMuted: next, camOff });
  };

  const handleToggleCam = async () => {
    if (!localStream && camOff) {
      await initLocalMedia(true, true);
    }
    const next = !camOff;
    setCamOff(next);
    socket?.emit('player:mediaState', { micMuted, camOff: next });
  };

  const handleLeaveRoom = () => {
    socket?.emit('room:leave');
    closeAllPeers();
    setRoom(null);
    setLivekit(null);
    playerIdRef.current = null;
    playerTokenRef.current = null;
    moderatorTokenRef.current = null;
    roomCodeRef.current = null;
  };

  const handleCopyInvite = () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.code}&lang=${lang}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedInvite(true);
    window.setTimeout(() => setCopiedInvite(false), 1800);
  };

  const handleClaimModerator = () => {
    setTakeoverError(null);
    socket?.emit(
      'room:claimModerator',
      {},
      (res: { ok?: boolean; error?: string; errorEntry?: LogEntry; moderatorToken?: string; retryInSeconds?: number }) => {
        if (res?.ok && res.moderatorToken) {
          moderatorTokenRef.current = res.moderatorToken;
        } else if (res?.retryInSeconds) {
          setTakeoverError(t.takeoverWait.replace('{s}', String(res.retryInSeconds)));
          window.setTimeout(() => setTakeoverError(null), 4000);
        } else if (res?.error) {
          setTakeoverError(res.errorEntry ? formatLog(t, res.errorEntry, res.error) : res.error);
          window.setTimeout(() => setTakeoverError(null), 4000);
        }
      }
    );
  };

  const emitMod = (event: string, payload: Record<string, unknown> = {}) => {
    socket?.emit(event, {
      ...payload,
      moderatorToken: moderatorTokenRef.current,
    });
  };

  if (!room) {
    return (
      <>
        <JoinScreen
          lang={lang}
          t={t}
          onChangeLang={handleChangeLang}
          initialRoomCode={initialRoomCode}
          localStream={localStream}
          micMuted={micMuted}
          camOff={camOff}
          noiseFilterEnabled={noiseFilterEnabled}
          mediaError={mediaError}
          connecting={connecting}
          errorMessage={errorEntry ? formatLog(t, errorEntry, errorMessage ?? '') : errorMessage}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          onToggleNoiseFilter={() => setNoiseFilterEnabled((v) => !v)}
          onRequestMedia={() => {
            void initLocalMedia(true, true);
          }}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
      </>
    );
  }

  const moderatorPlayer = room.players.find((p) => p.isModerator) ?? null;
  const seatedPlayers = room.players.filter((p) => !p.isModerator);
  const aliveSeated = seatedPlayers.filter((p) => p.isAlive);
  const visibleSeatedPlayers =
    seatFilter === 'alive' ? aliveSeated : seatedPlayers;
  const aliveIds = new Set(aliveSeated.map((p) => p.id));
  const voteTally = tallyVotes(room.votes, aliveIds);

  // ---- Who sees / hears whom (night secrecy + Graveyard), from the shared media policy
  const mediaCtx = {
    phase: room.phase,
    nightStep: room.nightStep,
    moderatorListeningToGraveyard: moderatorListening,
    deadViewerMutedGraveyard: graveyardMuted,
  };
  const graveyardActive = isGraveyardActive(room.phase);
  const iAmDead = Boolean(me && isInGraveyard(me, room.phase));
  const seesGraveyardRoom = graveyardActive && (room.isMeModerator || iAmDead);
  const graveyardPlayers = graveyardActive ? seatedPlayers.filter((p) => !p.isAlive) : [];
  const tablePlayers = seesGraveyardRoom
    ? visibleSeatedPlayers.filter((p) => p.isAlive)
    : visibleSeatedPlayers;

  const tileDisplayFor = (p: (typeof room.players)[number]): TileDisplay => {
    if (p.id === room.myPlayerId) return 'video';
    if (perceive(me, p, mediaCtx).see) return 'video';
    return isInGraveyard(p, room.phase) ? 'graveyard' : 'sleeping';
  };

  const isAudible = (playerId: string) => {
    const p = room.players.find((x) => x.id === playerId);
    if (!p) return false;
    return perceive(me, p, mediaCtx).hear && !p.micMuted && !p.modForceMuted;
  };

  const toggleFocus = (playerId: string) => {
    setFocusedId((cur) => (cur === playerId ? null : playerId));
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  const renderTile = (player: (typeof room.players)[number], size: TileSize) => {
    const isMe = player.id === room.myPlayerId;
    const display = tileDisplayFor(player);
    const hearsThem = isMe || perceive(me, player, mediaCtx).hear;
    return (
      <WebcamTile
        key={`${size}-${player.id}`}
        t={t}
        player={player}
        stream={isMe ? localStream : remoteStreams[player.id] ?? null}
        isMe={isMe}
        isSpeaking={Boolean(speakingMap[player.id]) && hearsThem}
        display={display}
        ghost={!player.isModerator && isInGraveyard(player, room.phase) && seesGraveyardRoom}
        viewerIsModerator={room.isMeModerator}
        voteCount={player.isModerator ? 0 : voteTally.counts[player.id] || 0}
        isSelectedTarget={!player.isModerator && selectedTileTargetId === player.id}
        actionButtonLabel={!player.isModerator && player.isAlive ? tileActionLabel : null}
        size={size}
        isFocused={focusedId === player.id}
        seatCount={seatedPlayers.length}
        onToggleFocus={toggleFocus}
        onSelectTarget={player.isModerator ? undefined : handleTileTargetSelect}
        onModeratorRename={(id, name) => emitMod('mod:renamePlayer', { targetPlayerId: id, nickname: name })}
        onModeratorToggleMute={(id, forceMuted) =>
          emitMod('mod:setMediaOverride', { targetPlayerId: id, modForceMuted: forceMuted })
        }
        onModeratorToggleCamHide={(id, forceHidden) =>
          emitMod('mod:setMediaOverride', { targetPlayerId: id, modForceCamHidden: forceHidden })
        }
        onModeratorSetSeat={(id, seatNumber) => emitMod('mod:setSeat', { targetPlayerId: id, seatNumber })}
      />
    );
  };

  let tileActionLabel: string | null = null;
  let selectedTileTargetId: string | null = null;
  let handleTileTargetSelect: ((targetId: string) => void) | undefined;

  if (!room.isMeModerator && me?.isAlive) {
    if (room.phase === 'VOTING') {
      tileActionLabel = t.actionVote;
      selectedTileTargetId =
        typeof room.votes[room.myPlayerId] === 'string' && room.votes[room.myPlayerId] !== 'SKIP'
          ? room.votes[room.myPlayerId]
          : null;
      handleTileTargetSelect = (targetId) => socket?.emit('game:castVote', { targetPlayerId: targetId });
    } else if (room.phase === 'NIGHT' && isPlayerAwakeDuringNight(me, room.nightStep)) {
      const actionMap: Record<string, 'mafia' | 'don' | 'sheriff' | 'doctor'> = {
        MAFIA: 'mafia',
        DON: 'don',
        SHERIFF: 'sheriff',
        DOCTOR: 'doctor',
      };
      const actionType = actionMap[room.nightStep];
      if (actionType) {
        tileActionLabel =
          actionType === 'mafia'
            ? t.actionTarget
            : actionType === 'doctor'
            ? t.actionProtect
            : t.actionInspect;
        selectedTileTargetId = selectedNightTargetId;
        handleTileTargetSelect = (targetId) => {
          socket?.emit(
            'game:nightAction',
            { actionType, targetPlayerId: targetId },
            (res: { ok?: boolean; message?: string; error?: string; messageEntry?: LogEntry; errorEntry?: LogEntry }) => {
              if (res?.ok) {
                setSelectedNightTargetId(targetId);
              }
              if (res?.message) setNightFeedback(res.messageEntry ?? res.message);
              else if (res?.error) setNightFeedback(res.errorEntry ?? res.error);
            }
          );
        };
      }
    }
  }

  const formattedTimer = `${String(Math.floor(room.timerSecondsLeft / 60)).padStart(2, '0')}:${String(
    room.timerSecondsLeft % 60
  ).padStart(2, '0')}`;

  return (
    <div
      data-phase={room.phase}
      className="flex h-screen flex-col overflow-hidden bg-[#0F1115] text-[#F3F4F6]"
    >
      {/* Top Bar */}
      <header className="shrink-0 border-b border-white/10 bg-[#13161C]">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5 sm:gap-8 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="sm" />
            <span className="md:hidden font-mono text-xs font-bold tracking-wider text-[#C7D2FE]">
              {room.code}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-3 text-xs text-[#D1D5DB] whitespace-nowrap">
            <span className="font-semibold text-white">{room.roomName}</span>
            <span aria-hidden="true" className="text-white/25">·</span>
            <span className="font-mono font-bold tracking-wider text-[#C7D2FE]">
              {room.code}
            </span>
            <span aria-hidden="true" className="text-white/25">·</span>
            <span className="font-medium">
              {formatPhaseLabel(t, room.phase, room.nightNumber, room.dayNumber)}
            </span>
            {(room.phase === 'DAY' || room.timerRunning) && (
              <>
                <span aria-hidden="true" className="text-white/25">·</span>
                <span className="font-mono font-semibold text-white">{formattedTimer}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Language switcher"
              className="flex items-center rounded-lg border border-white/15 bg-[#0F1115] p-0.5"
            >
              <button
                type="button"
                onClick={() => handleChangeLang('uk')}
                aria-pressed={lang === 'uk'}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  lang === 'uk' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                UA
              </button>
              <button
                type="button"
                onClick={() => handleChangeLang('en')}
                aria-pressed={lang === 'en'}
                className={`rounded-md px-2 py-1 text-[11px] font-bold transition-colors whitespace-nowrap ${
                  lang === 'en' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                EN
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyInvite}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-[#5865F2] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#4752C4] whitespace-nowrap shrink-0"
            >
              {copiedInvite ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{copiedInvite ? t.linkCopied : t.copyInvite}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Discord-like Workspace */}
      <div className="relative flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Moderator offline: let a player take over */}
          {!room.isMeModerator && moderatorPlayer && !moderatorPlayer.isConnected && (
            <div
              role="status"
              className="shrink-0 border-b border-[#E0A92B]/30 bg-[#E0A92B]/10 px-3 py-2 sm:px-6 sm:py-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-start gap-2">
                  <Crown className="mt-0.5 h-4 w-4 shrink-0 text-[#FFE27A]" />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#FDE9B0]">{t.moderatorOfflineTitle}</p>
                    <p className="text-[#E5D3A0]/80">
                      {takeoverError ?? t.moderatorOfflineHint.replace('{name}', moderatorPlayer.nickname)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClaimModerator}
                  className="h-8 shrink-0 rounded-md bg-[#E0A92B] px-3 text-xs font-bold text-[#1A1206] hover:bg-[#F0BD45]"
                >
                  {t.takeOverModerator}
                </button>
              </div>
            </div>
          )}

          {/* Phase Banner */}
          {(room.phase !== 'LOBBY' || room.lastMorningSummary) && (
            <div className="shrink-0 border-b border-white/10 bg-[#161920] px-3 py-2 sm:px-6 sm:py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-medium text-white">
                  {room.phase === 'NIGHT' && <Moon className="h-4 w-4 text-[#C7D2FE]" />}
                  {room.phase === 'DAY' && <Sun className="h-4 w-4 text-amber-300" />}
                  {room.phase === 'VOTING' && <Vote className="h-4 w-4 text-rose-400" />}
                  {room.phase === 'ENDED' && <Trophy className="h-4 w-4 text-[#10B981]" />}
                  <span>
                    {room.phase === 'NIGHT'
                      ? `${t.phaseNight} ${room.nightNumber} — ${t.nightStepBanner[room.nightStep]}`
                      : room.phase === 'ENDED'
                      ? `${
                          room.winner === 'TOWN'
                            ? t.townVictory
                            : room.winner === 'MAFIA'
                            ? t.mafiaVictory
                            : t.roundVictory
                        } — ${t.allRolesRevealed}`
                      : room.phase === 'VOTING'
                      ? t.votingOpenBanner
                      : room.lastMorningSummary
                      ? formatLog(t, room.lastMorningSummary)
                      : `${t.phaseDay} ${room.dayNumber}`}
                  </span>
                </div>
                <span className="font-mono text-[#9CA3AF]">
                  {t.aliveCounter}: {aliveSeated.length}/{seatedPlayers.length}
                </span>
              </div>
            </div>
          )}

          {/* Webcam Grid Toolbar for larger tables on phones */}
          {seatedPlayers.length >= 4 && (
            <div className="shrink-0 flex items-center justify-between border-b border-white/10 bg-[#0F1115] px-3 py-2 sm:px-6">
              <span className="text-xs text-[#9CA3AF]">
                {aliveSeated.length}/{seatedPlayers.length} {t.seatedSuffix}
              </span>
              <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#13161C] p-0.5">
                <button
                  type="button"
                  onClick={() => setSeatFilter('all')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    seatFilter === 'all' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {t.allSeats} ({seatedPlayers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSeatFilter('alive')}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    seatFilter === 'alive' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {t.aliveOnly} ({aliveSeated.length})
                </button>
              </div>
            </div>
          )}

          {/* Shared audio layer: everyone you're allowed to hear, whatever is on screen */}
          <RemoteAudio streams={remoteStreams} isAudible={isAudible} />

          {/* 2-Column Mobile / 3-4-Column Desktop Grid for up to 16+ players */}
          <div className={`flex-1 p-2.5 sm:p-5 ${focusedId ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-y-auto'}`}>
            {(() => {
              const focusedPlayer = focusedId ? room.players.find((p) => p.id === focusedId) ?? null : null;
              if (!focusedPlayer) return null;
              const others = [
                ...(moderatorPlayer && moderatorPlayer.id !== focusedPlayer.id ? [moderatorPlayer] : []),
                ...seatedPlayers.filter((p) => p.id !== focusedPlayer.id),
              ];
              return (
                <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                  <div
                    ref={focusStageRef}
                    className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-black"
                  >
                    {renderTile(focusedPlayer, 'focus')}
                    <div className="absolute bottom-12 right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen}
                        className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-black/70 px-2.5 text-xs font-semibold text-white hover:bg-[#5865F2]"
                      >
                        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                        <span className="hidden sm:inline">{isFullscreen ? t.exitFullscreen : t.fullscreen}</span>
                      </button>
                      {!isFullscreen && (
                        <button
                          type="button"
                          onClick={() => setFocusedId(null)}
                          aria-label={t.exitFocus}
                          className="flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-black/70 px-2.5 text-xs font-semibold text-white hover:bg-white/20"
                        >
                          <X className="h-4 w-4" />
                          <span className="hidden sm:inline">{t.exitFocus}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 overflow-x-auto pb-1" aria-label={t.exitFocus}>
                    {others.map((p) => renderTile(p, 'strip'))}
                  </div>
                </div>
              );
            })()}

            <div className={`mx-auto max-w-7xl space-y-4 ${focusedId ? 'hidden' : ''}`}>
              {iAmDead && (
                <div
                  role="status"
                  className="rounded-xl border border-violet-500/30 bg-violet-950/30 px-3.5 py-2.5 text-xs"
                >
                  <p className="flex items-center gap-2 font-semibold text-violet-100">
                    <Ghost className="h-4 w-4 text-violet-300" />
                    {t.graveyardBannerTitle}
                  </p>
                  <p className="mt-0.5 text-violet-200/80">{t.graveyardBannerText}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:gap-3.5 md:grid-cols-3 xl:grid-cols-4">
                {moderatorPlayer && renderTile(moderatorPlayer, 'grid')}
                {tablePlayers.map((player) => renderTile(player, 'grid'))}
              </div>

              {seesGraveyardRoom && (
                <section
                  aria-label={t.graveyardTitle}
                  data-testid="graveyard"
                  className="rounded-xl border border-violet-500/25 bg-violet-950/15 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {room.isMeModerator ? (
                      <button
                        type="button"
                        onClick={() => setGraveyardOpen((v) => !v)}
                        aria-expanded={graveyardOpen}
                        aria-label={graveyardOpen ? t.hideGraveyard : t.showGraveyard}
                        title={graveyardOpen ? t.hideGraveyard : t.showGraveyard}
                        className="flex items-center gap-2 rounded-md py-1 pr-2 text-xs font-bold uppercase tracking-wider text-violet-200 hover:text-white"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${graveyardOpen ? 'rotate-90' : ''}`}
                        />
                        <Ghost className="h-4 w-4" />
                        {t.graveyardTitle} ({graveyardPlayers.length})
                      </button>
                    ) : (
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-200">
                        <Ghost className="h-4 w-4" />
                        {t.graveyardTitle} ({graveyardPlayers.length})
                      </h3>
                    )}
                    {room.isMeModerator ? (
                      <button
                        type="button"
                        aria-pressed={moderatorListening}
                        onClick={() => setModeratorListening((v) => !v)}
                        title={t.graveyardListenHint}
                        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
                          moderatorListening
                            ? 'border-violet-400/50 bg-violet-600 text-white hover:bg-violet-500'
                            : 'border-white/15 bg-[#1E222B] text-[#D1D5DB] hover:bg-white/10'
                        }`}
                      >
                        {moderatorListening ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                        {moderatorListening ? t.stopListenGraveyard : t.listenGraveyard}
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-pressed={graveyardMuted}
                        onClick={() => setGraveyardMuted((v) => !v)}
                        title={t.muteGraveyardHint}
                        className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold ${
                          graveyardMuted
                            ? 'border-amber-400/40 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25'
                            : 'border-white/15 bg-[#1E222B] text-[#D1D5DB] hover:bg-white/10'
                        }`}
                      >
                        {graveyardMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                        {graveyardMuted ? t.unmuteGraveyard : t.muteGraveyard}
                      </button>
                    )}
                  </div>
                  {!room.isMeModerator && graveyardMuted && (
                    <p className="mt-1.5 text-[11px] text-amber-100/80">{t.muteGraveyardHint}</p>
                  )}
                  {(!room.isMeModerator || graveyardOpen) &&
                    (graveyardPlayers.length === 0 ? (
                      <p className="py-3 text-center text-xs text-violet-200/60">{t.graveyardEmpty}</p>
                    ) : (
                      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:gap-3.5 md:grid-cols-3 xl:grid-cols-4">
                        {graveyardPlayers.map((player) => renderTile(player, 'grid'))}
                      </div>
                    ))}
                </section>
              )}

              {seatedPlayers.length === 0 && (
                <div className="rounded-xl border border-dashed border-white/15 bg-[#161920]/60 p-6 sm:p-8 text-center">
                  <h2 className="text-base font-bold text-white">{t.waitingTitle}</h2>
                  <p className="mx-auto mt-1.5 max-w-md text-sm text-[#9CA3AF]">
                    {t.waitingDesc.replace('{code}', room.code)}
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-[#5865F2] px-4 text-xs font-semibold text-white hover:bg-[#4752C4]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>{copiedInvite ? t.linkCopied : t.copyInviteLink}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Discord-Style Media & Action Dock */}
          <footer className="shrink-0 border-t border-white/10 bg-[#13161C] px-2.5 py-2 sm:px-6 sm:py-3">
            <div className="flex items-center justify-between gap-1.5 sm:gap-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={handleToggleMic}
                  className={`flex h-10 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    effectiveMicMuted
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                      : 'border-white/10 bg-[#1E222B] text-white hover:bg-white/10'
                  }`}
                >
                  {effectiveMicMuted ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4 text-[#10B981]" />
                  )}
                  <span className="hidden sm:inline">{effectiveMicMuted ? t.muted : t.micOn}</span>
                  <span className="sm:hidden">{effectiveMicMuted ? t.muted : t.micShort}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleCam}
                  className={`flex h-10 items-center gap-1.5 rounded-lg border px-2.5 sm:px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                    effectiveCamOff
                      ? 'border-rose-500/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
                      : 'border-white/10 bg-[#1E222B] text-white hover:bg-white/10'
                  }`}
                >
                  {effectiveCamOff ? (
                    <CameraOff className="h-4 w-4" />
                  ) : (
                    <Camera className="h-4 w-4 text-[#10B981]" />
                  )}
                  <span className="hidden sm:inline">{effectiveCamOff ? t.camOff : t.camOn}</span>
                  <span className="sm:hidden">{effectiveCamOff ? t.camOff : t.camShort}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNoiseFilterEnabled((v) => !v)}
                  aria-pressed={noiseFilterEnabled}
                  aria-label={noiseFilterEnabled ? t.noiseFilterOn : t.noiseFilterOff}
                  className={`flex h-10 items-center gap-1.5 rounded-lg border px-2 sm:px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                    noiseFilterEnabled
                      ? 'border-[#10B981]/40 bg-[#10B981]/15 text-emerald-200 hover:bg-[#10B981]/25'
                      : 'border-white/10 bg-[#1E222B] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  <AudioLines className="h-4 w-4" />
                  <span className="hidden md:inline">
                    {noiseFilterEnabled ? t.noiseFilterOn : t.noiseFilterOff}
                  </span>
                  <span className="md:hidden">
                    {noiseFilterEnabled ? t.noiseFilterShortOn : t.noiseFilterShortOff}
                  </span>
                </button>

                {!localStream && (
                  <button
                    type="button"
                    onClick={() => void initLocalMedia(true, true)}
                    className="hidden md:flex h-10 items-center rounded-lg border border-[#5865F2]/40 bg-[#5865F2]/15 px-3 text-xs font-semibold text-[#C7D2FE] hover:bg-[#5865F2]/25 whitespace-nowrap"
                  >
                    {t.connectCamera}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setMobilePanelOpen((v) => !v)}
                  className="flex lg:hidden h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1E222B] px-2.5 text-xs font-semibold text-white whitespace-nowrap"
                >
                  <PanelRight className="h-4 w-4" />
                  <span>{room.isMeModerator ? t.controlsShort : t.roleShort}</span>
                </button>

                <button
                  type="button"
                  onClick={handleLeaveRoom}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/15 px-2.5 sm:px-3.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden xs:inline sm:inline">{t.leave}</span>
                </button>
              </div>
            </div>
          </footer>
        </main>

        {mobilePanelOpen && (
          <button
            type="button"
            aria-label="Close side panel"
            onClick={() => setMobilePanelOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          />
        )}

        <div
          className={`${
            mobilePanelOpen ? 'fixed inset-y-0 right-0 z-40 flex w-80 max-w-full flex-col shadow-2xl' : 'hidden'
          } lg:static lg:flex lg:w-96 lg:shrink-0`}
        >
          {mobilePanelOpen && (
            <div className="flex items-center justify-between border-b border-white/10 bg-[#13161C] px-4 py-2.5 lg:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                {room.isMeModerator ? t.modStudioTitle : t.roleChatTitle}
              </span>
              <button
                type="button"
                onClick={() => setMobilePanelOpen(false)}
                aria-label="Close drawer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-[#D1D5DB] hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {room.isMeModerator ? (
            <ModeratorPanel
              t={t}
              room={room}
              onRenamePlayer={(id, nickname) =>
                emitMod('mod:renamePlayer', { targetPlayerId: id, nickname })
              }
              onMoveSeat={(id, direction) =>
                emitMod('mod:moveSeat', { targetPlayerId: id, direction })
              }
              onKickPlayer={(id) => emitMod('mod:kickPlayer', { targetPlayerId: id })}
              onShuffleSeats={() => emitMod('mod:shuffleSeats')}
              onTransferModerator={(id) => emitMod('mod:transferModerator', { targetPlayerId: id })}
              onUpdateRoleConfig={(roleConfig: RoleConfig) =>
                emitMod('mod:updateRoleConfig', { roleConfig })
              }
              onDealRoles={(mode) => emitMod('mod:dealRoles', { mode })}
              onSetPlayerRole={(id, role: MafiaRole | null) =>
                emitMod('mod:setPlayerRole', { targetPlayerId: id, role })
              }
              onToggleAlive={(id) => emitMod('mod:toggleAlive', { targetPlayerId: id })}
              onToggleMute={(id, forceMuted) =>
                emitMod('mod:setMediaOverride', {
                  targetPlayerId: id,
                  modForceMuted: forceMuted,
                })
              }
              onToggleCamHide={(id, forceHidden) =>
                emitMod('mod:setMediaOverride', {
                  targetPlayerId: id,
                  modForceCamHidden: forceHidden,
                })
              }
              onStartNight={() => emitMod('mod:startNight')}
              onSetNightStep={(step: NightStep) => emitMod('mod:setNightStep', { step })}
              onNextNightStep={() => emitMod('mod:nextNightStep')}
              onSetNightAction={(actionType, targetPlayerId) =>
                emitMod('mod:setNightAction', { actionType, targetPlayerId })
              }
              onResolveNight={() => emitMod('mod:resolveNight')}
              onStartDay={() => emitMod('mod:startDay')}
              onStartVoting={() => emitMod('mod:startVoting')}
              onResolveVoting={(opts) => emitMod('mod:resolveVoting', opts ?? {})}
              onEndGame={() => emitMod('mod:endGame')}
              onResetLobby={() => emitMod('mod:resetLobby')}
              onTimerControl={(action, seconds) =>
                emitMod('mod:timerControl', { action, seconds })
              }
              onSendChat={(text, channel) => socket?.emit('chat:send', { text, channel })}
            />
          ) : (
            <PlayerSidePanel
              t={t}
              room={room}
              nightFeedback={
                nightFeedback && typeof nightFeedback !== 'string' ? formatLog(t, nightFeedback) : nightFeedback
              }
              onCastVote={(targetId) => socket?.emit('game:castVote', { targetPlayerId: targetId })}
              onSubmitNightAction={(actionType, targetId) => {
                socket?.emit(
                  'game:nightAction',
                  { actionType, targetPlayerId: targetId },
                  (res: { ok?: boolean; message?: string; error?: string; messageEntry?: LogEntry; errorEntry?: LogEntry }) => {
                    if (res?.ok) setSelectedNightTargetId(targetId);
                    if (res?.message) setNightFeedback(res.messageEntry ?? res.message);
                    else if (res?.error) setNightFeedback(res.errorEntry ?? res.error);
                  }
                );
              }}
              onSendChat={(text, channel) => socket?.emit('chat:send', { text, channel })}
            />
          )}
        </div>
      </div>

    </div>
  );
}
