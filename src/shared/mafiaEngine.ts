import type { Avatar } from './avatars';
import type { LogEntry } from './gameLog';

export type MafiaRole = 'mafia' | 'don' | 'sheriff' | 'doctor' | 'villager';

export type GamePhase = 'LOBBY' | 'NIGHT' | 'DAY' | 'VOTING' | 'ENDED';

export type NightStep = 'SLEEP' | 'MAFIA' | 'DON' | 'SHERIFF' | 'DOCTOR' | 'RESOLVE';

export type WinnerSide = 'MAFIA' | 'TOWN' | null;

export interface RoleConfig {
  mafiaCount: number;
  hasDon: boolean;
  hasSheriff: boolean;
  hasDoctor: boolean;
}

export interface PlayerRecord {
  id: string;
  nickname: string;
  /** Shown on the tile when the camera is off; null = show the initial letter. */
  avatar?: Avatar | null;
  seatNumber: number; // 1-based for seated players, 0 for Moderator
  isModerator: boolean;
  isAlive: boolean;
  isConnected: boolean;
  role: MafiaRole | null;
  micMuted: boolean;
  camOff: boolean;
  modForceMuted: boolean;
  modForceCamHidden: boolean;
}

export interface NightActions {
  mafiaTargetId: string | null;
  donCheckId: string | null;
  sheriffCheckId: string | null;
  doctorSaveId: string | null;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  /** 'dead' = the Graveyard chat: only eliminated players and the Moderator see it. */
  channel: 'public' | 'mafia' | 'system' | 'dead';
  /** System messages carry a language-neutral entry; `text` is the English fallback. */
  log?: LogEntry;
}

/** An eliminated player's final speech: everyone sees and hears them until it ends. */
export interface LastWords {
  playerId: string;
  secondsLeft: number;
}

export interface RoomPublicState {
  code: string;
  roomName: string;
  phase: GamePhase;
  nightNumber: number;
  dayNumber: number;
  nightStep: NightStep;
  roleConfig: RoleConfig;
  players: Array<Omit<PlayerRecord, 'role'> & { role: MafiaRole | null }>;
  votes: Record<string, string | 'SKIP'>; // voterId -> targetPlayerId | 'SKIP'
  nightActions: NightActions | null; // Only sent to Moderator (or filtered)
  lastMorningSummary: LogEntry | null;
  winner: WinnerSide;
  timerSecondsLeft: number;
  timerRunning: boolean;
  lastWords: LastWords | null;
  /** Length of last words for this table; 0 = off. */
  lastWordsSeconds: number;
  /** Players called out to speak this round ("На розмову"), in call order. */
  talkList: Array<{ playerId: string; done: boolean }>;
  /** A called player's speech in progress. */
  talk: LastWords | null;
  talkSeconds: number;
  myPlayerId: string;
  myRole: MafiaRole | null;
  isMeModerator: boolean;
  messages: ChatMessage[];
}

export const ROLE_META: Record<
  MafiaRole,
  {
    label: string;
    team: 'MAFIA' | 'TOWN';
    shortDesc: string;
    nightPrompt: string;
  }
> = {
  mafia: {
    label: 'Mafia',
    team: 'MAFIA',
    shortDesc: 'Eliminate town members under cover of night and blend in during the day.',
    nightPrompt: 'Choose a town member to eliminate tonight.',
  },
  don: {
    label: 'Mafia Don',
    team: 'MAFIA',
    shortDesc: 'Leads the Mafia kill and can inspect one player each night to find the Sheriff.',
    nightPrompt: 'Coordinate the Mafia kill and inspect a player to locate the Sheriff.',
  },
  sheriff: {
    label: 'Sheriff',
    team: 'TOWN',
    shortDesc: 'Investigate one player each night to learn whether they belong to the Mafia.',
    nightPrompt: 'Select one player to investigate tonight.',
  },
  doctor: {
    label: 'Doctor',
    team: 'TOWN',
    shortDesc: 'Protect one player each night from being eliminated by the Mafia.',
    nightPrompt: 'Select one player to protect tonight.',
  },
  villager: {
    label: 'Townsperson',
    team: 'TOWN',
    shortDesc: 'Observe discussions, spot contradictions, and vote out Mafia during the day.',
    nightPrompt: 'Rest quietly until morning.',
  },
};

export function sanitizeNickname(raw: string, fallback = 'Player'): string {
  const cleaned = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, 24);
}

export function formatSeatNumber(seatNumber: number): string {
  if (seatNumber <= 0) return 'MOD';
  return String(seatNumber).padStart(2, '0');
}

export function getRecommendedRoleConfig(seatedPlayerCount: number): RoleConfig {
  if (seatedPlayerCount <= 4) {
    return { mafiaCount: 1, hasDon: false, hasSheriff: true, hasDoctor: false };
  }
  if (seatedPlayerCount <= 6) {
    return { mafiaCount: 1, hasDon: false, hasSheriff: true, hasDoctor: true };
  }
  if (seatedPlayerCount <= 9) {
    return { mafiaCount: 1, hasDon: true, hasSheriff: true, hasDoctor: true };
  }
  return {
    mafiaCount: Math.max(2, Math.floor(seatedPlayerCount / 3) - 1),
    hasDon: true,
    hasSheriff: true,
    hasDoctor: true,
  };
}

