import { computeGridLayout } from '../shared/gridLayout';
import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Discord-style video grid: picks the column count that gives every tile the
 * biggest possible size for the space available, centres the result, and
 * glides tiles to their new place when people join or leave.
 *
 * When even the best fit would make tiles too small (e.g. 12+ players on a
 * phone), it falls back to a scrolling grid with a sensible minimum width.
 */

export interface AutoGridItem {
  key: string;
  node: ReactNode;
}

interface AutoGridProps {
  items: AutoGridItem[];
  /** Vertical gap between the grid and each reserve block, in px. */
  sectionGap?: number;
}

interface Layout {
  tileWidth: number;
  tileHeight: number;
  /** Height the grid should occupy when everything fits (content is centred in it). */
  fitHeight: number | null;
  gap: number;
  inputW: number;
  inputH: number;
}

const SM_BREAKPOINT = 640; // Tailwind `sm`
/** The grid never shrinks below this share of the visible area just to make room for extras. */
const MIN_GRID_SHARE = 0.6;
const ANIM_MS = 320;

export function AutoGrid({ items, sectionGap = 16 }: AutoGridProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const count = items.length;

  // ---- measure & compute
  useLayoutEffect(() => {
    const grid = gridRef.current;
    // The scrolling area (its height is the budget) and the other blocks in it (banners,
    // graveyard…) are found by data attribute: parent refs aren't attached yet when a
    // child's layout effect first runs.
    const container = grid?.closest<HTMLElement>('[data-grid-scroll]');
    if (!grid || !container) return;
    const reserves = () => Array.from(container.querySelectorAll<HTMLElement>('[data-grid-reserve]'));

    const compute = () => {
      const W = grid.clientWidth;
      if (W === 0) return; // hidden (focus view) — keep the last layout
      const cs = getComputedStyle(container);
      const innerH =
        container.clientHeight -
        parseFloat(cs.paddingTop || "0") -
        parseFloat(cs.paddingBottom || "0");
      let reserved = 0;
      for (const el of reserves()) {
        const h = el.offsetHeight;
        if (h > 0) reserved += h + sectionGap;
      }
      const H = Math.max(innerH - reserved, innerH * MIN_GRID_SHARE);
      const wide = window.innerWidth >= SM_BREAKPOINT;
      const gap = wide ? 14 : 8;
      const aspect = wide ? 16 / 9 : 4 / 3; // matches the tile's aspect classes
      const minTile = wide ? 170 : 130;
      // Tiles limited by width may grow taller to use the leftover height:
      // up to portrait on phones (their cameras film upright anyway), 4:3 on bigger screens.
      const tallestAspect = wide ? 4 / 3 : 3 / 4;
      const { tileWidth, tileHeight, fits } = computeGridLayout(count, W, H, {
        aspect,
        gap,
        minTile,
        tallestAspect,
      });
      setLayout((prev) => {
        const next: Layout = {
          tileWidth,
          tileHeight,
          fitHeight: fits ? Math.floor(H) : null,
          gap,
          inputW: W,
          inputH: Math.round(H),
        };
        if (
          prev &&
          prev.tileWidth === next.tileWidth &&
          prev.tileHeight === next.tileHeight &&
          prev.fitHeight === next.fitHeight &&
          prev.gap === next.gap &&
          prev.inputW === next.inputW &&
          prev.inputH === next.inputH
        ) {
          return prev;
        }
        return next;
      });
    };

    compute();
    const ro = new ResizeObserver(() => compute());
    ro.observe(container);
    ro.observe(grid);
    for (const el of reserves()) ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [count, sectionGap]);

  // ---- smooth movement (FLIP): remember where each tile was, glide it from there
  const prevRects = useRef(
    new Map<string, { x: number; y: number; w: number; h: number }>(),
  );
  const prevInputs = useRef<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || !layout) return;
    if (grid.offsetWidth === 0) {
      prevInputs.current = null; // hidden: don't animate when it comes back
      return;
    }
    const resized =
      !prevInputs.current ||
      Math.abs(prevInputs.current.w - layout.inputW) > 1 ||
      Math.abs(prevInputs.current.h - layout.inputH) > 1;
    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const animate =
      !resized && !reduceMotion && typeof grid.animate === "function";

    const next = new Map<
      string,
      { x: number; y: number; w: number; h: number }
    >();
    for (const child of Array.from(grid.children) as HTMLElement[]) {
      const key = child.dataset.gridKey;
      if (!key) continue;
      // offset* ignore running transforms, so mid-animation re-renders measure the true slot
      const rect = {
        x: child.offsetLeft,
        y: child.offsetTop,
        w: child.offsetWidth,
        h: child.offsetHeight,
      };
      next.set(key, rect);
      if (!animate || rect.w === 0) continue;
      const old = prevRects.current.get(key);
      if (!old) {
        child.animate(
          [
            { opacity: 0, transform: "scale(0.92)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: ANIM_MS, easing: "ease-out" },
        );
        continue;
      }
      const dx = old.x - rect.x;
      const dy = old.y - rect.y;
      const sx = old.w / rect.w;
      const sy = old.h / rect.h;
      if (
        Math.abs(dx) < 1 &&
        Math.abs(dy) < 1 &&
        Math.abs(sx - 1) < 0.01 &&
        Math.abs(sy - 1) < 0.01
      )
        continue;
      child.animate(
        [
          {
            transformOrigin: "top left",
            transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`,
          },
          { transformOrigin: "top left", transform: "none" },
        ],
        { duration: ANIM_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }
    prevRects.current = next;
    prevInputs.current = { w: layout.inputW, h: layout.inputH };
  });

  const fits = layout?.fitHeight != null;
  return (
    <div
      ref={gridRef}
      data-testid="auto-grid"
      data-fit={layout ? (fits ? "fit" : "scroll") : undefined}
      className={`relative flex flex-wrap justify-center ${fits ? "content-center" : "content-start"}`}
      style={{
        gap: layout?.gap ?? 8,
        minHeight: fits ? layout!.fitHeight! : undefined,
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          data-grid-key={item.key}
          // the tile fills the slot exactly (overrides its own aspect-ratio classes)
          className="min-w-0 [&>article]:aspect-auto [&>article]:h-full"
          style={
            layout
              ? { width: layout.tileWidth, height: layout.tileHeight }
              : { width: "calc(50% - 4px)", aspectRatio: "4 / 3" }
          }
        >
          {item.node}
        </div>
      ))}
    </div>
  );
}
