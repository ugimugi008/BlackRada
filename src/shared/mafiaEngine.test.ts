import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignRolesToPlayers,
  buildRoleDeck,
  checkWinCondition,
  formatSeatNumber,
  getNextNightStep,
  isPlayerAwakeDuringNight,
  redactRoomForViewer,
  resolveNightOutcome,
  sanitizeNickname,
  tallyVotes,
  type PlayerRecord,
} from './mafiaEngine';

function makePlayer(overrides: Partial<PlayerRecord> & { id: string }): PlayerRecord {
  return {
    nickname: overrides.id,
    seatNumber: 1,
    isModerator: false,
    isAlive: true,
    isConnected: true,
    role: null,
    micMuted: false,
    camOff: false,
    modForceMuted: false,
    modForceCamHidden: false,
    ...overrides,
  };
}

test('sanitizeNickname trims whitespace, removes newlines, and caps length', () => {
  assert.equal(sanitizeNickname('  Alex\n\tM  '), 'Alex M');
  assert.equal(sanitizeNickname('   ', 'Guest'), 'Guest');
  assert.equal(sanitizeNickname('A'.repeat(40)).length, 24);
});

test('formatSeatNumber formats Moderator and zero-padded seats', () => {
  assert.equal(formatSeatNumber(0), 'MOD');
  assert.equal(formatSeatNumber(1), '01');
  assert.equal(formatSeatNumber(12), '12');
});

test('buildRoleDeck and assignRolesToPlayers preserve Moderator role=null and exact role counts', () => {
  const deck = buildRoleDeck(7, { mafiaCount: 1, hasDon: true, hasSheriff: true, hasDoctor: true });
  assert.equal(deck.length, 7);
  assert.equal(deck.filter((r) => r === 'don').length, 1);
  assert.equal(deck.filter((r) => r === 'mafia').length, 1);
  assert.equal(deck.filter((r) => r === 'sheriff').length, 1);
  assert.equal(deck.filter((r) => r === 'doctor').length, 1);
  assert.equal(deck.filter((r) => r === 'villager').length, 3);

  const players: PlayerRecord[] = [
    makePlayer({ id: 'mod', seatNumber: 0, isModerator: true }),
    makePlayer({ id: 'p1', seatNumber: 1 }),
    makePlayer({ id: 'p2', seatNumber: 2 }),
    makePlayer({ id: 'p3', seatNumber: 3 }),
    makePlayer({ id: 'p4', seatNumber: 4 }),
  ];

  const assigned = assignRolesToPlayers(players, {
    mafiaCount: 1,
    hasDon: false,
    hasSheriff: true,
    hasDoctor: false,
  });

  assert.equal(assigned[0].role, null);
  const seatedRoles = assigned.slice(1).map((p) => p.role);
  assert.equal(seatedRoles.filter((r) => r === 'mafia').length, 1);
  assert.equal(seatedRoles.filter((r) => r === 'sheriff').length, 1);
  assert.equal(seatedRoles.filter((r) => r === 'villager').length, 2);
});

test('night steps skip eliminated or unused roles and wake only matching roles', () => {
  const players: PlayerRecord[] = [
    makePlayer({ id: 'mod', seatNumber: 0, isModerator: true }),
    makePlayer({ id: 'p1', seatNumber: 1, role: 'mafia', isAlive: true }),
    makePlayer({ id: 'p2', seatNumber: 2, role: 'sheriff', isAlive: false }),
    makePlayer({ id: 'p3', seatNumber: 3, role: 'doctor', isAlive: true }),
    makePlayer({ id: 'p4', seatNumber: 4, role: 'villager', isAlive: true }),
  ];

  assert.equal(getNextNightStep('SLEEP', players), 'MAFIA');
  assert.equal(getNextNightStep('MAFIA', players), 'DOCTOR');
  assert.equal(getNextNightStep('DOCTOR', players), 'RESOLVE');

  assert.equal(isPlayerAwakeDuringNight(players[0], 'SLEEP'), true);
  assert.equal(isPlayerAwakeDuringNight(players[1], 'MAFIA'), true);
  assert.equal(isPlayerAwakeDuringNight(players[4], 'MAFIA'), false);
  assert.equal(isPlayerAwakeDuringNight(players[2], 'SHERIFF'), false); // dead
});

