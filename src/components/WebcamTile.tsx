import {
  CameraOff,
  Check,
  EyeOff,
  Maximize2,
  MessageCircle,
  MicOff,
  Minimize2,
  Pencil,
  Shield,
  Skull,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Translations } from '../shared/i18n';
import { ROLE_META, formatSeatNumber, type PlayerRecord } from '../shared/mafiaEngine';

/**
 * How this viewer may show the tile (decided by the shared media policy in App):
 *  - 'video'     show the camera if the player has it on
 *  - 'sleeping'  night: this viewer can't see them (eyes closed)
 *  - 'graveyard' a living viewer looking at an eliminated player: skull only
 */
export type TileDisplay = 'video' | 'sleeping' | 'graveyard';

export type TileSize = 'grid' | 'focus' | 'strip';

interface WebcamTileProps {
  t: Translations;
  player: PlayerRecord;
  stream: MediaStream | null;
  isMe: boolean;
  isSpeaking: boolean;
  display: TileDisplay;
  /** "На розмову": called to speak this round, or already spoke. */
  talkState?: 'called' | 'done' | null;
  viewerIsModerator: boolean;
  voteCount: number;
  isSelectedTarget: boolean;
  actionButtonLabel: string | null;
  size?: TileSize;
  isFocused?: boolean;
  seatCount?: number;
  onToggleFocus?: (playerId: string) => void;
  onSelectTarget?: (playerId: string) => void;
  onModeratorRename?: (playerId: string, nickname: string) => void;
  onModeratorToggleMute?: (playerId: string, forceMuted: boolean) => void;
  onModeratorToggleCamHide?: (playerId: string, forceHidden: boolean) => void;
  onModeratorSetSeat?: (playerId: string, seatNumber: number) => void;
  onModeratorToggleTalk?: (playerId: string, on: boolean) => void;
  /** This viewer's personal volume for the player (0–2); undefined for yourself. */
  volume?: number;
  onVolumeChange?: (playerId: string, volume: number) => void;
}

