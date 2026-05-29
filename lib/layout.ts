import {
  LayoutMode,
  LayoutResult,
  PAGE_DIMENSIONS,
  PAGE_MARGIN_MM,
  Page,
  PageFormat,
  Sticker,
  StickerSize,
} from "./types";

/**
 * Max edge length (mm) per size preset. Each sticker is scaled so its longer
 * side equals this value and its shorter side follows the aspect ratio — i.e.
 * every sticker fits inside an `N × N` bounding box. Width and height are
 * therefore *both* capped at N.
 */
const SIZE_MAX_MM: Record<StickerSize, number> = {
  small: 25,
  medium: 35,
  large: 50,
};

/**
 * Stickers with aspect ratio in this range count as "square-ish" — they get
 * the full max edge so they read as visual anchors on the sheet.
 */
const SQUARE_ASPECT_MIN = 0.85;
const SQUARE_ASPECT_MAX = 1 / SQUARE_ASPECT_MIN; // ≈ 1.18

/** When `shrinkNonSquare` is enabled, non-square stickers get this fraction
 *  of the max edge so they can be packed into row-end gaps without dragging
 *  square stickers down with them. */
const NON_SQUARE_SCALE = 0.7;

function isSquareish(natW: number, natH: number): boolean {
  const a = natW / natH;
  return a >= SQUARE_ASPECT_MIN && a <= SQUARE_ASPECT_MAX;
}

export type LayoutOptions = {
  size: StickerSize;
  /** Cutting gap between adjacent stickers, in millimetres. */
  gapMm: number;
  format: PageFormat;
  /**
   * `uniform` — items fit inside the size box, simple row grid (default).
   * `dense`   — skyline bin-packing fills row-end gaps.
   */
  mode: LayoutMode;
  /**
   * When true, non-square stickers are scaled down (squares stay at full
   * size) so they fit into tighter gaps and leave less whitespace.
   */
  shrinkNonSquare: boolean;
};

/**
 * Scale (sticker.width × sticker.height) so its longest side equals `maxEdge`,
 * preserving aspect ratio. Result is the placed size in mm.
 */
function fitToBox(
  natW: number,
  natH: number,
  maxEdge: number,
): { w: number; h: number } {
  const aspect = natW / natH;
  if (aspect >= 1) {
    return { w: maxEdge, h: maxEdge / aspect };
  }
  return { w: maxEdge * aspect, h: maxEdge };
}

/** Per-sticker max-edge: squares stay at `maxEdgeMm`, non-squares optionally
 *  shrink. Returns the value to feed into `fitToBox`. */
function maxEdgeFor(
  natW: number,
  natH: number,
  maxEdgeMm: number,
  shrinkNonSquare: boolean,
): number {
  if (!shrinkNonSquare || isSquareish(natW, natH)) return maxEdgeMm;
  return maxEdgeMm * NON_SQUARE_SCALE;
}

export function layoutStickers(
  stickers: Sticker[],
  opts: LayoutOptions,
): LayoutResult {
  const maxEdgeMm = SIZE_MAX_MM[opts.size];
  const gapMm = Math.max(0, opts.gapMm);
  const { widthMm: pageW, heightMm: pageH } = PAGE_DIMENSIONS[opts.format];

  const pages =
    opts.mode === "dense"
      ? packDense(stickers, maxEdgeMm, gapMm, pageW, pageH, opts.shrinkNonSquare)
      : packUniform(stickers, maxEdgeMm, gapMm, pageW, pageH, opts.shrinkNonSquare);

  return {
    pages,
    format: opts.format,
    pageWidthMm: pageW,
    pageHeightMm: pageH,
    cellHeightMm: maxEdgeMm,
    gapMm,
  };
}

/* ---------- uniform: simple greedy row grid ---------- */

