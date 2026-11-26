/**
 * Player avatars, shown on your tile when your camera is off.
 *
 * - 'preset': one of the built-in pictures in /public/avatars
 * - 'photo':  a picture the player uploaded (served by the server at /api/avatar/<id>)
 *
 * Only this small value travels with the room state — never the image itself.
 */

export type Avatar = { kind: 'preset'; id: string } | { kind: 'photo'; url: string };

export interface PresetAvatar {
  id: string;
  label: string;
  src: string;
}

export const PRESET_AVATARS: readonly PresetAvatar[] = [
  { id: 'oni', label: 'Oni', src: '/avatars/oni.webp' },
  { id: 'dog', label: 'Doggo', src: '/avatars/dog.webp' },
  { id: 'ukraine', label: 'Ukraine', src: '/avatars/ukraine.webp' },
  { id: 'kitty', label: 'Kitty', src: '/avatars/kitty.webp' },
];

/** Uploaded photos: max size accepted by the server. */
export const MAX_AVATAR_BYTES = 150 * 1024;

export const AVATAR_ID_PATTERN = /^[a-f0-9]{24}$/;
const PHOTO_URL_PATTERN = /^\/api\/avatar\/([a-f0-9]{24})$/;

export function photoIdFromUrl(url: string): string | null {
  return PHOTO_URL_PATTERN.exec(url)?.[1] ?? null;
}

/** A clean Avatar, or null for anything unexpected (no avatar → initial letter). */
export function parseAvatar(raw: unknown): Avatar | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.kind === 'preset' && typeof o.id === 'string' && PRESET_AVATARS.some((p) => p.id === o.id)) {
    return { kind: 'preset', id: o.id };
  }
  if (o.kind === 'photo' && typeof o.url === 'string' && photoIdFromUrl(o.url)) {
    return { kind: 'photo', url: o.url };
  }
  return null;
}

export function avatarSrc(avatar: Avatar | null | undefined): string | null {
  if (!avatar) return null;
  if (avatar.kind === 'photo') return avatar.url;
  return PRESET_AVATARS.find((p) => p.id === avatar.id)?.src ?? null;
}

export function sameAvatar(a: Avatar | null | undefined, b: Avatar | null | undefined): boolean {
  return avatarSrc(a) === avatarSrc(b);
}

/** Recognise real image files by their first bytes (PNG, JPEG, WebP, GIF). */
export function sniffImageType(buf: Uint8Array): 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | null {
  const b = buf;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return 'image/webp';
  }
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
  return null;
}