test('resolveNightOutcome handles doctor save vs mafia elimination', () => {
  const players: PlayerRecord[] = [
    makePlayer({ id: 'p1', nickname: 'Alice', seatNumber: 1, role: 'mafia' }),
    makePlayer({ id: 'p2', nickname: 'Bob', seatNumber: 2, role: 'sheriff' }),
    makePlayer({ id: 'p3', nickname: 'Cara', seatNumber: 3, role: 'doctor' }),
  ];

  const savedResult = resolveNightOutcome(players, {
    mafiaTargetId: 'p2',
    donCheckId: null,
    sheriffCheckId: 'p1',
    doctorSaveId: 'p2',
  });
  assert.equal(savedResult.eliminatedPlayerId, null);
  assert.equal(savedResult.savedByDoctor, true);
  assert.equal(savedResult.sheriffFoundMafia, true);

  const killResult = resolveNightOutcome(players, {
    mafiaTargetId: 'p2',
    donCheckId: null,
    sheriffCheckId: null,
    doctorSaveId: 'p3',
  });
  assert.equal(killResult.eliminatedPlayerId, 'p2');
  assert.equal(killResult.savedByDoctor, false);
});

test('tallyVotes identifies clear leader, ties, and skips', () => {
  const alive = new Set(['p1', 'p2', 'p3', 'p4']);
  const clear = tallyVotes({ p1: 'p2', p3: 'p2', p4: 'p1' }, alive);
  assert.equal(clear.leaderId, 'p2');
  assert.equal(clear.isTie, false);

  const tie = tallyVotes({ p1: 'p2', p2: 'p1', p3: 'SKIP', p4: 'SKIP' }, alive);
  assert.equal(tie.leaderId, null);
  assert.equal(tie.isTie, false); // SKIP beat or tied; no elimination
});

test('checkWinCondition detects TOWN and MAFIA victory accurately', () => {
  const townWins = [
    makePlayer({ id: 'p1', role: 'mafia', isAlive: false }),
    makePlayer({ id: 'p2', role: 'villager', isAlive: true }),
    makePlayer({ id: 'p3', role: 'doctor', isAlive: true }),
  ];
  assert.equal(checkWinCondition(townWins), 'TOWN');

  const mafiaWins = [
    makePlayer({ id: 'p1', role: 'don', isAlive: true }),
    makePlayer({ id: 'p2', role: 'villager', isAlive: true }),
  ];
  assert.equal(checkWinCondition(mafiaWins), 'MAFIA');
});

test('redactRoomForViewer hides secret roles from non-moderator villagers', () => {
  const players: PlayerRecord[] = [
    makePlayer({ id: 'mod', seatNumber: 0, isModerator: true }),
    makePlayer({ id: 'p1', seatNumber: 1, role: 'mafia' }),
    makePlayer({ id: 'p2', seatNumber: 2, role: 'villager' }),
    makePlayer({ id: 'p3', seatNumber: 3, role: 'sheriff' }),
  ];

  const baseRoom = {
    code: 'ABCD',
    roomName: 'Friday Mafia',
    phase: 'NIGHT' as const,
    nightNumber: 1,
    dayNumber: 0,
    nightStep: 'MAFIA' as const,
    roleConfig: { mafiaCount: 1, hasDon: false, hasSheriff: true, hasDoctor: false },
    players,
    votes: {},
    nightActions: { mafiaTargetId: 'p3', donCheckId: null, sheriffCheckId: null, doctorSaveId: null },
    lastMorningSummary: null,
    winner: null,
    timerSecondsLeft: 0,
    timerRunning: false,
    messages: [
      { id: 'm1', senderId: 'p1', senderName: 'p1', text: 'Target 3', timestamp: 1, channel: 'mafia' as const },
      { id: 'm2', senderId: 'mod', senderName: 'mod', text: 'Night begins', timestamp: 2, channel: 'system' as const },
    ],
  };

  const villagerView = redactRoomForViewer(baseRoom, 'p2');
  assert.equal(villagerView.myRole, 'villager');
  assert.equal(villagerView.nightActions, null);
  assert.equal(villagerView.players.find((p) => p.id === 'p1')?.role, null);
  assert.equal(villagerView.players.find((p) => p.id === 'p3')?.role, null);
  assert.equal(villagerView.messages.length, 1);

  const modView = redactRoomForViewer(baseRoom, 'mod');
  assert.equal(modView.isMeModerator, true);
  assert.equal(modView.players.find((p) => p.id === 'p1')?.role, 'mafia');
  assert.equal(modView.nightActions?.mafiaTargetId, 'p3');
  assert.equal(modView.messages.length, 2);
});
