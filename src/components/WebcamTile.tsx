import {
  CameraOff,
  Check,
  EyeOff,
  MicOff,
  Pencil,
  Shield,
  Skull,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Translations } from '../shared/i18n';
import {
  ROLE_META,
  formatSeatNumber,
  isPlayerAwakeDuringNight,
  type GamePhase,
  type NightStep,
  type PlayerRecord,
} from '../shared/mafiaEngine';

interface WebcamTileProps {
  t: Translations;
  player: PlayerRecord;
  stream: MediaStream | null;
  isMe: boolean;
  isSpeaking: boolean;
  phase: GamePhase;
  nightStep: NightStep;
  viewerIsModerator: boolean;
  voteCount: number;
  isSelectedTarget: boolean;
  actionButtonLabel: string | null;
  onSelectTarget?: (playerId: string) => void;
  onModeratorRename?: (playerId: string, nickname: string) => void;
  onModeratorToggleMute?: (playerId: string, forceMuted: boolean) => void;
  onModeratorToggleCamHide?: (playerId: string, forceHidden: boolean) => void;
}

export function WebcamTile({
  t,
  player,
  stream,
  isMe,
  isSpeaking,
  phase,
  nightStep,
  viewerIsModerator,
  voteCount,
  isSelectedTarget,
  actionButtonLabel,
  onSelectTarget,
  onModeratorRename,
  onModeratorToggleMute,
  onModeratorToggleCamHide,
}: WebcamTileProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(player.nickname);

  useEffect(() => {
    setDraftName(player.nickname);
  }, [player.nickname]);

  const isAwakeAtNight = phase !== 'NIGHT' || isPlayerAwakeDuringNight(player, nightStep);
  const isSleepMasked = !viewerIsModerator && phase === 'NIGHT' && !isAwakeAtNight && !player.isModerator;
  const isCamSuppressed =
    player.camOff || player.modForceCamHidden || isSleepMasked || !stream || stream.getVideoTracks().length === 0;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream && !isCamSuppressed) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
  }, [stream, isCamSuppressed]);

  const effectiveMuted = player.micMuted || player.modForceMuted || (phase === 'NIGHT' && !isAwakeAtNight);
  const seatLabel = formatSeatNumber(player.seatNumber);
  const initial = (player.nickname[0] || '?').toUpperCase();

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draftName.trim();
    if (cleaned && onModeratorRename) {
      onModeratorRename(player.id, cleaned);
    }
    setEditingName(false);
  };

  const borderClass = isSelectedTarget
    ? 'border-[#5865F2] ring-2 ring-[#5865F2]/50'
    : isSpeaking && !effectiveMuted
    ? 'border-[#10B981] ring-2 ring-[#10B981]/50'
    : !player.isAlive
    ? 'border-white/5 opacity-60'
    : 'border-white/10';

  return (
    <article
      data-testid={`seat-tile-${player.seatNumber}`}
      className={`group relative flex aspect-[4/3] sm:aspect-video flex-col overflow-hidden rounded-xl border bg-[#161920] transition-colors ${borderClass}`}
    >
      <div className="relative h-full w-full bg-[#0E1015]">
        {!isCamSuppressed ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMe || effectiveMuted}
            className={`h-full w-full object-cover ${isMe ? '-scale-x-100' : ''} ${
              !player.isAlive ? 'grayscale brightness-75' : ''
            }`}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2">
            <div
              className={`flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full border text-lg sm:text-xl font-bold ${
                player.isModerator
                  ? 'border-[#5865F2]/40 bg-[#5865F2]/15 text-[#C7D2FE]'
                  : !player.isAlive
                  ? 'border-white/10 bg-white/5 text-[#6B7280]'
                  : 'border-white/15 bg-[#1E222B] text-white'
              }`}
            >
              {!player.isAlive ? <Skull className="h-5 w-5 sm:h-6 sm:w-6 text-rose-400" /> : initial}
            </div>
            {isSleepMasked && (
              <span className="text-[11px] font-medium text-[#9CA3AF]">{t.eyesClosed}</span>
            )}
            {player.modForceCamHidden && !isSleepMasked && (
              <span className="text-[11px] font-medium text-amber-300">{t.camHiddenByMod}</span>
            )}
          </div>
        )}

        {/* Top-left seat & status readout */}
        <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap items-center gap-1 text-[11px] font-semibold drop-shadow">
          <span className="rounded bg-black/75 px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] text-[#E5E7EB]">
            {seatLabel}
          </span>
          {player.isModerator && (
            <span className="flex items-center gap-1 rounded bg-[#5865F2]/90 px-1.5 py-0.5 text-[10px] sm:text-[11px] text-white">
              <Shield className="h-3 w-3" />
              <span>{t.moderatorBadge}</span>
            </span>
          )}
          {!player.isAlive && (
            <span className="rounded bg-rose-950/90 px-1.5 py-0.5 text-[10px] sm:text-[11px] text-rose-200">
              {t.eliminatedBadge}
            </span>
          )}
          {!player.isConnected && (
            <span className="rounded bg-amber-950/90 px-1.5 py-0.5 text-[10px] text-amber-200">
              {t.reconnectingBadge}
            </span>
          )}
        </div>

        {/* Top-right role indicator & vote count */}
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1">
          {voteCount > 0 && (
            <span className="rounded bg-rose-600/90 px-1.5 py-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-white">
              {voteCount} {voteCount === 1 ? t.voteSingle : t.votePlural}
            </span>
          )}
          {player.role && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold ${
                ROLE_META[player.role].team === 'MAFIA'
                  ? 'bg-rose-950/90 text-rose-200 border border-rose-500/30'
                  : 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/30'
              }`}
            >
              {t.roles[player.role].label}
            </span>
          )}
        </div>

        {/* Moderator hover controls */}
        {viewerIsModerator && !player.isModerator && !editingName && (
          <div className="absolute right-2 bottom-10 hidden sm:flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
                player.modForceCamHidden
                  ? `Show camera for ${player.nickname}`
                  : `Hide camera for ${player.nickname}`
              }
              className={`flex h-8 w-8 items-center justify-center rounded-md border border-white/15 ${
                player.modForceCamHidden ? 'bg-amber-600 text-white' : 'bg-black/75 text-white hover:bg-white/20'
              }`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Bottom scrim: Nickname + Media Icons + Interactive Target CTA */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 py-2">
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
              <div className="flex min-w-0 items-center gap-1">
                <span className="truncate text-xs font-semibold text-white">
                  {player.nickname}
                  {isMe ? ` (${t.youSuffix})` : ''}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {actionButtonLabel && onSelectTarget && (
                  <button
                    type="button"
                    onClick={() => onSelectTarget(player.id)}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                      isSelectedTarget
                        ? 'bg-[#5865F2] text-white'
                        : 'bg-white/20 text-white hover:bg-[#5865F2]'
                    }`}
                  >
                    {actionButtonLabel}
                  </button>
                )}
                {effectiveMuted && (
                  <MicOff className="h-3.5 w-3.5 text-rose-400" aria-label={t.muted} />
                )}
                {isCamSuppressed && !isSleepMasked && (
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
