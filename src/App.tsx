import {
  AudioLines,
  Camera,
  CameraOff,
  Check,
  Copy,
  Crown,
  LogOut,
  Mic,
  MicOff,
  Moon,
  PanelRight,
  Server,
  Sun,
  Trophy,
  Vote,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { HostGuideModal } from './components/HostGuideModal';
import { JoinScreen } from './components/JoinScreen';
import { ModeratorPanel } from './components/ModeratorPanel';
import { PlayerSidePanel } from './components/PlayerSidePanel';
import { WebcamTile } from './components/WebcamTile';
import { useMediaRoom, type LiveKitCredentials } from './hooks/useMediaRoom';
import { TRANSLATIONS, formatPhaseLabel, type Language } from './shared/i18n';
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
  const [hostGuideOpen, setHostGuideOpen] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [nightFeedback, setNightFeedback] = useState<string | null>(null);
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
  const isAwakeAtNight =
    !room || room.phase !== 'NIGHT' || !me ? true : isPlayerAwakeDuringNight(me, room.nightStep);

  const effectiveMicMuted = Boolean(micMuted || me?.modForceMuted || !isAwakeAtNight);
  const effectiveCamOff = Boolean(camOff || me?.modForceCamHidden || !isAwakeAtNight);

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
  });

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
              if (res.peerIds?.length) connectToPeers(res.peerIds);
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
      socket.emit(
        'room:join',
        { code, nickname, micMuted, camOff },
        (res: {
          ok?: boolean;
          error?: string;
          code?: string;
          playerId?: string;
          playerToken?: string;
          state?: RoomPublicState;
          peerIds?: string[];
          livekit?: LiveKitCredentials | null;
        }) => {
          setConnecting(false);
          if (!res?.ok || !res.state) {
            setErrorMessage(res?.error || 'Could not join room.');
            return;
          }
          playerIdRef.current = res.playerId ?? null;
          playerTokenRef.current = res.playerToken ?? null;
          moderatorTokenRef.current = null;
          roomCodeRef.current = res.code ?? null;
          setLivekit(res.livekit ?? null);
          setRoom(res.state);
          if (res.peerIds?.length) {
            connectToPeers(res.peerIds);
          }
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
      (res: { ok?: boolean; error?: string; moderatorToken?: string; retryInSeconds?: number }) => {
        if (res?.ok && res.moderatorToken) {
          moderatorTokenRef.current = res.moderatorToken;
        } else if (res?.retryInSeconds) {
          setTakeoverError(t.takeoverWait.replace('{s}', String(res.retryInSeconds)));
          window.setTimeout(() => setTakeoverError(null), 4000);
        } else if (res?.error) {
          setTakeoverError(res.error);
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
          errorMessage={errorMessage}
          onToggleMic={handleToggleMic}
          onToggleCam={handleToggleCam}
          onToggleNoiseFilter={() => setNoiseFilterEnabled((v) => !v)}
          onRequestMedia={() => {
            void initLocalMedia(true, true);
          }}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenHostGuide={() => setHostGuideOpen(true)}
        />
        <HostGuideModal open={hostGuideOpen} t={t} onClose={() => setHostGuideOpen(false)} />
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
            (res: { ok?: boolean; message?: string; error?: string }) => {
              if (res?.ok) {
                setSelectedNightTargetId(targetId);
              }
              if (res?.message) setNightFeedback(res.message);
              else if (res?.error) setNightFeedback(res.error);
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
                      : room.lastMorningSummary || `${t.phaseDay} ${room.dayNumber}`}
                  </span>
                </div>
                <span className="font-mono text-[#9CA3AF]">
                  {t.aliveCounter}: {aliveSeated.length}/{seatedPlayers.length}
                </span>
              </div>
            </div>
          )}

          {/* Webcam Grid Toolbar for 7-16 players on phones */}
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

          {/* 2-Column Mobile / 3-4-Column Desktop Grid for up to 16+ players */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-5">
            <div className="mx-auto max-w-7xl space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3.5 md:grid-cols-3 xl:grid-cols-4">
                {moderatorPlayer && (
                  <WebcamTile
                    t={t}
                    player={moderatorPlayer}
                    stream={
                      moderatorPlayer.id === room.myPlayerId
                        ? localStream
                        : remoteStreams[moderatorPlayer.id] ?? null
                    }
                    isMe={moderatorPlayer.id === room.myPlayerId}
                    isSpeaking={Boolean(speakingMap[moderatorPlayer.id])}
                    phase={room.phase}
                    nightStep={room.nightStep}
                    viewerIsModerator={room.isMeModerator}
                    voteCount={0}
                    isSelectedTarget={false}
                    actionButtonLabel={null}
                  />
                )}

                {visibleSeatedPlayers.map((player) => (
                  <WebcamTile
                    key={player.id}
                    t={t}
                    player={player}
                    stream={
                      player.id === room.myPlayerId
                        ? localStream
                        : remoteStreams[player.id] ?? null
                    }
                    isMe={player.id === room.myPlayerId}
                    isSpeaking={Boolean(speakingMap[player.id])}
                    phase={room.phase}
                    nightStep={room.nightStep}
                    viewerIsModerator={room.isMeModerator}
                    voteCount={voteTally.counts[player.id] || 0}
                    isSelectedTarget={selectedTileTargetId === player.id}
                    actionButtonLabel={player.isAlive ? tileActionLabel : null}
                    onSelectTarget={handleTileTargetSelect}
                    onModeratorRename={(id, name) =>
                      emitMod('mod:renamePlayer', { targetPlayerId: id, nickname: name })
                    }
                    onModeratorToggleMute={(id, forceMuted) =>
                      emitMod('mod:setMediaOverride', {
                        targetPlayerId: id,
                        modForceMuted: forceMuted,
                      })
                    }
                    onModeratorToggleCamHide={(id, forceHidden) =>
                      emitMod('mod:setMediaOverride', {
                        targetPlayerId: id,
                        modForceCamHidden: forceHidden,
                      })
                    }
                  />
                ))}
              </div>

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
                  onClick={() => setHostGuideOpen(true)}
                  className="hidden sm:flex h-10 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1E222B] px-3 text-xs font-semibold text-[#D1D5DB] hover:bg-white/10 whitespace-nowrap"
                >
                  <Server className="h-3.5 w-3.5 text-[#5865F2]" />
                  <span>{t.selfHostShort}</span>
                </button>

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
              nightFeedback={nightFeedback}
              onCastVote={(targetId) => socket?.emit('game:castVote', { targetPlayerId: targetId })}
              onSubmitNightAction={(actionType, targetId) => {
                socket?.emit(
                  'game:nightAction',
                  { actionType, targetPlayerId: targetId },
                  (res: { ok?: boolean; message?: string; error?: string }) => {
                    if (res?.ok) setSelectedNightTargetId(targetId);
                    if (res?.message) setNightFeedback(res.message);
                    else if (res?.error) setNightFeedback(res.error);
                  }
                );
              }}
              onSendChat={(text, channel) => socket?.emit('chat:send', { text, channel })}
            />
          )}
        </div>
      </div>

      <HostGuideModal open={hostGuideOpen} t={t} onClose={() => setHostGuideOpen(false)} />
    </div>
  );
}
