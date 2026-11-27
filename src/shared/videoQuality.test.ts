import assert from 'node:assert/strict';
import { test } from 'node:test';
import { capPhoneHd, pickVideoLayer, type TileSize } from './videoQuality';

const pc = { phone: false, pixelRatio: 1 };
const mac = { phone: false, pixelRatio: 2 };
const iphone = { phone: true, pixelRatio: 3 };

test('computers get 720p for normal tiles', () => {
  assert.equal(pickVideoLayer({ width: 331, height: 186 }, pc), 'high'); // 5-6 people on a laptop
  assert.equal(pickVideoLayer({ width: 240, height: 135 }, pc), 'high');
  assert.equal(pickVideoLayer({ width: 189, height: 106 }, mac), 'high'); // packed table on a Retina Mac
});

test('computers drop only tiny tiles to 360p, never to 180p by size', () => {
  assert.equal(pickVideoLayer({ width: 189, height: 106 }, pc), 'medium');
  assert.equal(pickVideoLayer({ width: 144, height: 81 }, pc), 'medium'); // focus-view thumbnail strip
  assert.equal(pickVideoLayer({ width: 40, height: 20 }, pc), 'medium');
});

test('phones follow the tile size (rounded up)', () => {
  assert.equal(pickVideoLayer({ width: 178, height: 133 }, iphone), 'medium'); // crowded 2-column scroll
  assert.equal(pickVideoLayer({ width: 178, height: 224 }, iphone), 'high'); // 6 people filling the screen
  assert.equal(pickVideoLayer({ width: 364, height: 600 }, iphone), 'high'); // one person enlarged
});

test('unknown size falls back to 360p', () => {
  assert.equal(pickVideoLayer(undefined, pc), 'medium');
  assert.equal(pickVideoLayer(undefined, iphone), 'medium');
});

test('phones keep at most 4 HD, speaker and enlarged first', () => {
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
  const layers = Object.fromEntries(ids.map((id) => [id, 'high' as const]));
  const sizes: Record<string, TileSize> = Object.fromEntries(ids.map((id, i) => [id, { width: 300 + i, height: 300 }]));
  const out = capPhoneHd(layers, sizes, ['a', 'b']);
  assert.equal(Object.values(out).filter((l) => l === 'high').length, 4);
  assert.equal(out.a, 'high');
  assert.equal(out.b, 'high');
  // the remaining two HD slots go to the biggest tiles (f, e)
  assert.equal(out.f, 'high');
  assert.equal(out.e, 'high');
  assert.equal(out.c, 'medium');
});

test('cap leaves fewer than 4 HD untouched', () => {
  const layers = { a: 'high', b: 'low', c: 'medium' } as const;
  assert.deepEqual(capPhoneHd({ ...layers }, {}, []), layers);
});

test('download budget: a full laptop table steps down instead of choking', async () => {
  const { fitDownloadBudget, LAYER_MBPS } = await import('./videoQuality');
  const ids = Array.from({ length: 11 }, (_, i) => `p${i}`);
  const layers = Object.fromEntries(ids.map((id) => [id, 'high' as const]));
  const sizes = Object.fromEntries(ids.map((id, i) => [id, { width: 300 + i, height: 170 }]));
  const out = fitDownloadBudget(layers, sizes, ['p0'], 10);
  const total = Object.values(out).reduce((s, l) => s + LAYER_MBPS[l], 0);
  assert.ok(total <= 10, `total ${total}`);
  assert.equal(out.p0, 'high'); // the speaker keeps 720p
  assert.equal(out.p10, 'high'); // biggest tile keeps 720p longest
  assert.equal(out.p1, 'medium'); // smallest tiles step down first
});

test('download budget leaves a small table alone', async () => {
  const { fitDownloadBudget } = await import('./videoQuality');
  const layers = { a: 'high', b: 'high', c: 'high', d: 'high', e: 'high' } as const;
  assert.deepEqual(fitDownloadBudget({ ...layers }, {}, [], 10), layers);
});

test('a weak connection can still fit a full table at 180p', async () => {
  const { fitDownloadBudget, LAYER_MBPS } = await import('./videoQuality');
  const ids = Array.from({ length: 10 }, (_, i) => `p${i}`);
  const out = fitDownloadBudget(Object.fromEntries(ids.map((id) => [id, 'medium' as const])), {}, [], 1.6);
  const total = Object.values(out).reduce((s, l) => s + LAYER_MBPS[l], 0);
  assert.ok(total <= 1.6, `total ${total}`);
  assert.ok(Object.values(out).every((l) => l === 'low'));
});
