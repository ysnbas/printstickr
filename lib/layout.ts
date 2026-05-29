import {
  LayoutMode,
  LayoutResult,
  PAGE_DIMENSIONS,
  PAGE_MARGIN_MM,
  Page,
  PageFormat,
  PlacedSticker,
  Sticker,
  StickerSize,
} from "./types";

/**
 * Standard sticker heights (mm) per size preset. Width follows from each
 * sticker's aspect ratio.
 *
 * In `uniform` mode every sticker uses this height; in `dense` mode this is
 * the *base* height that gets multiplied per-sticker for visual variety.
 */
const SIZE_HEIGHT_MM: Record<StickerSize, number> = {
  small: 22,
  medium: 30,
  large: 42,
};

/**
 * Per-sticker height multipliers used by the dense packer. Kept tight
 * (≈ ±15 %) so a sheet feels uniformly sized rather than chaotic, while
 * still giving the skyline packer enough variation to fill row-end gaps.
 */
const DENSE_MULTIPLIERS = [0.85, 1.0, 1.15];

export function heightForSize(size: StickerSize): number {
  return SIZE_HEIGHT_MM[size];
}

export type LayoutOptions = {
  size: StickerSize;
  /** Cutting gap between adjacent stickers, in millimetres. */
  gapMm: number;
  format: PageFormat;
  /**
   * `uniform` — every sticker at one height, simple row grid (default).
   * `dense`   — varied per-sticker height + skyline bin-packing to fill gaps.
   */
  mode: LayoutMode;
};

export function layoutStickers(
  stickers: Sticker[],
  opts: LayoutOptions,
): LayoutResult {
  const cellHeightMm = SIZE_HEIGHT_MM[opts.size];
  const gapMm = Math.max(0, opts.gapMm);
  const { widthMm: pageW, heightMm: pageH } = PAGE_DIMENSIONS[opts.format];

  const pages =
    opts.mode === "dense"
      ? packDense(stickers, cellHeightMm, gapMm, pageW, pageH)
      : packUniform(stickers, cellHeightMm, gapMm, pageW, pageH);

  return {
    pages,
    format: opts.format,
    pageWidthMm: pageW,
    pageHeightMm: pageH,
    cellHeightMm,
    gapMm,
  };
}

/* ---------- uniform: simple greedy row grid ---------- */

