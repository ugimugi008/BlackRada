import { Ghost } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatLog } from '../shared/gameLog';
import type { Translations } from '../shared/i18n';
import type { ChatMessage, RoomPublicState } from '../shared/mafiaEngine';
import { isInGraveyard } from '../shared/mediaPolicy';

export type ChatChannel = 'public' | 'mafia' | 'dead';

interface ChatBoxProps {
  t: Translations;
  room: RoomPublicState;
  onSendChat: (text: string, channel: ChatChannel) => void;
  /** Show a heading row above the log (player panel); the Moderator panel has its own tabs. */
  title?: string;
}

/** Table chat + game log, shared by the player and Moderator panels. */
export function ChatBox({ t, room, onSendChat, title }: ChatBoxProps) {
  const me = room.players.find((p) => p.id === room.myPlayerId) ?? null;
  const iAmDead = Boolean(me && isInGraveyard(me, room.phase) && room.lastWords?.playerId !== me.id);
  const isMafiaTeam = room.myRole === 'mafia' || room.myRole === 'don';
  const graveyardActive = room.phase === 'NIGHT' || room.phase === 'DAY' || room.phase === 'VOTING';

  const channels: ChatChannel[] = iAmDead
    ? ['dead']
    : room.isMeModerator
    ? graveyardActive
      ? ['public', 'mafia', 'dead']
      : ['public', 'mafia']
    : isMafiaTeam
    ? ['public', 'mafia']
    : ['public'];

  const [channel, setChannel] = useState<ChatChannel>(channels[0]);
  const [text, setText] = useState('');
  const activeChannel = channels.includes(channel) ? channel : channels[0];

  // The Moderator only sees Graveyard chatter while the Graveyard tab is open,
  // so it can't distract them mid-game.
  const visible = room.messages.filter((msg) => {
    if (msg.channel !== 'dead') return true;
    if (!room.isMeModerator) return true;
    return activeChannel === 'dead';
  });

  const listRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = text.trim();
    if (!clean) return;
    onSendChat(clean, activeChannel);
    setText('');
  };

  const placeholder = activeChannel === 'dead' ? t.graveyardPlaceholder : t.messagePlaceholder;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {title && (
        <div className="border-b border-white/10 px-4 py-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">{title}</h3>
        </div>
      )}

      <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto p-3.5" aria-live="polite">
        {visible.map((msg) => (
          <ChatLine key={msg.id} t={t} msg={msg} />
        ))}
      </div>

      <form onSubmit={submit} className="space-y-2 border-t border-white/10 p-3">
        {channels.length > 1 && (
          <div className="flex gap-1.5" role="tablist">
            {channels.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={activeChannel === c}
                onClick={() => setChannel(c)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium ${
                  activeChannel === c
                    ? c === 'mafia'
                      ? 'bg-rose-600 text-white'
                      : c === 'dead'
                      ? 'bg-violet-600 text-white'
                      : 'bg-[#5865F2] text-white'
                    : 'bg-[#0F1115] text-[#9CA3AF] hover:text-white'
                }`}
              >
                {c === 'dead' && <Ghost className="h-3 w-3" />}
                {c === 'public' ? t.tableChat : c === 'mafia' ? t.mafiaWhisper : t.graveyardTitle}
              </button>
            ))}
          </div>
        )}
        {activeChannel === 'dead' && (
          <p className="flex items-center gap-1.5 text-[11px] text-violet-300">
            <Ghost className="h-3 w-3 shrink-0" />
            {t.graveyardChatNote}
          </p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="h-9 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0F1115] px-3 text-xs text-white placeholder-[#6B7280] focus:border-[#5865F2] focus:outline-none"
          />
          <button
            type="submit"
            className={`h-9 rounded-lg px-3 text-xs font-semibold text-white ${
              activeChannel === 'dead' ? 'bg-violet-600 hover:bg-violet-500' : 'bg-[#5865F2] hover:bg-[#4752C4]'
            }`}
          >
            {t.send}
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatLine({ t, msg }: { t: Translations; msg: ChatMessage }) {
  if (msg.channel === 'system') {
    return (
      <p className="text-xs leading-relaxed text-[#9CA3AF]">
        {msg.log ? formatLog(t, msg.log, msg.text) : msg.text}
      </p>
    );
  }
  const tone =
    msg.channel === 'mafia' ? 'text-rose-400' : msg.channel === 'dead' ? 'text-violet-300' : 'text-[#C7D2FE]';
  const prefix =
    msg.channel === 'mafia'
      ? `[${t.roles.mafia.label}] `
      : msg.channel === 'dead'
      ? `[${t.graveyardTitle}] `
      : '';
  return (
    <p className="text-xs leading-relaxed">
      <span className={`font-semibold ${tone}`}>
        {prefix}
        {msg.senderName}:
      </span>{' '}
      <span className="text-[#E5E7EB]">{msg.text}</span>
    </p>
  );
}
