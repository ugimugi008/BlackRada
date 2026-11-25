/**
 * Game log ("Table" system messages) as language-neutral entries.
 *
 * The server stores { key, params } and every client renders the entry in its
 * own language, so switching EN/UA re-translates the whole log instantly.
 * Ukrainian templates use present-tense / impersonal forms on purpose, so they
 * read correctly whatever the player's gender (no сів/сіла guesswork).
 */

export type LogKey =
  | 'timerDone'
  | 'roomOpened'
  | 'tookSeat'
  | 'renamed'
  | 'kicked'
  | 'rolesCleared'
  | 'rolesDealt'
  | 'markedAlive'
  | 'markedDead'
  | 'teamWins'
  | 'nightBegins'
  | 'nightQuiet'
  | 'nightSaved'
  | 'nightKilled'
  | 'dayOpened'
  | 'votingOpen'
  | 'votedOut'
  | 'noElimination'
  | 'roundEnded'
  | 'lobbyReset'
  | 'modPassed'
  | 'modTakeover'
  | 'left'
  | 'seatsShuffled'
  | 'seatChanged'
  | 'lastWordsStart'
  | 'lastWordsEnd'
  | 'talkCalled'
  | 'talkStart'
  // Private feedback & errors (not table log lines, same translation path)
  | 'fbMarked'
  | 'fbIsSheriff'
  | 'fbNotSheriff'
  | 'fbIsMafia'
  | 'fbIsTown'
  | 'fbProtecting'
  | 'fbNotAllowed'
  | 'errRoomNotFound'
  | 'errRoomFull'
  | 'errAlreadyModerator'
  | 'errModeratorBack'
  | 'errTakeoverFailed'
  | 'errSessionExpired'
  | 'errReplaced';

export type LogParams = Record<string, string | number>;

export interface LogEntry {
  key: LogKey;
  params?: LogParams;
}

export interface LogDictionary {
  log: Record<LogKey, string>;
  teamNames: { TOWN: string; MAFIA: string };
}

export const LOG_EN: LogDictionary = {
  log: {
    timerDone: 'Discussion timer finished.',
    roomOpened: '{name} opened the room as Moderator.',
    tookSeat: '{name} took Seat {seat}.',
    renamed: 'Moderator renamed {prev} to {next}.',
    kicked: '{name} was removed from the table.',
    rolesCleared: 'Moderator cleared all dealt roles.',
    rolesDealt: 'Moderator dealt secret roles to all seated players.',
    markedAlive: 'Moderator brought Seat {seat} ({name}) back into the game.',
    markedDead: 'Seat {seat} ({name}) is out of the game.',
    teamWins: '{team} wins the game!',
    nightBegins: 'Night {n} begins. The town goes to sleep.',
    nightQuiet: 'Day {day}: the night passed quietly. No one was targeted.',
    nightSaved: 'Day {day}: the town wakes up intact. The Doctor saved the target.',
    nightKilled: 'Day {day}: Seat {seat} ({name}) was eliminated during the night.',
    dayOpened: 'Moderator opened Day {n} discussion.',
    votingOpen: 'Voting is open. Alive players may cast a vote.',
    votedOut: 'Town voted out Seat {seat} ({name}).',
    noElimination: 'No player was eliminated during voting.',
    roundEnded: 'Moderator ended the round and revealed all roles.',
    lobbyReset: 'Moderator reset the table to Lobby for a new round.',
    modPassed: '{from} passed the Moderator role to {to}. The table is back in Lobby.',
    modTakeover: '{to} took over as Moderator because {from} was offline. The table is back in Lobby.',
    left: '{name} left the room.',
    seatsShuffled: 'Moderator shuffled the seats. Check your new number.',
    seatChanged: 'Moderator moved {name} to Seat {seat}.',
    lastWordsStart: 'Last words: Seat {seat} ({name}), {s} seconds.',
    lastWordsEnd: 'Last words are over.',
    talkCalled: 'Called to speak: Seat {seat} ({name}).',
    talkStart: 'Speech: Seat {seat} ({name}), {s} seconds.',
    fbMarked: 'Marked {name} for tonight.',
    fbIsSheriff: '{name} is the Sheriff!',
    fbNotSheriff: '{name} is not the Sheriff.',
    fbIsMafia: '{name} belongs to the MAFIA.',
    fbIsTown: '{name} belongs to the TOWN.',
    fbProtecting: 'Protecting {name} tonight.',
    fbNotAllowed: 'Action not allowed during this step.',
    errRoomNotFound: 'Room not found. Check the room code and try again.',
    errRoomFull: 'This room is at the 20-player limit.',
    errAlreadyModerator: 'You are already the Moderator.',
    errModeratorBack: 'The Moderator is back online.',
    errTakeoverFailed: 'Could not take over.',
    errSessionExpired: 'Your previous seat is no longer available. Join again with the room code.',
    errReplaced: 'This seat was opened in another tab or on another device.',
  },
  teamNames: { TOWN: 'Town', MAFIA: 'Mafia' },
};

