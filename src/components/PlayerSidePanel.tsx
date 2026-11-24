import { Eye, EyeOff, Moon, ShieldAlert, Vote } from 'lucide-react';
import { useState } from 'react';
import type { Translations } from '../shared/i18n';
import {
  ROLE_META,
  formatSeatNumber,
  isPlayerAwakeDuringNight,
  tallyVotes,
  type RoomPublicState,
} from '../shared/mafiaEngine';

interface PlayerSidePanelProps {
  t: Translations;
  room: RoomPublicState;
  nightFeedback: string | null;
  onCastVote: (targetId: string | 'SKIP') => void;
  onSubmitNightAction: (
    actionType: 'mafia' | 'don' | 'sheriff' | 'doctor',
    targetId: string
  ) => void;
  onSendChat: (text: string, channel: 'public' | 'mafia') => void;
}

export function PlayerSidePanel({
  t,
  room,
  nightFeedback,
  onCastVote,
  onSubmitNightAction,
  onSendChat,
}: PlayerSidePanelProps) {
  const [roleVisible, setRoleVisible] = useState(true);
  const [chatText, setChatText] = useState('');
  const [chatChannel, setChatChannel] = useState<'public' | 'mafia'>('public');

  const me = room.players.find((p) => p.id === room.myPlayerId);
  const seatedPlayers = room.players.filter((p) => !p.isModerator);
  const aliveSeated = seatedPlayers.filter((p) => p.isAlive);
  const aliveIds = new Set(aliveSeated.map((p) => p.id));
  const voteTally = tallyVotes(room.votes, aliveIds);

  const isMafiaTeam = room.myRole === 'mafia' || room.myRole === 'don';
  const mafiaAllies = isMafiaTeam
    ? seatedPlayers.filter((p) => p.id !== room.myPlayerId && (p.role === 'mafia' || p.role === 'don'))
    : [];

  const isAwakeNow =
    room.phase === 'NIGHT' && me ? isPlayerAwakeDuringNight(me, room.nightStep) : false;

  const activeNightActionType: 'mafia' | 'don' | 'sheriff' | 'doctor' | null =
    !isAwakeNow || !me?.isAlive
      ? null
      : room.nightStep === 'MAFIA' && (me.role === 'mafia' || me.role === 'don')
      ? 'mafia'
      : room.nightStep === 'DON' && me.role === 'don'
      ? 'don'
      : room.nightStep === 'SHERIFF' && me.role === 'sheriff'
      ? 'sheriff'
      : room.nightStep === 'DOCTOR' && me.role === 'doctor'
      ? 'doctor'
      : null;

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChat(chatText.trim(), chatChannel);
    setChatText('');
  };

  return (
    <aside
      aria-label={t.roleChatTitle}
      className="flex h-full w-full flex-col border-l border-white/10 bg-[#13161C]"
    >
      {/* Secret Role Card */}
      <section aria-label={t.yourSecretRole} className="border-b border-white/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
            {t.yourSecretRole}
          </h3>
          <button
            type="button"
            onClick={() => setRoleVisible((v) => !v)}
            aria-pressed={roleVisible}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-[#0F1115] px-2.5 py-1 text-xs font-medium text-[#D1D5DB] hover:text-white"
          >
            {roleVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>{roleVisible ? t.hide : t.peek}</span>
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-white/10 bg-[#0F1115] p-3.5">
          {!room.myRole ? (
            <p className="text-xs text-[#9CA3AF]">{t.waitingForRoles}</p>
          ) : !roleVisible ? (
            <p className="text-xs text-[#9CA3AF]">{t.roleHiddenMsg}</p>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={`text-base font-bold ${
                    ROLE_META[room.myRole].team === 'MAFIA' ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {t.roles[room.myRole].label}
                </span>
                <span className="text-xs text-[#9CA3AF]">
                  {ROLE_META[room.myRole].team === 'MAFIA' ? t.mafiaTeamLabel : t.townTeamLabel}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#D1D5DB]">
                {t.roles[room.myRole].shortDesc}
              </p>
              {mafiaAllies.length > 0 && (
                <p className="mt-2 border-t border-white/10 pt-2 text-xs text-rose-300">
                  {t.mafiaPartners}:{' '}
                  {mafiaAllies
                    .map((a) => `${formatSeatNumber(a.seatNumber)} ${a.nickname}`)
                    .join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Active Night Action */}
      {room.phase === 'NIGHT' && (
        <section aria-label={t.yourNightTurn} className="border-b border-white/10 p-4">
          {activeNightActionType ? (
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C7D2FE]">
                <Moon className="h-3.5 w-3.5" />
                <span>{t.yourNightTurn}</span>
              </div>
              <p className="mt-1 text-xs text-[#D1D5DB]">
                {room.myRole ? t.roles[room.myRole].nightPrompt : ''}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {aliveSeated.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSubmitNightAction(activeNightActionType, p.id)}
                    className="flex h-9 items-center gap-1.5 rounded-md border border-white/15 bg-[#1E222B] px-2.5 text-xs font-medium text-white hover:border-[#5865F2] hover:bg-[#5865F2]/25"
                  >
                    <span className="font-mono text-[11px] text-[#9CA3AF]">
                      {formatSeatNumber(p.seatNumber)}
                    </span>
                    <span className="truncate">{p.nickname}</span>
                  </button>
                ))}
              </div>

              {nightFeedback && (
                <p className="mt-2.5 rounded-md border border-[#5865F2]/40 bg-[#5865F2]/15 px-3 py-2 text-xs font-semibold text-white">
                  {nightFeedback}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2.5 text-xs text-[#9CA3AF]">
              <ShieldAlert className="h-4 w-4 shrink-0 text-[#5865F2]" />
              <span>{t.nightInProgressSleep.replace('{n}', String(room.nightNumber))}</span>
            </div>
          )}
        </section>
      )}

      {/* Voting Panel */}
      {room.phase === 'VOTING' && me?.isAlive && (
        <section aria-label={t.castVoteTitle} className="border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-300">
              <Vote className="h-3.5 w-3.5" />
              <span>{t.castVoteTitle}</span>
            </div>
            <button
              type="button"
              onClick={() => onCastVote('SKIP')}
              className={`rounded px-2.5 py-1 text-xs font-semibold ${
                room.votes[room.myPlayerId] === 'SKIP'
                  ? 'bg-[#5865F2] text-white'
                  : 'border border-white/15 bg-[#0F1115] text-[#D1D5DB]'
              }`}
            >
              {t.skipLabel} ({voteTally.skipCount})
            </button>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-1.5">
            {aliveSeated.map((p) => {
              const selected = room.votes[room.myPlayerId] === p.id;
              const count = voteTally.counts[p.id] || 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onCastVote(p.id)}
                  className={`flex h-9 items-center justify-between gap-1.5 rounded-md border px-2.5 text-xs font-medium ${
                    selected
                      ? 'border-rose-500 bg-rose-500/20 text-white'
                      : 'border-white/15 bg-[#1E222B] text-[#E5E7EB] hover:bg-white/10'
                  }`}
                >
                  <span className="truncate">
                    {formatSeatNumber(p.seatNumber)} {p.nickname}
                  </span>
                  {count > 0 && <span className="font-mono text-[11px] text-rose-300">{count}</span>}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Chat & Table Log */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-white/10 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
            {t.tableChatLog}
          </h3>
        </div>
        <div className="flex-1 space-y-2.5 overflow-y-auto p-3.5">
          {room.messages.map((msg) => (
            <div key={msg.id} className="text-xs leading-relaxed">
              {msg.channel === 'system' ? (
                <p className="text-[#9CA3AF]">{msg.text}</p>
              ) : (
                <p>
                  <span
                    className={`font-semibold ${
                      msg.channel === 'mafia' ? 'text-rose-400' : 'text-[#C7D2FE]'
                    }`}
                  >
                    {msg.channel === 'mafia' ? `[${t.roles.mafia.label}] ` : ''}
                    {msg.senderName}:
                  </span>{' '}
                  <span className="text-[#E5E7EB]">{msg.text}</span>
                </p>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSendChat} className="border-t border-white/10 p-3 space-y-2">
          {isMafiaTeam && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setChatChannel('public')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  chatChannel === 'public'
                    ? 'bg-[#5865F2] text-white'
                    : 'bg-[#0F1115] text-[#9CA3AF]'
                }`}
              >
                {t.tableChat}
              </button>
              <button
                type="button"
                onClick={() => setChatChannel('mafia')}
                className={`rounded px-2.5 py-1 text-xs font-medium ${
                  chatChannel === 'mafia'
                    ? 'bg-rose-600 text-white'
                    : 'bg-[#0F1115] text-[#9CA3AF]'
                }`}
              >
                {t.mafiaWhisper}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatText}
              maxLength={300}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={t.messagePlaceholder}
              aria-label={t.send}
              className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0F1115] px-3 text-xs text-white placeholder-[#6B7280] focus:border-[#5865F2] focus:outline-none"
            />
            <button
              type="submit"
              className="h-9 rounded-lg bg-[#5865F2] px-3 text-xs font-semibold text-white hover:bg-[#4752C4]"
            >
              {t.send}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
