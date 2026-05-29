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

export type LayoutOptions = {
  size: StickerSize;
  /** Cutting gap between adjacent stickers, in millimetres. */
  gapMm: number;
  format: PageFormat;
  /**
   * `uniform` — items fit inside the size box, simple row grid (default).
   * `dense`   — varied per-sticker size + skyline bin-packing to fill gaps.
   */
  mode: LayoutMode;
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

export function layoutStickers(
  stickers: Sticker[],
  opts: LayoutOptions,
): LayoutResult {
  const maxEdgeMm = SIZE_MAX_MM[opts.size];
  const gapMm = Math.max(0, opts.gapMm);
  const { widthMm: pageW, heightMm: pageH } = PAGE_DIMENSIONS[opts.format];

  const pages =
    opts.mode === "dense"
      ? packDense(stickers, maxEdgeMm, gapMm, pageW, pageH)
      : packUniform(stickers, maxEdgeMm, gapMm, pageW, pageH);

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
    let { w, h } = fitToBox(sticker.width, sticker.height, maxEdgeMm);
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

/* ---------- dense: same fit-to-box + skyline bottom-left packer ---------- */

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
  maxEdgeMm: number,
  gapMm: number,
  pageW: number,
  pageH: number,
): Page[] {
  const usableW = pageW - PAGE_MARGIN_MM * 2;
  const usableH = pageH - PAGE_MARGIN_MM * 2;

  // Every sticker fits inside the same N × N box (same rule as uniform mode).
  // The gap-filling benefit of dense mode comes from natural aspect-ratio
  // variation: a landscape sticker is shorter than a square, leaving a ledge
  // the skyline packer can stack the next sticker onto. No artificial size
  // jitter — the user sees a consistent grid feel.
  const sized: Sized[] = stickers.map((sticker) => {
    let { w, h } = fitToBox(sticker.width, sticker.height, maxEdgeMm);
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

    const endX = startX + reqW;
    let top = 0;
    for (let j = i; j < skyline.length && skyline[j].x < endX; j++) {
      top = Math.max(top, skyline[j].top);
    }
    if (top + item.h > usableH + 0.0001) continue;

    if (
      !best ||
      top < best.top - 0.0001 ||
      (Math.abs(top - best.top) < 0.0001 && startX < best.x)
    ) {
      best = { x: startX, top };
    }
  }
  return best;
}

/**
 * Replace the skyline section under [x, x+width] with a new segment at
 * `newTop`, merging adjacent segments that share a top.
 */
function updateSkyline(
  skyline: Seg[],
  x: number,
  width: number,
  newTop: number,
): Seg[] {
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
