import {
  CameraOff,
  Check,
  EyeOff,
  Ghost,
  Maximize2,
  MicOff,
  Minimize2,
  Pencil,
  Shield,
  Skull,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
  /** Eliminated player shown to the Graveyard or the Moderator. */
  ghost?: boolean;
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
}

export function WebcamTile({
  t,
  player,
  stream,
  isMe,
  isSpeaking,
  display,
  ghost = false,
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
}: WebcamTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingSeat, setEditingSeat] = useState(false);
  const [draftName, setDraftName] = useState(player.nickname);

  useEffect(() => {
    setDraftName(player.nickname);
  }, [player.nickname]);

  const hasVideoTrack = Boolean(stream && stream.getVideoTracks().length > 0);
  const showVideo =
    display === 'video' && !player.camOff && !player.modForceCamHidden && hasVideoTrack;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = showVideo ? stream : null;
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
    ? ghost
      ? 'border-violet-400 ring-2 ring-violet-400/50'
      : 'border-[#10B981] ring-2 ring-[#10B981]/50'
    : ghost
    ? 'border-violet-500/30'
    : !player.isAlive
    ? 'border-white/5 opacity-60'
    : 'border-white/10';

  const sizeClass =
    size === 'focus'
      ? 'h-full w-full'
      : size === 'strip'
      ? 'aspect-video w-36 shrink-0 sm:w-44'
      : 'aspect-[4/3] sm:aspect-video';

  return (
    <article
      data-testid={`seat-tile-${player.seatNumber}`}
      data-player-id={player.id}
      data-display={display}
      onDoubleClick={() => onToggleFocus?.(player.id)}
      className={`group relative flex flex-col overflow-hidden rounded-xl border transition-colors ${
        ghost ? 'bg-[#1A1626]' : 'bg-[#161920]'
      } ${sizeClass} ${borderClass}`}
    >
      <div className={`relative h-full w-full ${ghost ? 'bg-[#120F1C]' : 'bg-[#0E1015]'}`}>
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted // sound is played by the shared audio layer, never by tiles
            className={`h-full w-full ${size === 'focus' ? 'object-contain' : 'object-cover'} ${
              isMe ? '-scale-x-100' : ''
            } ${ghost ? 'grayscale-[60%] saturate-50' : !player.isAlive ? 'grayscale brightness-75' : ''}`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2">
            <div
              className={`flex ${
                isSmall ? 'h-9 w-9 text-base' : 'h-11 w-11 text-lg sm:h-14 sm:w-14 sm:text-xl'
              } items-center justify-center rounded-full border font-bold ${
                player.isModerator
                  ? 'border-[#5865F2]/40 bg-[#5865F2]/15 text-[#C7D2FE]'
                  : ghost
                  ? 'border-violet-400/30 bg-violet-500/10 text-violet-200'
                  : !player.isAlive
                  ? 'border-white/10 bg-white/5 text-[#6B7280]'
                  : 'border-white/15 bg-[#1E222B] text-white'
              }`}
            >
              {ghost ? (
                <Ghost className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : !player.isAlive ? (
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
          {!player.isAlive && !isSmall && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] ${
                ghost ? 'bg-violet-950/90 text-violet-200' : 'bg-rose-950/90 text-rose-200'
              }`}
            >
              {ghost ? t.graveyardTitle : t.eliminatedBadge}
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
                className={`min-w-0 truncate font-semibold text-white ${
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