export function WebcamTile({
  t,
  player,
  stream,
  isMe,
  isSpeaking,
  display,
  talkState = null,
  viewerIsModerator,
  voteCount,
  isSelectedTarget,
  actionButtonLabel,
  size = 'grid',
  isFocused = false,
  seatCount = 0,
  onToggleFocus,
  onSelectTarget,
  onModeratorRename,
  onModeratorToggleMute,
  onModeratorToggleCamHide,
  onModeratorSetSeat,
  onModeratorToggleTalk,
  volume,
  onVolumeChange,
}: WebcamTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Upright phone video is shown whole (dark bars at the sides, like Discord)
  // instead of being cropped and zoomed to fill a landscape tile.
  const [isPortrait, setIsPortrait] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingSeat, setEditingSeat] = useState(false);
  // Volume pop-up: floats above the tile (tiles are too short to hold it).
  const [volumeAnchor, setVolumeAnchor] = useState<DOMRect | null>(null);
  const volumeOpen = volumeAnchor !== null;
  const setVolumeOpen = (open: boolean | ((v: boolean) => boolean)) => {
    const next = typeof open === 'function' ? open(volumeOpen) : open;
    setVolumeAnchor(next ? volumeButtonRef.current?.getBoundingClientRect() ?? null : null);
  };
  const volumeButtonRef = useRef<HTMLButtonElement | null>(null);
  const volumePanelRef = useRef<HTMLDivElement | null>(null);
  const [draftName, setDraftName] = useState(player.nickname);

  useEffect(() => {
    setDraftName(player.nickname);
  }, [player.nickname]);

  const articleRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!volumeOpen) return;
    const close = () => setVolumeAnchor(null);
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (volumePanelRef.current?.contains(target) || volumeButtonRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [volumeOpen]);

  const hasVideoTrack = Boolean(stream && stream.getVideoTracks().length > 0);
  const showVideo =
    display === 'video' && !player.camOff && !player.modForceCamHidden && hasVideoTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = showVideo ? stream : null;
    const measure = () => {
      if (el.videoWidth && el.videoHeight) setIsPortrait(el.videoHeight > el.videoWidth);
    };
    measure();
    // 'resize' fires when the sender rotates their phone mid-call.
    el.addEventListener('loadedmetadata', measure);
    el.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('loadedmetadata', measure);
      el.removeEventListener('resize', measure);
    };
  }, [stream, showVideo]);

  const isSmall = size === 'strip';
  const hiddenFromViewer = display !== 'video';
  const effectiveMuted = player.micMuted || player.modForceMuted || display === 'sleeping';
  const seatLabel = formatSeatNumber(player.seatNumber);
  const initial = (player.nickname[0] || '?').toUpperCase();
  const canEditSeat = viewerIsModerator && !player.isModerator && Boolean(onModeratorSetSeat) && seatCount > 1;

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim();
    if (cleaned && onModeratorRename) onModeratorRename(player.id, cleaned);
    setEditingName(false);
  };

  const borderClass = isSelectedTarget
    ? 'border-[#5865F2] ring-2 ring-[#5865F2]/50'
    : isSpeaking && !effectiveMuted && !hiddenFromViewer
    ? 'border-[#10B981] ring-2 ring-[#10B981]/50'
    : talkState === 'called'
    ? 'border-sky-400/60'
    : 'border-white/10';

  const sizeClass =
    size === 'focus'
      ? 'h-full w-full'
      : size === 'strip'
      ? 'aspect-video w-36 shrink-0 sm:w-44'
      : 'aspect-[4/3] sm:aspect-video';

  return (
    <article
      ref={articleRef}
      data-testid={`seat-tile-${player.seatNumber}`}
      data-player-id={player.id}
      data-display={display}
      onDoubleClick={() => onToggleFocus?.(player.id)}
      className={`group relative flex flex-col overflow-hidden rounded-xl border bg-[#161920] transition-colors ${sizeClass} ${borderClass}`}
    >
      <div className="relative h-full w-full bg-[#0E1015]">
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted // sound is played by the shared audio layer, never by tiles
            data-fit={size === 'focus' || isPortrait ? 'contain' : 'cover'}
            className={`h-full w-full ${size === 'focus' || isPortrait ? 'object-contain' : 'object-cover'} ${
              isMe ? '-scale-x-100' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2">
            <div
              className={`flex ${
                isSmall ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg sm:h-14 sm:w-14 sm:text-xl'
              } items-center justify-center rounded-full border font-bold ${
                player.isModerator
                  ? 'border-[#5865F2]/40 bg-[#5865F2]/15 text-[#C7D2FE]'
                  : !player.isAlive
                  ? 'border-white/10 bg-white/5 text-[#6B7280]'
                  : 'border-white/15 bg-[#1E222B] text-white'
              }`}
            >
              {!player.isAlive ? (
                <Skull className="h-5 w-5 text-rose-400 sm:h-6 sm:w-6" />
              ) : (
                initial
              )}
            </div>
            {display === 'sleeping' && !isSmall && (
              <span className="text-[11px] font-medium text-[#9CA3AF]">{t.eyesClosed}</span>
            )}
            {display === 'video' && player.modForceCamHidden && !isSmall && (
              <span className="text-[11px] font-medium text-amber-300">{t.camHiddenByMod}</span>
            )}
          </div>
        )}

        {/* Top row: seat & status on the left, votes/role/focus on the right.
            One flex row so the two sides wrap instead of overlapping on narrow tiles. */}
        <div className="pointer-events-none absolute inset-x-2 top-2 flex items-start justify-between gap-1">
        <div className="flex shrink-0 flex-col items-start gap-1 text-[11px] font-semibold drop-shadow">
          {editingSeat && canEditSeat ? (
            <select
              autoFocus
              aria-label={`${t.changeSeat}: ${player.nickname}`}
              defaultValue={player.seatNumber}
              onChange={(e) => {
                onModeratorSetSeat?.(player.id, Number(e.target.value));
                setEditingSeat(false);
              }}
              onBlur={() => setEditingSeat(false)}
              className="pointer-events-auto h-7 rounded border border-[#5865F2] bg-[#0F1115] px-1 font-mono text-xs text-white"
            >
              {Array.from({ length: seatCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {t.seatWord} {formatSeatNumber(n)}
                </option>
              ))}
            </select>
          ) : canEditSeat ? (
            <button
              type="button"
              onClick={() => setEditingSeat(true)}
              aria-label={`${t.changeSeat}: ${player.nickname}`}
              title={t.changeSeat}
              className="pointer-events-auto rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-[#E5E7EB] ring-1 ring-[#5865F2]/60 hover:bg-[#5865F2] sm:text-[11px]"
            >
              {seatLabel}
            </button>
          ) : (
            <span className="rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] text-[#E5E7EB] sm:text-[11px]">
              {seatLabel}
            </span>
          )}
          {player.isModerator && (
            <span className="flex items-center gap-1 rounded bg-[#5865F2]/90 px-1.5 py-0.5 text-[10px] text-white sm:text-[11px]">
              <Shield className="h-3 w-3" />
              {!isSmall && <span>{t.moderatorBadge}</span>}
            </span>
          )}
          {talkState && (
            <span
              title={talkState === 'called' ? t.talkTitle : t.talkDone}
              className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] ${
                talkState === 'called' ? 'bg-sky-600/90 text-white' : 'bg-black/70 text-sky-200'
              }`}
            >
              {talkState === 'called' ? <MessageCircle className="h-3 w-3" /> : <Check className="h-3 w-3" />}
              {!isSmall && <span>{talkState === 'called' ? t.talkTitle : t.talkDone}</span>}
            </span>
          )}
          {!player.isConnected && !isSmall && (
            <span className="rounded bg-amber-950/90 px-1.5 py-0.5 text-[10px] text-amber-200">
              {t.reconnectingBadge}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap-reverse items-center justify-end gap-1">
          {voteCount > 0 && (
            <span className="pointer-events-none rounded bg-rose-600/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white sm:text-[11px]">
              {voteCount} {!isSmall && (voteCount === 1 ? t.voteSingle : t.votePlural)}
            </span>
          )}
          {player.role && !isSmall && (
            <span
              className={`pointer-events-none rounded px-1.5 py-0.5 text-[10px] font-semibold sm:text-[11px] ${
                ROLE_META[player.role].team === 'MAFIA'
                  ? 'border border-rose-500/30 bg-rose-950/90 text-rose-200'
                  : 'border border-emerald-500/30 bg-emerald-950/90 text-emerald-200'
              }`}
            >
              {t.roles[player.role].label}
            </span>
          )}
          {onModeratorToggleTalk && viewerIsModerator && !player.isModerator && player.isAlive && (
            <button
              type="button"
              onClick={() => onModeratorToggleTalk(player.id, !talkState)}
              aria-pressed={Boolean(talkState)}
              aria-label={`${t.talkButton}: ${player.nickname}`}
              title={talkState ? t.talkRemove : t.talkButton}
              className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md border ${
                talkState
                  ? 'border-sky-400/60 bg-sky-600 text-white hover:bg-sky-500'
                  : 'border-white/15 bg-black/70 text-white hover:bg-sky-600 sm:opacity-60 sm:group-hover:opacity-100'
              }`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleFocus && (
            <button
              type="button"
              onClick={() => onToggleFocus(player.id)}
              aria-label={`${isFocused ? t.exitFocus : t.focusCamera}: ${player.nickname}`}
              title={isFocused ? t.exitFocus : t.focusCamera}
              className={`pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-black/70 text-white transition-opacity hover:bg-[#5865F2] ${
                isFocused ? 'opacity-100' : 'opacity-80 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100'
              }`}
            >
              {isFocused ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        </div>

        {/* Moderator hover controls */}
        {viewerIsModerator && !player.isModerator && !editingName && !isSmall && (
          <div className="absolute bottom-10 right-2 hidden items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 sm:flex">
            <button
              type="button"
              onClick={() => setEditingName(true)}
              aria-label={`Rename ${player.nickname}`}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-black/75 text-white hover:bg-[#5865F2]"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onModeratorToggleMute?.(player.id, !player.modForceMuted)}
              aria-label={player.modForceMuted ? `Unmute ${player.nickname}` : `Force mute ${player.nickname}`}
              className={`flex h-8 w-8 items-center justify-center rounded-md border border-white/15 ${
                player.modForceMuted ? 'bg-amber-600 text-white' : 'bg-black/75 text-white hover:bg-white/20'
              }`}
            >
              <VolumeX className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onModeratorToggleCamHide?.(player.id, !player.modForceCamHidden)}
              aria-label={
                player.modForceCamHidden ? `Show camera for ${player.nickname}` : `Hide camera for ${player.nickname}`
              }
              className={`flex h-8 w-8 items-center justify-center rounded-md border border-white/15 ${
                player.modForceCamHidden ? 'bg-amber-600 text-white' : 'bg-black/75 text-white hover:bg-white/20'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Personal volume (Discord-style), only for other people */}
        {volumeAnchor && onVolumeChange && volume !== undefined && createPortal(
          <div
            ref={volumePanelRef}
            role="dialog"
            aria-label={`${t.volumeTitle}: ${player.nickname}`}
            onDoubleClick={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              width: 232,
              left: Math.max(8, Math.min(window.innerWidth - 240, volumeAnchor.right - 232)),
              ...(volumeAnchor.top > 170
                ? { bottom: window.innerHeight - volumeAnchor.top + 8 }
                : { top: volumeAnchor.bottom + 8 }),
            }}
            className="z-50 rounded-lg border border-white/15 bg-[#0F1115] p-2.5 shadow-2xl"
          >
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-semibold text-white">{t.volumeTitle}</span>
              <span className="font-mono font-bold text-white">{Math.round(volume * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              step={5}
              value={Math.round(volume * 100)}
              onChange={(e) => onVolumeChange(player.id, Number(e.target.value) / 100)}
              aria-label={`${t.volumeTitle}: ${player.nickname}`}
              className="h-6 w-full cursor-pointer accent-[#5865F2]"
            />
            <div className="mt-1.5 flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={() => onVolumeChange(player.id, volume === 0 ? 1 : 0)}
                className={`h-7 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold ${
                  volume === 0 ? 'bg-rose-600 text-white' : 'border border-white/15 text-[#D1D5DB] hover:bg-white/10'
                }`}
              >
                {volume === 0 ? t.unmuteForMe : t.muteForMe}
              </button>
              <button
                type="button"
                onClick={() => onVolumeChange(player.id, 1)}
                disabled={volume === 1}
                className="h-7 whitespace-nowrap rounded-md border border-white/15 px-2 text-[11px] font-semibold text-[#D1D5DB] hover:bg-white/10 disabled:opacity-40"
              >
                {t.volumeReset}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[#9CA3AF]">{t.volumeHint}</p>
          </div>,
          document.body
        )}

        {/* Bottom scrim: nickname + media icons + target button */}
        <div
          className={`absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent ${
            isSmall ? 'px-2 py-1.5' : 'px-2.5 py-2'
          }`}
        >
          {editingName ? (
            <form onSubmit={submitRename} className="flex w-full items-center gap-1.5">
              <input
                type="text"
                value={draftName}
                maxLength={24}
                autoFocus
                onChange={(e) => setDraftName(e.target.value)}
                aria-label={`Edit nickname for ${player.nickname}`}
                className="h-8 min-w-0 flex-1 rounded border border-white/25 bg-[#0F1115] px-2 text-xs text-white focus:border-[#5865F2] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Save nickname"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#10B981] text-white"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftName(player.nickname);
                  setEditingName(false);
                }}
                aria-label="Cancel rename"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-white/15 text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </form>
          ) : (
            <>
              <span
                aria-label={!player.isAlive ? `${player.nickname} (${t.eliminatedBadge})` : undefined}
                className={`min-w-0 truncate font-semibold ${player.isAlive ? 'text-white' : 'text-rose-400'} ${
                  size === 'focus' ? 'text-sm' : isSmall ? 'text-[11px]' : 'text-xs'
                }`}
              >
                {player.nickname}
                {isMe ? ` (${t.youSuffix})` : ''}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                {actionButtonLabel && onSelectTarget && !isSmall && (
                  <button
                    type="button"
                    onClick={() => onSelectTarget(player.id)}
                    className={`whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      isSelectedTarget ? 'bg-[#5865F2] text-white' : 'bg-white/20 text-white hover:bg-[#5865F2]'
                    }`}
                  >
                    {actionButtonLabel}
                  </button>
                )}
                {onVolumeChange && volume !== undefined && !isSmall && display !== 'graveyard' && (
                  <button
                    ref={volumeButtonRef}
                    type="button"
                    onClick={() => setVolumeOpen((v) => !v)}
                    aria-expanded={volumeOpen}
                    aria-label={`${t.volumeTitle}: ${player.nickname} (${Math.round(volume * 100)}%)`}
                    title={`${t.volumeTitle}: ${Math.round(volume * 100)}%`}
                    className={`flex h-6 items-center gap-0.5 rounded px-1 text-[10px] font-semibold ${
                      volume === 0
                        ? 'bg-rose-600/90 text-white'
                        : volume !== 1
                        ? 'bg-[#5865F2]/90 text-white'
                        : 'text-[#D1D5DB] hover:bg-white/15'
                    }`}
                  >
                    {volume === 0 ? (
                      <VolumeX className="h-3.5 w-3.5" />
                    ) : volume < 1 ? (
                      <Volume1 className="h-3.5 w-3.5" />
                    ) : (
                      <Volume2 className="h-3.5 w-3.5" />
                    )}
                    {volume !== 1 && <span>{Math.round(volume * 100)}%</span>}
                  </button>
                )}
                {effectiveMuted && display !== 'graveyard' && (
                  <MicOff className="h-3.5 w-3.5 text-rose-400" aria-label={t.muted} />
                )}
                {display === 'video' && !showVideo && (
                  <CameraOff className="h-3.5 w-3.5 text-[#9CA3AF]" aria-label={t.camOff} />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
