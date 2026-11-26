/**
 * Which video layer to receive for each remote camera.
 *
 * Every camera is sent in three layers: 720p ('high'), 540p ('medium') and
 * 360p ('low'). A viewer asks the server for one layer per person, based on how
 * big that person actually appears on this screen — rounded up — instead of
 * how many people are in the room.
 *
 * - Computers: 720p for any normal-sized tile; only really small tiles (e.g. the
 *   thumbnail strip, a packed table on a non-Retina laptop) get 540p, which looks
 *   identical at that size. Never 360p.
 * - Phones: sized to the tile (screen sharpness counted up to 2x, beyond which the
 *   eye can't tell), and at most a few 720p videos at once so the phone doesn't
 *   overheat or stutter. Whoever is enlarged / giving a speech / last words is
 *   first in line for 720p.
 */

export type VideoLayer = 'low' | 'medium' | 'high';

export interface TileSize {
  /** CSS pixels */
  width: number;
  height: number;
}

/** 720p videos a phone receives at once, at most. */
export const PHONE_MAX_HD = 4;

/**
 * The video height (in "p") needed to show a 16:9 camera at full detail in a tile:
 * the tile is covered edge to edge, so whichever side is the tighter fit decides.
 */
export function neededVideoHeight(tile: TileSize, pixelRatio: number): number {
  return Math.max(tile.height, (tile.width * 9) / 16) * pixelRatio;
}

export function pickVideoLayer(tile: TileSize | undefined, opts: { phone: boolean; pixelRatio: number }): VideoLayer {
  if (!tile || tile.width <= 0 || tile.height <= 0) return opts.phone ? 'low' : 'medium';
  if (opts.phone) {
    const p = neededVideoHeight(tile, Math.min(opts.pixelRatio, 2));
    // rounded up: the smallest layer that is at least as sharp as the tile
    return p <= 360 ? 'low' : p <= 540 ? 'medium' : 'high';
  }
  const p = neededVideoHeight(tile, opts.pixelRatio);
  return p < 120 ? 'medium' : 'high';
}

/**
 * Phones only: keep at most `max` people at 720p. The ones in `priority` (in
 * order) keep it first, then the biggest tiles; everyone else drops to 540p.
 */
export function capPhoneHd(
  layers: Record<string, VideoLayer>,
  sizes: Record<string, TileSize | undefined>,
  priority: (string | null | undefined)[],
  max = PHONE_MAX_HD
): Record<string, VideoLayer> {
  const hd = Object.keys(layers).filter((id) => layers[id] === 'high');
  if (hd.length <= max) return layers;
  const area = (id: string) => (sizes[id]?.width ?? 0) * (sizes[id]?.height ?? 0);
  const rank = (id: string) => {
    const i = priority.indexOf(id);
    return i === -1 ? priority.length : i;
  };
  const keep = new Set(
    [...hd].sort((a, b) => rank(a) - rank(b) || area(b) - area(a)).slice(0, max)
  );
  const out = { ...layers };
  for (const id of hd) if (!keep.has(id)) out[id] = 'medium';
  return out;
}

/** Phone = touch-first device with a small screen (tablets count as computers). */
export function isPhoneDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortSide = Math.min(window.screen?.width ?? 1024, window.screen?.height ?? 1024);
  return coarse && shortSide < 600;
}
