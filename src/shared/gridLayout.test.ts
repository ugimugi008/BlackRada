import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeGridLayout } from './gridLayout';

const desktop = { aspect: 16 / 9, gap: 14, minTile: 170 };
const phone = { aspect: 4 / 3, gap: 8, minTile: 130 };

test('one person fills the space', () => {
  const r = computeGridLayout(1, 1000, 600, desktop);
  assert.equal(r.columns, 1);
  assert.equal(r.fits, true);
  assert.equal(r.tileWidth, Math.floor(600 * (16 / 9)) > 1000 ? 1000 : Math.floor(600 * (16 / 9)));
});

test('two people on a wide monitor sit side by side and are big', () => {
  const r = computeGridLayout(2, 1600, 800, desktop);
  assert.equal(r.columns, 2);
  assert.ok(r.tileWidth > 700);
});

test('tiles get smaller as people join, never bigger', () => {
  let last = Infinity;
  for (let n = 1; n <= 17; n++) {
    const r = computeGridLayout(n, 1000, 630, desktop);
    assert.ok(r.tileWidth <= last, `n=${n}`);
    last = r.tileWidth;
  }
});

test('a full 16-player table + moderator fits a laptop screen without scrolling', () => {
  const r = computeGridLayout(17, 1000, 630, desktop);
  assert.equal(r.fits, true);
  const rows = Math.ceil(17 / r.columns);
  const tileH = r.tileWidth / (16 / 9);
  assert.ok(rows * tileH + (rows - 1) * 14 <= 630);
});

test('8 players fit a phone; 13 fall back to a 2-column scroll', () => {
  assert.equal(computeGridLayout(8, 355, 500, phone).fits, true);
  const crowded = computeGridLayout(13, 355, 500, phone);
  assert.equal(crowded.fits, false);
  assert.equal(crowded.columns, 2);
});

test('degenerate inputs are safe', () => {
  assert.equal(computeGridLayout(0, 800, 600, desktop).fits, true);
  assert.equal(computeGridLayout(3, 0, 600, desktop).tileWidth, 0);
});

test('width-limited tiles on a phone grow taller to use the screen, but not past portrait', () => {
  const r = computeGridLayout(6, 364, 690, { ...phone, tallestAspect: 3 / 4 });
  assert.equal(r.fits, true);
  assert.ok(r.tileHeight > r.tileWidth / (4 / 3), `h=${r.tileHeight}`);
  assert.ok(r.tileHeight <= Math.ceil(r.tileWidth / (3 / 4)));
  const rows = Math.ceil(6 / r.columns);
  assert.ok(rows * r.tileHeight + (rows - 1) * 8 <= 690);
});

test('height-limited tiles keep their normal shape', () => {
  const r = computeGridLayout(2, 1600, 300, { ...desktop, tallestAspect: 4 / 3 });
  assert.equal(r.columns, 2);
  assert.ok(Math.abs(r.tileHeight - r.tileWidth / (16 / 9)) <= 1, `${r.tileWidth}x${r.tileHeight}`);
});
