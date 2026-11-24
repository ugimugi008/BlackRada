import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS } from './i18n';
import { getRecommendedRoleConfig } from './mafiaEngine';

test('English and Ukrainian translation dictionaries have identical keys and all roles', () => {
  const enKeys = Object.keys(TRANSLATIONS.en).sort();
  const ukKeys = Object.keys(TRANSLATIONS.uk).sort();
  assert.deepEqual(ukKeys, enKeys);

  const enRoles = Object.keys(TRANSLATIONS.en.roles).sort();
  const ukRoles = Object.keys(TRANSLATIONS.uk.roles).sort();
  assert.deepEqual(ukRoles, enRoles);

  for (const key of enKeys) {
    const enVal = TRANSLATIONS.en[key as keyof typeof TRANSLATIONS.en];
    const ukVal = TRANSLATIONS.uk[key as keyof typeof TRANSLATIONS.uk];
    if (typeof enVal === 'string') {
      assert.ok(typeof ukVal === 'string' && ukVal.length > 0, `Missing uk translation for ${key}`);
    }
  }
});

test('getRecommendedRoleConfig scales appropriately for 7 to 16 players', () => {
  const cfg7 = getRecommendedRoleConfig(7);
  assert.equal(cfg7.hasDon, true);
  assert.equal(cfg7.hasSheriff, true);
  assert.equal(cfg7.hasDoctor, true);
  assert.equal(cfg7.mafiaCount, 1); // 1 Don + 1 Mafia = 2 Mafia total

  const cfg12 = getRecommendedRoleConfig(12);
  assert.equal(cfg12.hasDon, true);
  assert.equal(cfg12.mafiaCount, 3); // 1 Don + 3 Mafia = 4 Mafia total

  const cfg16 = getRecommendedRoleConfig(16);
  assert.equal(cfg16.hasDon, true);
  assert.equal(cfg16.mafiaCount, 4); // 1 Don + 4 Mafia = 5 Mafia total
});
