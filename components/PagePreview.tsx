"use client";

import { LayoutResult, PAGE_FORMAT_LABEL } from "@/lib/types";

type Props = {
  layout: LayoutResult;
};

/**
 * Shows the page(s) at their true proportions using CSS percentages
 * relative to mm. The preview's actual pixel size is fluid; positions stay
 * accurate because everything is expressed as a % of the page in mm.
 */
export default function PagePreview({ layout }: Props) {
  const hasContent = layout.pages.some((p) => p.stickers.length > 0);
  const { pageWidthMm, pageHeightMm, format } = layout;

  return (
    <div className="flex flex-col gap-4">
      {layout.pages.map((page) => (
        <div key={page.index} className="flex flex-col items-center gap-2">
          <div className="text-xs text-stone-500">
            Sayfa {page.index} / {layout.pages.length} · {PAGE_FORMAT_LABEL[format]}
          </div>
          <div
            className="bg-page-checker relative w-full max-w-[520px] overflow-hidden rounded-md border border-stone-300 bg-white shadow-md"
            style={{ aspectRatio: `${pageWidthMm} / ${pageHeightMm}` }}
          >
            <div className="absolute inset-0 bg-white" />
            {page.stickers.map((p, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${p.sticker.id}-${idx}`}
                src={p.sticker.dataUrl}
                alt={p.sticker.name}
                className="absolute object-contain"
                style={{
                  left: `${(p.x / pageWidthMm) * 100}%`,
                  top: `${(p.y / pageHeightMm) * 100}%`,
                  width: `${(p.width / pageWidthMm) * 100}%`,
                  height: `${(p.height / pageHeightMm) * 100}%`,
                }}
              />
            ))}
            {!hasContent && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-stone-400">
                Sticker eklendikçe burada görünecek
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
