import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarSrc, parseAvatar, photoIdFromUrl, sameAvatar, sniffImageType } from './avatars';

test('accepts the built-in avatars and real uploaded-photo links', () => {
  assert.deepEqual(parseAvatar({ kind: 'preset', id: 'fox' }), { kind: 'preset', id: 'fox' });
  const url = '/api/avatar/0123456789abcdef01234567';
  assert.deepEqual(parseAvatar({ kind: 'photo', url }), { kind: 'photo', url });
  assert.equal(photoIdFromUrl(url), '0123456789abcdef01234567');
});

test('rejects anything else (falls back to the initial letter)', () => {
  for (const bad of [
    null,
    'fox',
    { kind: 'preset', id: 'nope' },
    { kind: 'photo', url: 'https://evil.example/x.png' },
    { kind: 'photo', url: '/api/avatar/../../server.ts' },
    { kind: 'photo', url: 'data:image/png;base64,AAAA' },
  ]) {
    assert.equal(parseAvatar(bad), null, JSON.stringify(bad));
  }
});

test('avatar picture address', () => {
  assert.equal(avatarSrc({ kind: 'preset', id: 'kitty' }), '/avatars/kitty.webp');
  assert.equal(avatarSrc(null), null);
  assert.ok(sameAvatar({ kind: 'preset', id: 'oni' }, { kind: 'preset', id: 'oni' }));
  assert.ok(!sameAvatar({ kind: 'preset', id: 'oni' }, null));
});

test('recognises real image files by their first bytes', () => {
  assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 ')), 'image/webp');
  assert.equal(sniffImageType(new TextEncoder().encode('GIF89a')), 'image/gif');
  assert.equal(sniffImageType(new TextEncoder().encode('<script>alert(1)</script>')), null);
});
