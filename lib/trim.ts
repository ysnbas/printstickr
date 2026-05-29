import { drawToCanvas, loadImage } from "./image";

/** Anything below this alpha is treated as transparent (= background). */
const ALPHA_THRESHOLD = 8;
/**
 * Per-channel euclidean distance tolerance for "looks like the corner-sampled
 * background colour". 28 is forgiving enough for noisy JPEG corners while
 * still catching tight, almost-uniform pastel backgrounds.
 */
const BG_TOLERANCE = 28;
/** Small padding around the detected bbox so we don't shave anti-aliased edges. */
const PAD_PX = 1;

export type TrimResult = {
  dataUrl: string;
  width: number;
  height: number;
};

type Rgb = { r: number; g: number; b: number };

/**
 * Sample the four corners (3 px inset to dodge border artefacts) and average
 * the colours. Returns null if every corner is transparent — in that case
 * the image is already a cut-out and we only trim by alpha.
 */
function sampleCornerColour(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): Rgb | null {
  const ix = Math.min(3, w - 1);
  const iy = Math.min(3, h - 1);
  const points: Array<[number, number]> = [
    [ix, iy],
    [w - 1 - ix, iy],
    [ix, h - 1 - iy],
    [w - 1 - ix, h - 1 - iy],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [x, y] of points) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < ALPHA_THRESHOLD) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (n === 0) return null;
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Auto-trim an image around its non-background content. Background is whatever
 * colour the corners look like — works on white, pink, grey, etc. flat
 * backgrounds. Falls back to alpha-only trimming if every corner is transparent.
 *
 * Pure: takes a source dataURL, returns a new dataURL. No DOM mutation outside
 * a throwaway offscreen canvas.
 */
export async function autoTrim(
  sourceDataUrl: string,
  maxSide = 2000,
): Promise<TrimResult> {
  const img = await loadImage(sourceDataUrl);
  const { canvas, ctx } = drawToCanvas(img, maxSide);
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);

  const bg = sampleCornerColour(data, width, height);
  // Threshold compared against squared euclidean distance across 3 channels.
  const t2 = BG_TOLERANCE * BG_TOLERANCE * 3;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3];
      if (a < ALPHA_THRESHOLD) continue;
      if (bg) {
        const dr = data[i] - bg.r;
        const dg = data[i + 1] - bg.g;
        const db = data[i + 2] - bg.b;
        if (dr * dr + dg * dg + db * db <= t2) continue;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // No content found — return the input as-is.
  if (maxX < 0 || maxY < 0) {
    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  }

  const x0 = Math.max(0, minX - PAD_PX);
  const y0 = Math.max(0, minY - PAD_PX);
  const x1 = Math.min(width - 1, maxX + PAD_PX);
  const y1 = Math.min(height - 1, maxY + PAD_PX);
  const tw = x1 - x0 + 1;
  const th = y1 - y0 + 1;

  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("2D context unavailable");
  octx.drawImage(canvas, x0, y0, tw, th, 0, 0, tw, th);

  return { dataUrl: out.toDataURL("image/png"), width: tw, height: th };
}
