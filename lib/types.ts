export type StickerSize = "small" | "medium" | "large";

export type LayoutMode = "uniform" | "dense";

export type PageFormat = "a4" | "a5";

export type PageDimensions = {
  widthMm: number;
  heightMm: number;
};

/** Portrait dimensions for each supported page format. */
export const PAGE_DIMENSIONS: Record<PageFormat, PageDimensions> = {
  a4: { widthMm: 210, heightMm: 297 },
  a5: { widthMm: 148, heightMm: 210 },
};

export const PAGE_FORMAT_LABEL: Record<PageFormat, string> = {
  a4: "A4",
  a5: "A5",
};

/** Page margin used by the layout (mm). 0 = stickers run edge-to-edge. */
export const PAGE_MARGIN_MM = 0;

export type Sticker = {
  id: string;
  /** Display name (file name or "Yapıştırılan görsel N"). */
  name: string;
  /** A trimmed (and optionally bg-removed) PNG dataURL, ready to place on the page. */
  dataUrl: string;
  /** Pixel dimensions of the processed image. */
  width: number;
  height: number;
};

/** Sticker placed on a page, in millimetres. */
export type PlacedSticker = {
  sticker: Sticker;
  /** Top-left x in mm relative to the page. */
  x: number;
  /** Top-left y in mm relative to the page. */
  y: number;
  /** Width in mm (aspect ratio preserved with height). */
  width: number;
  /** Height in mm. */
  height: number;
};

export type Page = {
  /** 1-based index. */
  index: number;
  stickers: PlacedSticker[];
};

export type LayoutResult = {
  pages: Page[];
  /** Page format used for this layout. */
  format: PageFormat;
  /** Page dimensions (mm) — convenience, derived from format. */
  pageWidthMm: number;
  pageHeightMm: number;
  /** Standard sticker height used for this layout, in mm. */
  cellHeightMm: number;
  /** Cutting gap between stickers, in mm. */
  gapMm: number;
};
