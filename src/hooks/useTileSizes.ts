import { useEffect, useState } from 'react';
import type { TileSize } from '../shared/videoQuality';

/** Round sizes so tiny layout jitter doesn't re-trigger quality changes. */
const STEP = 8;

/**
 * Watches every player tile on the page (`article[data-player-id]`) and reports
 * the biggest visible size per player, in CSS pixels. Hidden tiles (e.g. the grid
 * behind the focus view) count as 0 and are skipped.
 */
export function useTileSizes(): Record<string, TileSize> {
  const [sizes, setSizes] = useState<Record<string, TileSize>>({});

  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    let lastKey = '';

    const measure = () => {
      frame = 0;
      const next: Record<string, TileSize> = {};
      document.querySelectorAll<HTMLElement>('article[data-player-id]').forEach((el) => {
        const id = el.dataset.playerId;
        if (!id) return;
        ro.observe(el); // no-op if already observed
        const w = Math.round(el.offsetWidth / STEP) * STEP;
        const h = Math.round(el.offsetHeight / STEP) * STEP;
        if (w === 0 || h === 0) return;
        const prev = next[id];
        if (!prev || w * h > prev.width * prev.height) next[id] = { width: w, height: h };
      });
      const key = JSON.stringify(next);
      if (key !== lastKey) {
        lastKey = key;
        setSizes(next);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    const ro = new ResizeObserver(schedule);
    // Tiles come and go (joins, focus view, graveyard): re-scan when the DOM changes.
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', schedule);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return sizes;
}
