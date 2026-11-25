import test from 'node:test';
import assert from 'node:assert/strict';
import { perceive, isAwakeForMedia, type MediaContext, type MediaPerson } from './mediaPolicy';
import { LOG_EN, LOG_UK, formatLog, type LogKey } from './gameLog';

const mod: MediaPerson = { id: 'mod', isModerator: true, isAlive: true, role: null };
const mafia: MediaPerson = { id: 'maf', isModerator: false, isAlive: true, role: 'mafia' };
const don: MediaPerson = { id: 'don', isModerator: false, isAlive: true, role: 'don' };
const villager: MediaPerson = { id: 'vil', isModerator: false, isAlive: true, role: 'villager' };
const deadA: MediaPerson = { id: 'deadA', isModerator: false, isAlive: false, role: 'sheriff' };
const deadB: MediaPerson = { id: 'deadB', isModerator: false, isAlive: false, role: 'villager' };

const day: MediaContext = { phase: 'DAY', nightStep: 'SLEEP', moderatorListeningToGraveyard: false };
const mafiaNight: MediaContext = { phase: 'NIGHT', nightStep: 'MAFIA', moderatorListeningToGraveyard: false };
const ended: MediaContext = { phase: 'ENDED', nightStep: 'SLEEP', moderatorListeningToGraveyard: false };

const both = { see: true, hear: true };
const none = { see: false, hear: false };

test('everyone always sees and hears the Moderator', () => {
  for (const ctx of [day, mafiaNight, ended]) {
    for (const viewer of [mafia, villager, deadA]) {
      assert.deepEqual(perceive(viewer, mod, ctx), both, `${viewer.id} in ${ctx.phase}`);
    }
  }
});

test('night: sleeping villagers cannot see or hear the Mafia; the Mafia see each other', () => {
  assert.deepEqual(perceive(villager, mafia, mafiaNight), none);
  assert.deepEqual(perceive(villager, don, mafiaNight), none);
  assert.deepEqual(perceive(mafia, don, mafiaNight), both);
  assert.deepEqual(perceive(mafia, villager, mafiaNight), none, 'Mafia cannot peek at sleepers');
  assert.equal(isAwakeForMedia(villager, 'NIGHT', 'MAFIA'), false);
  assert.equal(isAwakeForMedia(mafia, 'NIGHT', 'MAFIA'), true);
});

test('graveyard: the living never see or hear the dead', () => {
  for (const ctx of [day, mafiaNight]) {
    assert.deepEqual(perceive(villager, deadA, ctx), none);
    assert.deepEqual(perceive(mafia, deadA, ctx), none);
  }
});

test('graveyard: the dead see and hear each other, day and night', () => {
  assert.deepEqual(perceive(deadA, deadB, day), both);
  assert.deepEqual(perceive(deadA, deadB, mafiaNight), both);
  assert.equal(isAwakeForMedia(deadA, 'NIGHT', 'SLEEP'), true, 'the dead may talk at night');
});

test('graveyard: the dead spectate the living (awake ones at night)', () => {
  assert.deepEqual(perceive(deadA, villager, day), both);
  assert.deepEqual(perceive(deadA, mafia, mafiaNight), both);
  assert.deepEqual(perceive(deadA, villager, mafiaNight), none, 'sleepers are dark for everyone');
});

test('graveyard: Moderator sees the dead but hears them only when tuned in', () => {
  assert.deepEqual(perceive(mod, deadA, day), { see: true, hear: false });
  assert.deepEqual(perceive(mod, deadA, { ...day, moderatorListeningToGraveyard: true }), both);
});

test('after the game ends there is no graveyard: everyone talks together', () => {
  assert.deepEqual(perceive(villager, deadA, ended), both);
  assert.deepEqual(perceive(deadA, villager, ended), both);
});

test('you never hear your own microphone', () => {
  assert.deepEqual(perceive(villager, villager, day), { see: true, hear: false });
});

test('game log: English and Ukrainian have the same keys and placeholders', () => {
  const keys = Object.keys(LOG_EN.log) as LogKey[];
  assert.deepEqual(Object.keys(LOG_UK.log).sort(), [...keys].sort());
  const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
  for (const key of keys) {
    assert.deepEqual(placeholders(LOG_UK.log[key]), placeholders(LOG_EN.log[key]), key);
  }
});

test('game log renders in the chosen language with team names translated', () => {
  const entry = { key: 'teamWins' as const, params: { team: 'MAFIA' } };
  assert.equal(formatLog(LOG_EN, entry), 'Mafia wins the game!');
  assert.equal(formatLog(LOG_UK, entry), 'Перемога: Мафія!');
  const kill = { key: 'nightKilled' as const, params: { day: 2, seat: '04', name: 'Anna' } };
  assert.equal(formatLog(LOG_UK, kill), 'День 2: уночі вбито гравця на місці 04 (Anna).');
});
