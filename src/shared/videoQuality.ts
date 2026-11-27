/**
 * Which video layer to receive for each remote camera.
 *
 * Every camera is sent in three layers: 720p ('high'), 360p ('medium') and a tiny
 * 180p ('low'). A viewer asks the server for one layer per person, based on how
 * big that person appears on this screen (rounded up), then trims the total to a
 * download budget so weak connections stay smooth.
 *
 * - Computers: 720p for any normal-sized tile; tiny tiles (thumbnail strip) 360p.
 * - Phones: sized to the tile (sharpness counted up to 2x), at most a few 720p
 *   videos at once. Whoever is enlarged / giving a speech / last words is first
 *   in line for 720p.
 * - 180p is only used to fit the budget / a weak connection, never chosen by size.
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
  // 'low' (180p) is never asked for by size: it's the emergency level the download
  // budget (and the server, on a weak connection) steps down to.
  if (!tile || tile.width <= 0 || tile.height <= 0) return 'medium';
  if (opts.phone) {
    const p = neededVideoHeight(tile, Math.min(opts.pixelRatio, 2));
    // rounded up: the smallest layer that is at least as sharp as the tile
    return p <= 360 ? 'medium' : 'high';
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

/**
 * Rough download cost of each layer, in Mbps (what the senders are capped at).
 * Used to keep the total a device receives within a sane budget, so home Wi-Fi
 * and mobile data keep up and the video server doesn't have to keep switching
 * layers (every switch briefly freezes that person's picture).
 */
export const LAYER_MBPS: Record<VideoLayer, number> = { high: 1.5, medium: 0.45, low: 0.15 };
export const DOWNLOAD_BUDGET_MBPS = { computer: 10, phone: 4 } as const;

/**
 * Step people down (720p → 360p → 180p) until the total fits the budget.
 * Smallest tiles drop first; everyone in `priority` (enlarged / speaking / last
 * words) keeps their layer. If even all-180p doesn't fit, that's the floor.
 */
export function fitDownloadBudget(
  layers: Record<string, VideoLayer>,
  sizes: Record<string, TileSize | undefined>,
  priority: (string | null | undefined)[],
  budgetMbps: number
): Record<string, VideoLayer> {
  const out = { ...layers };
  const total = () => Object.values(out).reduce((sum, l) => sum + LAYER_MBPS[l], 0);
  const area = (id: string) => (sizes[id]?.width ?? 0) * (sizes[id]?.height ?? 0);
  const down: Record<VideoLayer, VideoLayer | null> = { high: 'medium', medium: 'low', low: null };
  const rank: Record<VideoLayer, number> = { high: 2, medium: 1, low: 0 };
  while (total() > budgetMbps) {
    const candidates = Object.keys(out).filter((id) => down[out[id]] && !priority.includes(id));
    if (candidates.length === 0) break;
    // highest layer first, then the smallest tile
    candidates.sort((a, b) => rank[out[b]] - rank[out[a]] || area(a) - area(b));
    out[candidates[0]] = down[out[candidates[0]]]!;
  }
  return out;
}