function packUniform(
  stickers: Sticker[],
  maxEdgeMm: number,
  gapMm: number,
  pageW: number,
  pageH: number,
  shrinkNonSquare: boolean,
): Page[] {
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  const pages: Page[] = [];
  let current: Page | null = null;
  let rowY = PAGE_MARGIN_MM;
  let rowX = PAGE_MARGIN_MM;
  let rowMaxBottom = rowY;

  const startNewPage = () => {
    current = { index: pages.length + 1, stickers: [] };
    pages.push(current);
    rowY = PAGE_MARGIN_MM;
    rowX = PAGE_MARGIN_MM;
    rowMaxBottom = rowY;
  };

  startNewPage();

  for (const sticker of stickers) {
    const edge = maxEdgeFor(
      sticker.width,
      sticker.height,
      maxEdgeMm,
      shrinkNonSquare,
    );
    let { w, h } = fitToBox(sticker.width, sticker.height, edge);
    if (w > usableW) {
      // Defensive clamp; with size presets ≤ 50mm and A5 width 148mm this
      // should never trip, but very small page formats could in future.
      const scale = usableW / w;
      w *= scale;
      h *= scale;
    }

    if (rowX !== PAGE_MARGIN_MM && rowX + w > PAGE_MARGIN_MM + usableW) {
      rowX = PAGE_MARGIN_MM;
      rowY = rowMaxBottom + gapMm;
    }
    if (rowY + h > PAGE_MARGIN_MM + usableH) startNewPage();

    current!.stickers.push({ sticker, x: rowX, y: rowY, width: w, height: h });
    rowX += w + gapMm;
    rowMaxBottom = Math.max(rowMaxBottom, rowY + h);
  }

  if (pages.length > 1 && pages[pages.length - 1].stickers.length === 0) {
    pages.pop();
  }
  return pages;
}

/* ---------- dense: MaxRects (maximal free rectangles) packer ---------- */

type Sized = {
  sticker: Sticker;
  w: number;
  h: number;
};

/**
 * An axis-aligned rectangle. Used both for free space tracking and for
 * representing newly placed items during free-rect maintenance.
 */
type Rect = { x: number; y: number; w: number; h: number };

const EPS = 0.0001;

function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    outer.x <= inner.x + EPS &&
    outer.y <= inner.y + EPS &&
    outer.x + outer.w >= inner.x + inner.w - EPS &&
    outer.y + outer.h >= inner.y + inner.h - EPS
  );
}

/**
 * If `used` overlaps `free`, split `free` into up to 4 axis-aligned sub-
 * rectangles (above / below / left of / right of the used rect). If there's
 * no overlap, return `free` unchanged.
 */
function splitFreeRect(free: Rect, used: Rect): Rect[] {
  if (
    used.x >= free.x + free.w - EPS ||
    used.x + used.w <= free.x + EPS ||
    used.y >= free.y + free.h - EPS ||
    used.y + used.h <= free.y + EPS
  ) {
    return [free];
  }
  const out: Rect[] = [];
  if (used.y > free.y + EPS) {
    out.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y });
  }
  if (used.y + used.h < free.y + free.h - EPS) {
    out.push({
      x: free.x,
      y: used.y + used.h,
      w: free.w,
      h: free.y + free.h - (used.y + used.h),
    });
  }
  if (used.x > free.x + EPS) {
    out.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h });
  }
  if (used.x + used.w < free.x + free.w - EPS) {
    out.push({
      x: used.x + used.w,
      y: free.y,
      w: free.x + free.w - (used.x + used.w),
      h: free.h,
    });
  }
  return out;
}

/** Drop free rects that are fully contained inside another free rect. */
function pruneFreeRects(rects: Rect[]): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < rects.length; i++) {
    let contained = false;
    for (let j = 0; j < rects.length; j++) {
      if (i === j) continue;
      if (rectContains(rects[j], rects[i])) {
        contained = true;
        break;
      }
    }
    if (!contained) out.push(rects[i]);
  }
  return out;
}

type FitResult = { freeIdx: number; pos: { x: number; y: number }; score: number };

/**
 * Best-Short-Side-Fit: for each free rect that can host (w, h), score it by
 * the shorter of the two leftover dimensions. Smallest score wins — the
 * standard recommendation for MaxRects packing density.
 */