export function buildRoleDeck(seatedCount: number, config: RoleConfig): MafiaRole[] {
  if (seatedCount <= 0) return [];
  const deck: MafiaRole[] = [];

  if (config.hasDon && deck.length < seatedCount) {
    deck.push('don');
  }

  for (let i = 0; i < config.mafiaCount && deck.length < seatedCount; i++) {
    deck.push('mafia');
  }

  if (config.hasSheriff && deck.length < seatedCount) {
    deck.push('sheriff');
  }

  if (config.hasDoctor && deck.length < seatedCount) {
    deck.push('doctor');
  }

  while (deck.length < seatedCount) {
    deck.push('villager');
  }

  return deck;
}

export function shuffleArray<T>(items: T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function assignRolesToPlayers(
  players: PlayerRecord[],
  config: RoleConfig,
  rng: () => number = Math.random
): PlayerRecord[] {
  const seated = players.filter((p) => !p.isModerator);
  const deck = shuffleArray(buildRoleDeck(seated.length, config), rng);
  let idx = 0;
  return players.map((player) => {
    if (player.isModerator) {
      return { ...player, role: null, isAlive: true };
    }
    const role = deck[idx++] ?? 'villager';
    return { ...player, role, isAlive: true };
  });
}

export function getActiveNightSteps(players: PlayerRecord[]): NightStep[] {
  const aliveSeated = players.filter((p) => !p.isModerator && p.isAlive);
  const steps: NightStep[] = ['SLEEP'];
  const hasMafiaTeam = aliveSeated.some((p) => p.role === 'mafia' || p.role === 'don');
  if (hasMafiaTeam) steps.push('MAFIA');
  if (aliveSeated.some((p) => p.role === 'don')) steps.push('DON');
  if (aliveSeated.some((p) => p.role === 'sheriff')) steps.push('SHERIFF');
  if (aliveSeated.some((p) => p.role === 'doctor')) steps.push('DOCTOR');
  steps.push('RESOLVE');
  return steps;
}

export function getNextNightStep(current: NightStep, players: PlayerRecord[]): NightStep {
  const steps = getActiveNightSteps(players);
  const idx = steps.indexOf(current);
  if (idx === -1 || idx >= steps.length - 1) return 'RESOLVE';
  return steps[idx + 1];
}

export function isPlayerAwakeDuringNight(player: PlayerRecord, nightStep: NightStep): boolean {
  if (player.isModerator) return true;
  if (!player.isAlive) return false;
  if (nightStep === 'MAFIA') return player.role === 'mafia' || player.role === 'don';
  if (nightStep === 'DON') return player.role === 'don';
  if (nightStep === 'SHERIFF') return player.role === 'sheriff';
  if (nightStep === 'DOCTOR') return player.role === 'doctor';
  return false;
}

export function resolveNightOutcome(
  players: PlayerRecord[],
  actions: NightActions
): {
  eliminatedPlayerId: string | null;
  savedByDoctor: boolean;
  donFoundSheriff: boolean;
  sheriffFoundMafia: boolean;
  summary: string;
  /** Language-neutral version of `summary` (the server adds the day number). */
  summaryLog: LogEntry;
} {
  const target = players.find((p) => p.id === actions.mafiaTargetId && !p.isModerator && p.isAlive) ?? null;
  const saved = Boolean(target && actions.doctorSaveId && target.id === actions.doctorSaveId);

  const donTarget = players.find((p) => p.id === actions.donCheckId) ?? null;
  const sheriffTarget = players.find((p) => p.id === actions.sheriffCheckId) ?? null;

  const donFoundSheriff = donTarget?.role === 'sheriff';
  const sheriffFoundMafia = sheriffTarget?.role === 'mafia' || sheriffTarget?.role === 'don';

  if (!target) {
    return {
      eliminatedPlayerId: null,
      savedByDoctor: false,
      donFoundSheriff,
      sheriffFoundMafia,
      summary: 'Night ended quietly. No one was targeted.',
      summaryLog: { key: 'nightQuiet' },
    };
  }

  if (saved) {
    return {
      eliminatedPlayerId: null,
      savedByDoctor: true,
      donFoundSheriff,
      sheriffFoundMafia,
      summary: 'The town wakes up intact — the Doctor saved the targeted player.',
      summaryLog: { key: 'nightSaved' },
    };
  }

  return {
    eliminatedPlayerId: target.id,
    savedByDoctor: false,
    donFoundSheriff,
    sheriffFoundMafia,
    summary: `Seat ${formatSeatNumber(target.seatNumber)} (${target.nickname}) was eliminated during the night.`,
    summaryLog: {
      key: 'nightKilled',
      params: { seat: formatSeatNumber(target.seatNumber), name: target.nickname },
    },
  };
}

export function tallyVotes(
  votes: Record<string, string | 'SKIP'>,
  alivePlayerIds: Set<string>
): {
  counts: Record<string, number>;
  skipCount: number;
  leaderId: string | null;
  isTie: boolean;
} {
  const counts: Record<string, number> = {};
  let skipCount = 0;

  for (const [voterId, target] of Object.entries(votes)) {
    if (!alivePlayerIds.has(voterId)) continue;
    if (target === 'SKIP') {
      skipCount += 1;
      continue;
    }
    if (!alivePlayerIds.has(target)) continue;
    counts[target] = (counts[target] ?? 0) + 1;
  }

  let maxVotes = 0;
  let leaders: string[] = [];

  for (const [targetId, count] of Object.entries(counts)) {
    if (count > maxVotes) {
      maxVotes = count;
      leaders = [targetId];
    } else if (count === maxVotes) {
      leaders.push(targetId);
    }
  }

  if (maxVotes === 0 || skipCount >= maxVotes) {
    return {
      counts,
      skipCount,
      leaderId: null,
      isTie: skipCount > 0 && skipCount === maxVotes,
    };
  }

  return {
    counts,
    skipCount,
    leaderId: leaders.length === 1 ? leaders[0] : null,
    isTie: leaders.length > 1,
  };
}

export function checkWinCondition(players: PlayerRecord[]): WinnerSide {
  const aliveSeated = players.filter((p) => !p.isModerator && p.isAlive && p.role !== null);
  if (aliveSeated.length === 0) return null;

  const mafiaAlive = aliveSeated.filter((p) => p.role === 'mafia' || p.role === 'don').length;
  const townAlive = aliveSeated.length - mafiaAlive;

  if (mafiaAlive === 0) return 'TOWN';
  if (mafiaAlive >= townAlive) return 'MAFIA';
  return null;
}

export function redactRoomForViewer(
  room: {
    code: string;
    roomName: string;
    phase: GamePhase;
    nightNumber: number;
    dayNumber: number;
    nightStep: NightStep;
    roleConfig: RoleConfig;
    players: PlayerRecord[];
    votes: Record<string, string | 'SKIP'>;
    nightActions: NightActions;
    lastMorningSummary: LogEntry | null;
    winner: WinnerSide;
    timerSecondsLeft: number;
    timerRunning: boolean;
    lastWords?: LastWords | null;
    lastWordsSeconds?: number;
    talkList?: Array<{ playerId: string; done: boolean }>;
    talk?: LastWords | null;
    talkSeconds?: number;
    messages: ChatMessage[];
  },
  viewerId: string
): RoomPublicState {
  const viewer = room.players.find((p) => p.id === viewerId);
  const isMeModerator = Boolean(viewer?.isModerator);
  const gameRunning = room.phase === 'NIGHT' || room.phase === 'DAY' || room.phase === 'VOTING';
  // Eliminated players spectate from the Graveyard and see every role.
  // Someone giving last words is still heard by the living, so they don't get the
  // Graveyard's knowledge (roles, Mafia/Graveyard chat) until their speech ends.
  const givingLastWords = Boolean(viewer && room.lastWords?.playerId === viewer.id);
  const viewerInGraveyard = Boolean(
    viewer && !viewer.isModerator && !viewer.isAlive && gameRunning && !givingLastWords
  );
  const revealAll = isMeModerator || room.phase === 'ENDED' || viewerInGraveyard;

  const playersForViewer = room.players.map((p) => {
    const isSelf = p.id === viewerId;
    const isMafiaAlly =
      (viewer?.role === 'mafia' || viewer?.role === 'don') &&
      (p.role === 'mafia' || p.role === 'don');

    const canSeeRole = revealAll || isSelf || isMafiaAlly;
    return {
      ...p,
      role: canSeeRole ? p.role : null,
    };
  });

  const visibleMessages = room.messages.filter((msg) => {
    if (msg.channel === 'mafia') {
      return (
        isMeModerator ||
        viewer?.role === 'mafia' ||
        viewer?.role === 'don' ||
        viewerInGraveyard ||
        room.phase === 'ENDED'
      );
    }
    if (msg.channel === 'dead') {
      // Hidden from the living while a game runs; everyone may read it afterwards.
      return isMeModerator || viewerInGraveyard || !gameRunning;
    }
    return true;
  });

  return {
    code: room.code,
    roomName: room.roomName,
    phase: room.phase,
    nightNumber: room.nightNumber,
    dayNumber: room.dayNumber,
    nightStep: room.nightStep,
    roleConfig: room.roleConfig,
    players: playersForViewer,
    votes: room.votes,
    nightActions: isMeModerator ? room.nightActions : null,
    lastMorningSummary: room.lastMorningSummary,
    winner: room.winner,
    timerSecondsLeft: room.timerSecondsLeft,
    timerRunning: room.timerRunning,
    lastWords: room.lastWords ?? null,
    lastWordsSeconds: room.lastWordsSeconds ?? 60,
    talkList: room.talkList ?? [],
    talk: room.talk ?? null,
    talkSeconds: room.talkSeconds ?? 30,
    myPlayerId: viewerId,
    myRole: viewer?.role ?? null,
    isMeModerator,
    messages: visibleMessages,
  };
}
