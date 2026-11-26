import { parseAvatar, type Avatar } from './shared/avatars';

/** Your avatar choice, remembered on this device. */
const KEY = 'black_rada_avatar';

export function loadAvatarChoice(): Avatar | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveAvatarChoice(avatar: Avatar | null): void {
  try {
    if (avatar) localStorage.setItem(KEY, JSON.stringify(avatar));
    else localStorage.removeItem(KEY);
  } catch {
    // private browsing / storage full: the choice just isn't remembered
  }
}

/**
 * Turn any picked image (PNG, JPEG, WebP, GIF…) into a small square picture:
 * centre-cropped, 256×256, WebP where the browser can encode it, JPEG otherwise.
 * Animated GIFs become a still picture of their first frame.
 */
export async function prepareAvatarImage(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('not-an-image'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('not-an-image');
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-canvas');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    const encode = (type: string, q: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
    const webp = await encode('image/webp', 0.85);
    if (webp && webp.type === 'image/webp') return webp;
    const jpeg = await encode('image/jpeg', 0.85); // e.g. older Safari can't encode WebP
    if (!jpeg) throw new Error('encode-failed');
    return jpeg;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadAvatar(file: File): Promise<Avatar> {
  const blob = await prepareAvatarImage(file);
  const res = await fetch('/api/avatar', { method: 'POST', headers: { 'Content-Type': blob.type }, body: blob });
  const body = (await res.json().catch(() => null)) as { url?: string } | null;
  const avatar = parseAvatar({ kind: 'photo', url: body?.url });
  if (!res.ok || !avatar) throw new Error('upload-failed');
  return avatar;
}