export const LOG_UK: LogDictionary = {
  log: {
    timerDone: 'Таймер обговорення завершено.',
    roomOpened: 'Кімнату відкрито. Ведучий: {name}.',
    tookSeat: '{name} займає місце {seat}.',
    renamed: 'Ведучий перейменовує {prev} на {next}.',
    kicked: '{name} видалено з-за столу.',
    rolesCleared: 'Ведучий скидає всі роздані ролі.',
    rolesDealt: 'Ведучий роздає таємні ролі всім гравцям.',
    markedAlive: 'Ведучий повертає до гри місце {seat} ({name}).',
    markedDead: 'Місце {seat} ({name}) вибуває з гри.',
    teamWins: 'Перемога: {team}!',
    nightBegins: 'Ніч {n}. Місто засинає.',
    nightQuiet: 'День {day}: ніч минула спокійно. Ніхто не постраждав.',
    nightSaved: 'День {day}: місто прокидається без втрат. Лікар урятував ціль.',
    nightKilled: 'День {day}: уночі вбито гравця на місці {seat} ({name}).',
    dayOpened: 'Ведучий відкриває обговорення. День {n}.',
    votingOpen: 'Голосування відкрито. Голосують живі гравці.',
    votedOut: 'Місто виганяє гравця на місці {seat} ({name}).',
    noElimination: 'За підсумками голосування ніхто не вибуває.',
    roundEnded: 'Ведучий завершує раунд і відкриває всі ролі.',
    lobbyReset: 'Ведучий повертає стіл до Лобі для нового раунду.',
    modPassed: '{from} передає роль Ведучого гравцю {to}. Стіл повертається до Лобі.',
    modTakeover: '{to} стає Ведучим, бо {from} не в мережі. Стіл повертається до Лобі.',
    left: '{name} виходить з кімнати.',
    seatsShuffled: 'Ведучий перемішує місця. Перевірте свій новий номер.',
    seatChanged: 'Ведучий пересаджує {name} на місце {seat}.',
    lastWordsStart: 'Останнє слово: місце {seat} ({name}), {s} с.',
    lastWordsEnd: 'Останнє слово завершено.',
    talkCalled: 'На розмову: місце {seat} ({name}).',
    talkStart: 'Промова: місце {seat} ({name}), {s} с.',
    fbMarked: 'Ціль на цю ніч: {name}.',
    fbIsSheriff: '{name} — Шериф!',
    fbNotSheriff: '{name} — не Шериф.',
    fbIsMafia: '{name} — МАФІЯ.',
    fbIsTown: '{name} — мирний житель (МІСТО).',
    fbProtecting: 'Цієї ночі ви захищаєте: {name}.',
    fbNotAllowed: 'Ця дія зараз недоступна.',
    errRoomNotFound: 'Кімнату не знайдено. Перевірте код і спробуйте ще раз.',
    errRoomFull: 'Кімната заповнена (максимум 20 гравців).',
    errAlreadyModerator: 'Ви вже Ведучий.',
    errModeratorBack: 'Ведучий знову в мережі.',
    errTakeoverFailed: 'Не вдалося стати Ведучим.',
    errSessionExpired: 'Ваше попереднє місце вже недоступне. Приєднайтеся знову за кодом кімнати.',
    errReplaced: 'Це місце відкрито в іншій вкладці або на іншому пристрої.',
  },
  teamNames: { TOWN: 'Місто', MAFIA: 'Мафія' },
};

/** Renders a log entry with a dictionary. Unknown keys fall back to `fallback`. */
export function formatLog(dict: LogDictionary, entry: LogEntry, fallback = ''): string {
  const template = dict.log[entry.key];
  if (!template) return fallback;
  const params = entry.params ?? {};
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined) return match;
    if (name === 'team' && (value === 'TOWN' || value === 'MAFIA')) return dict.teamNames[value];
    return String(value);
  });
}
