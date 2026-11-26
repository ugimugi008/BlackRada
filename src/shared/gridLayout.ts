/**
 * Pick the column count that makes N tiles of a fixed aspect ratio as big as
 * possible inside a width x height box (Discord-style). If even the best fit
 * is narrower than `minTile`, fall back to a scrolling layout instead.
 *
 * When the tiles are limited by width (e.g. a phone held upright), they may
 * grow taller to fill the leftover height, down to `tallestAspect`
 * (width / height), so the screen is used instead of leaving empty bands.
 */
export function computeGridLayout(
  count: number,
  width: number,
  height: number,
  opts: { aspect: number; gap: number; minTile: number; tallestAspect?: number },
): { columns: number; tileWidth: number; tileHeight: number; fits: boolean } {
  const { aspect, gap, minTile } = opts;
  const tallest = Math.min(opts.tallestAspect ?? aspect, aspect);
  if (count <= 0 || width <= 0)
    return { columns: 1, tileWidth: Math.max(0, width), tileHeight: Math.floor(Math.max(0, width) / aspect), fits: true };
  let best = { columns: 1, tileWidth: 0 };
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const byWidth = (width - (cols - 1) * gap) / cols;
    const byHeight = ((height - (rows - 1) * gap) / rows) * aspect;
    const w = Math.floor(Math.min(byWidth, byHeight));
    if (w > best.tileWidth) best = { columns: cols, tileWidth: w };
  }
  if (best.tileWidth >= minTile) {
    const rows = Math.ceil(count / best.columns);
    const rowHeight = (height - (rows - 1) * gap) / rows;
    const tileHeight = Math.floor(
      Math.max(best.tileWidth / aspect, Math.min(rowHeight, best.tileWidth / tallest)),
    );
    return { ...best, tileHeight, fits: true };
  }
  // Too crowded to fit on one screen: scroll, with as many columns as the minimum width allows.
  const cols = Math.max(
    1,
    Math.min(count, Math.floor((width + gap) / (minTile + gap))),
  );
  const tileWidth = Math.floor((width - (cols - 1) * gap) / cols);
  return { columns: cols, tileWidth, tileHeight: Math.floor(tileWidth / aspect), fits: false };
}
