import { loadImage } from "./image";
import { LayoutResult, Page } from "./types";

/** 300 DPI is the standard print resolution. */
const DPI = 300;
const MM_PER_INCH = 25.4;

function mmToPx(mm: number): number {
  return (mm / MM_PER_INCH) * DPI;
}

/**
 * Render one page (A4 or A5) to a canvas at 300 DPI. Background is white so
 * the exported sheet looks the same as a real printed page.
 */
export async function renderPageToCanvas(
  page: Page,
  pageWidthMm: number,
  pageHeightMm: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mmToPx(pageWidthMm));
  canvas.height = Math.round(mmToPx(pageHeightMm));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  for (const placed of page.stickers) {
    const img = await loadImage(placed.sticker.dataUrl);
    ctx.drawImage(
      img,
      mmToPx(placed.x),
      mmToPx(placed.y),
      mmToPx(placed.width),
      mmToPx(placed.height),
    );
  }

  return canvas;
}

function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download each page as a separate PNG. Returns the number of files saved.
 */
export async function exportPng(layout: LayoutResult): Promise<number> {
  for (let i = 0; i < layout.pages.length; i++) {
    const canvas = await renderPageToCanvas(
      layout.pages[i],
      layout.pageWidthMm,
      layout.pageHeightMm,
    );
    const url = canvas.toDataURL("image/png");
    const suffix = layout.pages.length > 1 ? `-sayfa-${i + 1}` : "";
    triggerDownload(url, `printstickr-${layout.format}${suffix}.png`);
  }
  return layout.pages.length;
}

/**
 * Build a single multi-page PDF in the layout's page format. jsPDF is
 * dynamically imported so it never lands in the SSR/server bundle.
 */
export async function exportPdf(layout: LayoutResult): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({
    unit: "mm",
    format: layout.format,
    orientation: "portrait",
    compress: true,
  });

  for (let i = 0; i < layout.pages.length; i++) {
    const canvas = await renderPageToCanvas(
      layout.pages[i],
      layout.pageWidthMm,
      layout.pageHeightMm,
    );
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage(layout.format, "portrait");
    pdf.addImage(
      imgData,
      "JPEG",
      0,
      0,
      layout.pageWidthMm,
      layout.pageHeightMm,
      undefined,
      "FAST",
    );
  }

  pdf.save(`printstickr-${layout.format}.pdf`);
}