function packUniform(
  stickers: Sticker[],
  cellHeightMm: number,
  gapMm: number,
  pageW: number,
  pageH: number,
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
    const aspect = sticker.width / sticker.height;
    let w = cellHeightMm * aspect;
    const h = cellHeightMm;
    if (w > usableW) w = usableW;

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

/* ---------- dense: varied size + skyline bottom-left packer ---------- */

/** Deterministic 0..1 hash of an id so the layout is stable across renders. */
function hash01(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

type Sized = {
  sticker: Sticker;
  w: number;
  h: number;
};

/**
 * One skyline segment along the top edge of the placed content. The packer
 * keeps these sorted by `x` and contiguous (cover the full page width).
 */
type Seg = { x: number; width: number; top: number };

function packDense(
  stickers: Sticker[],
  baseHeightMm: number,
  gapMm: number,
  pageW: number,
  pageH: number,
): Page[] {
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  // Assign each sticker a target size (slightly varied so the skyline packer
  // can fill row-end gaps). We deliberately keep the user's input order — a
  // height-descending sort packs tighter but causes a visible top-to-bottom
  // "shrinking" gradient that reads as broken.
  const sized: Sized[] = stickers.map((sticker) => {
    const r = hash01(sticker.id);
    const mult =
      DENSE_MULTIPLIERS[Math.min(
        Math.floor(r * DENSE_MULTIPLIERS.length),
        DENSE_MULTIPLIERS.length - 1,
      )];
    const h = baseHeightMm * mult;
    const w = h * (sticker.width / sticker.height);
    return { sticker, w: Math.min(w, usableW), h };
  });

  const pages: Page[] = [];
  let current: Page = { index: 1, stickers: [] };
  pages.push(current);
  let skyline: Seg[] = [{ x: 0, width: usableW, top: 0 }];

  const newPage = () => {
    current = { index: pages.length + 1, stickers: [] };
    pages.push(current);
    skyline = [{ x: 0, width: usableW, top: 0 }];
  };

  for (const item of sized) {
    let placed = tryPlace(skyline, item, usableW, usableH, gapMm);
    if (!placed) {
      newPage();
      placed = tryPlace(skyline, item, usableW, usableH, gapMm);
    }
    if (!placed) {
      // Item bigger than a whole page even after sizing — degrade to a full-page
      // placement to avoid losing the sticker.
      newPage();
      const w = Math.min(item.w, usableW);
      const h = Math.min(item.h, usableH);
      current.stickers.push({
        sticker: item.sticker,
        x: PAGE_MARGIN_MM,
        y: PAGE_MARGIN_MM,
        width: w,
        height: h,
      });
      skyline = updateSkyline(skyline, 0, w, h + gapMm);
      continue;
    }
    current.stickers.push({
      sticker: item.sticker,
      x: PAGE_MARGIN_MM + placed.x,
      y: PAGE_MARGIN_MM + placed.top,
      width: item.w,
      height: item.h,
    });
    skyline = updateSkyline(
      skyline,
      placed.x,
      Math.min(item.w + gapMm, usableW - placed.x),
      placed.top + item.h + gapMm,
    );
  }

  if (pages.length > 1 && pages[pages.length - 1].stickers.length === 0) {
    pages.pop();
  }
  return pages;
}

/**
 * Find the bottom-left position where `item` fits on the skyline without
 * exceeding `usableH`. Returns null if nothing fits.
 */
function tryPlace(
  skyline: Seg[],
  item: Sized,
  usableW: number,
  usableH: number,
  gapMm: number,
): { x: number; top: number } | null {
  const reqW = Math.min(item.w + gapMm, usableW); // require gap on the right too
  let best: { x: number; top: number } | null = null;

  for (let i = 0; i < skyline.length; i++) {
    const startX = skyline[i].x;
    if (startX + reqW > usableW + 0.0001) continue;

    // Max top across all segments that the item would sit on.
    const endX = startX + reqW;
    let top = 0;
    for (let j = i; j < skyline.length && skyline[j].x < endX; j++) {
      top = Math.max(top, skyline[j].top);
    }
    if (top + item.h > usableH + 0.0001) continue;

    if (!best || top < best.top - 0.0001 || (Math.abs(top - best.top) < 0.0001 && startX < best.x)) {
      best = { x: startX, top };
    }
  }
  return best;
}

/**
 * Replace the skyline section under [x, x+width] with a new segment at
 * `newTop`, merging adjacent segments that share a top.
 */
function updateSkyline(skyline: Seg[], x: number, width: number, newTop: number): Seg[] {
  const endX = x + width;
  const next: Seg[] = [];

  for (const seg of skyline) {
    const segEnd = seg.x + seg.width;
    if (segEnd <= x || seg.x >= endX) {
      next.push(seg);
      continue;
    }
    if (seg.x < x) {
      next.push({ x: seg.x, width: x - seg.x, top: seg.top });
    }
    if (segEnd > endX) {
      next.push({ x: endX, width: segEnd - endX, top: seg.top });
    }
  }
  next.push({ x, width, top: newTop });
  next.sort((a, b) => a.x - b.x);

  // Merge adjacent segments that share a top.
  const merged: Seg[] = [];
  for (const s of next) {
    const last = merged[merged.length - 1];
    if (
      last &&
      Math.abs(last.top - s.top) < 0.0001 &&
      Math.abs(last.x + last.width - s.x) < 0.0001
    ) {
      last.width += s.width;
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}