function findBestFit(freeRects: Rect[], w: number, h: number): FitResult | null {
  let best: FitResult | null = null;
  for (let i = 0; i < freeRects.length; i++) {
    const r = freeRects[i];
    if (r.w + EPS < w || r.h + EPS < h) continue;
    const score = Math.min(r.w - w, r.h - h);
    if (best === null || score < best.score - EPS) {
      best = { freeIdx: i, pos: { x: r.x, y: r.y }, score };
    }
  }
  return best;
}

function packDense(
  stickers: Sticker[],
  maxEdgeMm: number,
  gapMm: number,
  pageW: number,
  pageH: number,
  shrinkNonSquare: boolean,
): Page[] {
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  const sized: Sized[] = stickers.map((sticker) => {
    const edge = maxEdgeFor(
      sticker.width,
      sticker.height,
      maxEdgeMm,
      shrinkNonSquare,
    );
    let { w, h } = fitToBox(sticker.width, sticker.height, edge);
    if (w > usableW) {
      const scale = usableW / w;
      w *= scale;
      h *= scale;
    }
    return { sticker, w, h };
  });

  const pages: Page[] = [];
  let current: Page = { index: 1, stickers: [] };
  pages.push(current);
  let freeRects: Rect[] = [{ x: 0, y: 0, w: usableW, h: usableH }];

  const newPage = () => {
    current = { index: pages.length + 1, stickers: [] };
    pages.push(current);
    freeRects = [{ x: 0, y: 0, w: usableW, h: usableH }];
  };

  const consumeFreeRect = (used: Rect) => {
    const next: Rect[] = [];
    for (const f of freeRects) {
      for (const piece of splitFreeRect(f, used)) {
        next.push(piece);
      }
    }
    freeRects = pruneFreeRects(next);
  };

  const remaining = sized.slice();

  // Best-fit dynamic packing over MaxRects. At each step we scan every
  // remaining item against every free rectangle (including "pockets"
  // surrounded by placed stickers) and place the best (item, rect) pair.
  // This pulls smaller stickers forward into existing gaps instead of
  // pushing them to the next page.
  while (remaining.length > 0) {
    let bestItemIdx = -1;
    let bestFit: FitResult | null = null;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      // Reserve the cutting gap on the right and bottom side of each item
      // by inflating the placement footprint. The visible sticker stays
      // the original (item.w × item.h).
      const effW = Math.min(item.w + gapMm, usableW);
      const effH = Math.min(item.h + gapMm, usableH);
      const fit = findBestFit(freeRects, effW, effH);
      if (!fit) continue;
      if (
        bestFit === null ||
        fit.score < bestFit.score - EPS ||
        (Math.abs(fit.score - bestFit.score) < EPS &&
          item.h > remaining[bestItemIdx].h + EPS)
      ) {
        bestItemIdx = i;
        bestFit = fit;
      }
    }

    if (bestItemIdx < 0 || bestFit === null) {
      // Nothing fits on this page.
      if (current.stickers.length === 0) {
        // The next item is bigger than a whole page even after sizing —
        // hard-place it full-bleed so we don't infinite-loop.
        const item = remaining.shift()!;
        const w = Math.min(item.w, usableW);
        const h = Math.min(item.h, usableH);
        current.stickers.push({
          sticker: item.sticker,
          x: PAGE_MARGIN_MM,
          y: PAGE_MARGIN_MM,
          width: w,
          height: h,
        });
        consumeFreeRect({
          x: 0,
          y: 0,
          w: Math.min(w + gapMm, usableW),
          h: Math.min(h + gapMm, usableH),
        });
        continue;
      }
      newPage();
      continue;
    }

    const item = remaining.splice(bestItemIdx, 1)[0];
    current.stickers.push({
      sticker: item.sticker,
      x: PAGE_MARGIN_MM + bestFit.pos.x,
      y: PAGE_MARGIN_MM + bestFit.pos.y,
      width: item.w,
      height: item.h,
    });
    consumeFreeRect({
      x: bestFit.pos.x,
      y: bestFit.pos.y,
      w: Math.min(item.w + gapMm, usableW - bestFit.pos.x),
      h: Math.min(item.h + gapMm, usableH - bestFit.pos.y),
    });
  }

  if (pages.length > 1 && pages[pages.length - 1].stickers.length === 0) {
    pages.pop();
  }
  return pages;
}
