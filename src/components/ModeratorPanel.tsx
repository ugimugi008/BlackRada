import {
  ArrowDown,
  ArrowUp,
  Check,
  Crown,
  Flame,
  EyeOff,
  Gavel,
  MessageSquare,
  Moon,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Shuffle,
  Skull,
  Sun,
  Trash2,
  UserCheck,
  Users,
  VolumeX,
  Vote,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { Translations } from '../shared/i18n';
import { ChatBox, type ChatChannel } from './ChatBox';
import {
  formatSeatNumber,
  getActiveNightSteps,
  tallyVotes,
  type MafiaRole,
  type NightStep,
  type RoleConfig,
  type RoomPublicState,
} from '../shared/mafiaEngine';

interface ModeratorPanelProps {
  t: Translations;
  room: RoomPublicState;
  onRenamePlayer: (playerId: string, nickname: string) => void;
  onMoveSeat: (playerId: string, direction: 'up' | 'down') => void;
  onShuffleSeats: () => void;
  onSetLastWordsSeconds: (seconds: number) => void;
  onGiveLastWords: (playerId: string) => void;
  onKickPlayer: (playerId: string) => void;
  onTransferModerator: (playerId: string) => void;
  onUpdateRoleConfig: (config: RoleConfig) => void;
  onDealRoles: (mode: 'random' | 'clear') => void;
  onSetPlayerRole: (playerId: string, role: MafiaRole | null) => void;
  onToggleAlive: (playerId: string) => void;
  onToggleMute: (playerId: string, forceMuted: boolean) => void;
  onToggleCamHide: (playerId: string, forceHidden: boolean) => void;
  onStartNight: () => void;
  onSetNightStep: (step: NightStep) => void;
  onNextNightStep: () => void;
  onSetNightAction: (actionType: 'mafia' | 'don' | 'sheriff' | 'doctor', targetPlayerId: string | null) => void;
  onResolveNight: () => void;
  onStartDay: () => void;
  onStartVoting: () => void;
  onResolveVoting: (opts?: { forceEliminateId?: string; skip?: boolean }) => void;
  onEndGame: () => void;
  onResetLobby: () => void;
  onTimerControl: (action: 'start' | 'pause' | 'set', seconds?: number) => void;
  onSendChat: (text: string, channel: ChatChannel) => void;
}

export function ModeratorPanel({
  t,
  room,
  onRenamePlayer,
  onMoveSeat,
  onShuffleSeats,
  onSetLastWordsSeconds,
  onGiveLastWords,
  onKickPlayer,
  onTransferModerator,
  onUpdateRoleConfig,
  onDealRoles,
  onSetPlayerRole,
  onToggleAlive,
  onToggleMute,
  onToggleCamHide,
  onStartNight,
  onSetNightStep,
  onNextNightStep,
  onSetNightAction,
  onResolveNight,
  onStartDay,
  onStartVoting,
  onResolveVoting,
  onEndGame,
  onResetLobby,
  onTimerControl,
  onSendChat,
}: ModeratorPanelProps) {
  const [tab, setTab] = useState<'director' | 'roster' | 'chat'>('director');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [handoverId, setHandoverId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  const seatedPlayers = room.players.filter((p) => !p.isModerator);
  const aliveSeated = seatedPlayers.filter((p) => p.isAlive);
  const aliveIds = new Set(aliveSeated.map((p) => p.id));
  const voteTally = tallyVotes(room.votes, aliveIds);
  const activeNightSteps = getActiveNightSteps(room.players);

  const startEditing = (playerId: string, currentName: string) => {
    setEditingId(playerId);
    setDraftName(currentName);
  };

  const commitEdit = (e: React.FormEvent, playerId: string) => {
    e.preventDefault();
    if (draftName.trim()) {
      onRenamePlayer(playerId, draftName.trim());
    }
    setEditingId(null);
  };


  return (
    <aside
      aria-label={t.modStudioTitle}
      className="flex h-full w-full flex-col border-l border-white/10 bg-[#13161C]"
    >
      {/* Tab Switcher */}
      <div className="border-b border-white/10 p-3">
        <div
          role="tablist"
          aria-label={t.modStudioTitle}
          className="grid grid-cols-3 gap-1 rounded-lg border border-white/10 bg-[#0F1115] p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'director'}
            onClick={() => setTab('director')}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'director' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Gavel className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t.tabDirector}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'roster'}
            onClick={() => setTab('roster')}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'roster' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {t.tabRoster} ({seatedPlayers.length})
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chat'}
            onClick={() => setTab('chat')}
            className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-1 text-xs font-semibold transition-colors whitespace-nowrap ${
              tab === 'chat' ? 'bg-[#5865F2] text-white' : 'text-[#9CA3AF] hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t.tabLog}</span>
          </button>
        </div>
      </div>

      {/* DIRECTOR TAB */}
      {tab === 'director' && (
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <section aria-label={t.phaseDirector}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                {t.phaseDirector}
              </h3>
              <span className="font-mono text-xs text-[#D1D5DB]">
                {room.phase}
                {room.nightNumber > 0 ? ` · N${room.nightNumber}` : ''}
                {room.dayNumber > 0 ? ` / D${room.dayNumber}` : ''}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onStartNight}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#5865F2] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#4752C4] whitespace-nowrap"
              >
                <Moon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.startNight}</span>
              </button>

              <button
                type="button"
                onClick={onStartDay}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1E222B] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap"
              >
                <Sun className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                <span className="truncate">{t.startDay}</span>
              </button>

              <button
                type="button"
                onClick={onStartVoting}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1E222B] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10 whitespace-nowrap"
              >
                <Vote className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <span className="truncate">{t.openVoting}</span>
              </button>

              <button
                type="button"
                onClick={onResetLobby}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#1E222B] px-2.5 text-xs font-semibold text-[#D1D5DB] transition-colors hover:bg-white/10 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.resetLobby}</span>
              </button>
            </div>
          </section>

          {/* Active Night Stepper */}
          {room.phase === 'NIGHT' && (
            <section aria-label="Night sequence" className="border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D2FE]">
                  {t.nightSequence.replace('{n}', String(room.nightNumber))}
                </h3>
                <button
                  type="button"
                  onClick={onNextNightStep}
                  className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
                >
                  {t.nextStep}
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                {activeNightSteps.map((step) => {
                  const active = room.nightStep === step;
                  return (
                    <button
                      key={step}
                      type="button"
                      onClick={() => onSetNightStep(step)}
                      className={`flex h-9 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'border-[#5865F2] bg-[#5865F2]/25 text-white'
                          : 'border-white/10 bg-[#0F1115] text-[#9CA3AF] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{t.nightStepBanner[step]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                <p className="text-xs text-[#9CA3AF]">{t.nightPicksHint}</p>

                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-rose-300 font-medium">{t.mafiaKillLabel}</span>
                    <select
                      aria-label={t.mafiaKillLabel}
                      value={room.nightActions?.mafiaTargetId || ''}
                      onChange={(e) => onSetNightAction('mafia', e.target.value || null)}
                      className="h-8 w-40 rounded border border-white/15 bg-[#0F1115] px-2 text-xs text-white"
                    >
                      <option value="">{t.noneOption}</option>
                      {aliveSeated.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatSeatNumber(p.seatNumber)} · {p.nickname}
                        </option>
                      ))}
                    </select>
                  </label>

                  {aliveSeated.some((p) => p.role === 'don') && (
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-rose-200 font-medium">{t.donCheckLabel}</span>
                      <select
                        aria-label={t.donCheckLabel}
                        value={room.nightActions?.donCheckId || ''}
                        onChange={(e) => onSetNightAction('don', e.target.value || null)}
                        className="h-8 w-40 rounded border border-white/15 bg-[#0F1115] px-2 text-xs text-white"
                      >
                        <option value="">{t.noneOption}</option>
                        {aliveSeated.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatSeatNumber(p.seatNumber)} · {p.nickname}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {aliveSeated.some((p) => p.role === 'sheriff') && (
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-sky-300 font-medium">{t.sheriffCheckLabel}</span>
                      <select
                        aria-label={t.sheriffCheckLabel}
                        value={room.nightActions?.sheriffCheckId || ''}
                        onChange={(e) => onSetNightAction('sheriff', e.target.value || null)}
                        className="h-8 w-40 rounded border border-white/15 bg-[#0F1115] px-2 text-xs text-white"
                      >
                        <option value="">{t.noneOption}</option>
                        {aliveSeated.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatSeatNumber(p.seatNumber)} · {p.nickname}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {aliveSeated.some((p) => p.role === 'doctor') && (
                    <label className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-emerald-300 font-medium">{t.doctorSaveLabel}</span>
                      <select
                        aria-label={t.doctorSaveLabel}
                        value={room.nightActions?.doctorSaveId || ''}
                        onChange={(e) => onSetNightAction('doctor', e.target.value || null)}
                        className="h-8 w-40 rounded border border-white/15 bg-[#0F1115] px-2 text-xs text-white"
                      >
                        <option value="">{t.noneOption}</option>
                        {aliveSeated.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatSeatNumber(p.seatNumber)} · {p.nickname}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onResolveNight}
                  className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#10B981] px-4 text-xs font-bold text-[#052E16] transition-colors hover:bg-[#34D399]"
                >
                  <Sun className="h-4 w-4" />
                  <span>{t.wakeTownResolve}</span>
                </button>
              </div>
            </section>
          )}

          {/* Voting Resolution */}
          {room.phase === 'VOTING' && (
            <section aria-label={t.activeVoteTally} className="border-t border-white/10 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                {t.activeVoteTally}
              </h3>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t.votesCastOf
                  .replace('{cast}', String(Object.keys(room.votes).length))
                  .replace('{total}', String(aliveSeated.length))}{' '}
                · {t.skipLabel}: <span className="font-mono text-white">{voteTally.skipCount}</span>
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => onResolveVoting()}
                  className="flex h-10 flex-1 items-center justify-center rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  {voteTally.leaderId ? t.eliminateLeader : t.resolveVote}
                </button>
                <button
                  type="button"
                  onClick={() => onResolveVoting({ skip: true })}
                  className="flex h-10 items-center justify-center rounded-lg border border-white/15 bg-[#1E222B] px-3 text-xs font-semibold text-[#D1D5DB] hover:bg-white/10"
                >
                  {t.skipVote}
                </button>
              </div>
            </section>
          )}

          {/* Discussion Timer */}
          <section aria-label={t.discussionTimer} className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                {t.discussionTimer}
              </h3>
              <span className="font-mono text-sm font-bold text-white">
                {String(Math.floor(room.timerSecondsLeft / 60)).padStart(2, '0')}:
                {String(room.timerSecondsLeft % 60).padStart(2, '0')}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onTimerControl(room.timerRunning ? 'pause' : 'start')}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/15 bg-[#1E222B] text-xs font-semibold text-white hover:bg-white/10"
              >
                {room.timerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{room.timerRunning ? t.pauseTimer : t.startTimer}</span>
              </button>
              {[60, 90, 120].map((secs) => (
                <button
                  key={secs}
                  type="button"
                  onClick={() => onTimerControl('set', secs)}
                  className="h-9 rounded-md border border-white/10 bg-[#0F1115] px-2.5 font-mono text-xs text-[#D1D5DB] hover:bg-white/10"
                >
                  {secs}s
                </button>
              ))}
            </div>
          </section>

          {/* Last words length */}
          <section aria-label={t.lastWordsSetting} className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                <Flame className="h-3.5 w-3.5 text-amber-300" />
                {t.lastWordsSetting}
              </h3>
              <div className="flex items-center gap-1" role="radiogroup" aria-label={t.lastWordsSetting}>
                {[0, 30, 60, 90].map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    role="radio"
                    aria-checked={room.lastWordsSeconds === secs}
                    onClick={() => onSetLastWordsSeconds(secs)}
                    className={`h-8 rounded-md border px-2.5 font-mono text-xs ${
                      room.lastWordsSeconds === secs
                        ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
                        : 'border-white/10 bg-[#0F1115] text-[#D1D5DB] hover:bg-white/10'
                    }`}
                  >
                    {secs === 0 ? t.lastWordsOff : `${secs}s`}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Role Deck Setup */}
          <section aria-label="Role deck setup" className="border-t border-white/10 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
              {t.roleDeck.replace('{n}', String(seatedPlayers.length))}
            </h3>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#E5E7EB]">{t.mafiaRegular}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease Mafia count"
                    onClick={() =>
                      onUpdateRoleConfig({
                        ...room.roleConfig,
                        mafiaCount: Math.max(0, room.roleConfig.mafiaCount - 1),
                      })
                    }
                    className="h-7 w-7 rounded border border-white/15 bg-[#0F1115] text-white hover:bg-white/10"
                  >
                    -
                  </button>
                  <span className="w-5 text-center font-mono font-bold text-white">
                    {room.roleConfig.mafiaCount}
                  </span>
                  <button
                    type="button"
                    aria-label="Increase Mafia count"
                    onClick={() =>
                      onUpdateRoleConfig({
                        ...room.roleConfig,
                        mafiaCount: Math.min(6, room.roleConfig.mafiaCount + 1),
                      })
                    }
                    className="h-7 w-7 rounded border border-white/15 bg-[#0F1115] text-white hover:bg-white/10"
                  >
                    +
                  </button>
                </div>
              </div>

              {(
                [
                  ['hasDon', t.roles.don.label],
                  ['hasSheriff', t.roles.sheriff.label],
                  ['hasDoctor', t.roles.doctor.label],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between py-0.5">
                  <span className="text-[#E5E7EB]">{label}</span>
                  <input
                    type="checkbox"
                    checked={room.roleConfig[key]}
                    onChange={(e) =>
                      onUpdateRoleConfig({
                        ...room.roleConfig,
                        [key]: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#5865F2]"
                  />
                </label>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={seatedPlayers.length === 0}
                onClick={() => onDealRoles('random')}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#5865F2] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#4752C4] disabled:opacity-40 whitespace-nowrap"
              >
                <Shuffle className="h-3.5 w-3.5 shrink-0" />
                <span>{t.dealSecretRoles}</span>
              </button>
              <button
                type="button"
                onClick={onEndGame}
                className="flex h-10 items-center justify-center rounded-lg border border-white/15 bg-[#1E222B] px-3 text-xs font-semibold text-[#D1D5DB] hover:bg-white/10 whitespace-nowrap"
              >
                {t.revealAll}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ROSTER & NICKNAMES TAB */}
      {tab === 'roster' && (
        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-xs font-semibold text-[#9CA3AF]">{t.rosterHint}</span>
            <button
              type="button"
              onClick={() => onDealRoles('clear')}
              className="shrink-0 text-xs font-medium text-[#9CA3AF] hover:text-white"
            >
              {t.clearRoles}
            </button>
          </div>
          {seatedPlayers.length > 1 && (
            <button
              type="button"
              onClick={onShuffleSeats}
              className="mb-2.5 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/15 bg-[#1E222B] text-xs font-semibold text-white hover:bg-white/10"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {t.shuffleSeats}
            </button>
          )}

          {seatedPlayers.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-white/15 p-5 text-center">
              <p className="text-sm font-medium text-white">{t.noSeatedYet}</p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                {t.shareCodeHint.replace('{code}', room.code)}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-white/10">
              {seatedPlayers.map((player, idx) => (
                <li key={player.id} className="py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    {editingId === player.id ? (
                      <form
                        onSubmit={(e) => commitEdit(e, player.id)}
                        className="flex flex-1 items-center gap-1.5"
                      >
                        <input
                          type="text"
                          value={draftName}
                          maxLength={24}
                          autoFocus
                          onChange={(e) => setDraftName(e.target.value)}
                          aria-label={`Nickname for seat ${player.seatNumber}`}
                          className="h-8 min-w-0 flex-1 rounded border border-[#5865F2] bg-[#0F1115] px-2 text-xs text-white focus:outline-none"
                        />
                        <button
                          type="submit"
                          aria-label="Save nickname"
                          className="flex h-8 w-8 items-center justify-center rounded bg-[#10B981] text-white"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel rename"
                          className="flex h-8 w-8 items-center justify-center rounded bg-white/10 text-white"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#9CA3AF]">
                          {formatSeatNumber(player.seatNumber)}
                        </span>
                        <span
                          className={`truncate text-sm font-medium ${
                            player.isAlive ? 'text-white' : 'text-[#6B7280] line-through'
                          }`}
                        >
                          {player.nickname}
                        </span>
                      </div>
                    )}

                    {editingId !== player.id && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => startEditing(player.id, player.nickname)}
                          aria-label={`Edit nickname for ${player.nickname}`}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-[#9CA3AF] hover:bg-white/10 hover:text-white"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleMute(player.id, !player.modForceMuted)}
                          aria-label={`Toggle mute for ${player.nickname}`}
                          className={`flex h-8 w-8 items-center justify-center rounded border border-white/10 ${
                            player.modForceMuted
                              ? 'bg-amber-600/80 text-white'
                              : 'text-[#9CA3AF] hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <VolumeX className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleCamHide(player.id, !player.modForceCamHidden)}
                          aria-label={`Toggle camera hide for ${player.nickname}`}
                          className={`flex h-8 w-8 items-center justify-center rounded border border-white/10 ${
                            player.modForceCamHidden
                              ? 'bg-amber-600/80 text-white'
                              : 'text-[#9CA3AF] hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => onMoveSeat(player.id, 'up')}
                          aria-label={`Move ${player.nickname} up`}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-[#9CA3AF] hover:bg-white/10 hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === seatedPlayers.length - 1}
                          onClick={() => onMoveSeat(player.id, 'down')}
                          aria-label={`Move ${player.nickname} down`}
                          className="flex h-8 w-8 items-center justify-center rounded border border-white/10 text-[#9CA3AF] hover:bg-white/10 hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Role select + Alive toggle + Kick */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <select
                      aria-label={`Assign role for ${player.nickname}`}
                      value={player.role || ''}
                      onChange={(e) =>
                        onSetPlayerRole(
                          player.id,
                          (e.target.value || null) as MafiaRole | null
                        )
                      }
                      className="h-8 flex-1 rounded border border-white/10 bg-[#0F1115] px-2 text-xs text-white focus:border-[#5865F2] focus:outline-none"
                    >
                      <option value="">{t.unassigned}</option>
                      {(['mafia', 'don', 'sheriff', 'doctor', 'villager'] as MafiaRole[]).map(
                        (roleKey) => (
                          <option key={roleKey} value={roleKey}>
                            {t.roles[roleKey].label}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => onToggleAlive(player.id)}
                      aria-label={
                        player.isAlive
                          ? `Eliminate ${player.nickname}`
                          : `Revive ${player.nickname}`
                      }
                      className={`flex h-8 items-center gap-1 rounded border px-2 text-xs font-medium whitespace-nowrap ${
                        player.isAlive
                          ? 'border-white/10 bg-[#1E222B] text-[#D1D5DB] hover:bg-white/10'
                          : 'border-rose-500/30 bg-rose-500/15 text-rose-200'
                      }`}
                    >
                      {player.isAlive ? (
                        <>
                          <UserCheck className="h-3 w-3 text-[#10B981]" />
                          <span>{t.aliveBtn}</span>
                        </>
                      ) : (
                        <>
                          <Skull className="h-3 w-3 text-rose-400" />
                          <span>{t.deadBtn}</span>
                        </>
                      )}
                    </button>

                    {!player.isAlive &&
                      (room.phase === 'DAY' || room.phase === 'NIGHT' || room.phase === 'VOTING') && (
                        <button
                          type="button"
                          onClick={() => onGiveLastWords(player.id)}
                          aria-label={`${t.lastWordsTitle}: ${player.nickname}`}
                          title={t.lastWordsTitle}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-amber-400/30 text-amber-300 hover:bg-amber-500/15"
                        >
                          <Flame className="h-3.5 w-3.5" />
                        </button>
                      )}

                    <button
                      type="button"
                      onClick={() => setHandoverId(handoverId === player.id ? null : player.id)}
                      aria-label={`${t.makeModerator}: ${player.nickname}`}
                      aria-expanded={handoverId === player.id}
                      title={t.makeModerator}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border ${
                        handoverId === player.id
                          ? 'border-[#E0A92B]/60 bg-[#E0A92B]/20 text-[#FFE27A]'
                          : 'border-white/10 text-[#9CA3AF] hover:border-[#E0A92B]/40 hover:bg-[#E0A92B]/15 hover:text-[#FFE27A]'
                      }`}
                    >
                      <Crown className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => onKickPlayer(player.id)}
                      aria-label={`Kick ${player.nickname}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 text-[#9CA3AF] hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {handoverId === player.id && (
                    <div
                      role="alertdialog"
                      aria-label={t.makeModerator}
                      className="mt-2 rounded-lg border border-[#E0A92B]/40 bg-[#E0A92B]/10 p-2.5"
                    >
                      <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#FDE9B0]">
                        <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FFE27A]" />
                        <span>
                          {t.makeModeratorConfirm.replace('{name}', player.nickname)}
                          {room.phase !== 'LOBBY' && room.phase !== 'ENDED' && (
                            <strong className="mt-1 block font-semibold text-amber-200">
                              {t.makeModeratorMidGame}
                            </strong>
                          )}
                        </span>
                      </p>
                      <div className="mt-2 flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHandoverId(null)}
                          className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-[#D1D5DB] hover:bg-white/10"
                        >
                          {t.cancelBtn}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHandoverId(null);
                            onTransferModerator(player.id);
                          }}
                          className="h-8 rounded bg-[#E0A92B] px-3 text-xs font-bold text-[#1A1206] hover:bg-[#F0BD45]"
                        >
                          {t.confirmBtn}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* CHAT & LOG TAB */}
      {tab === 'chat' && <ChatBox t={t} room={room} onSendChat={onSendChat} />}
    </aside>
  );
}
