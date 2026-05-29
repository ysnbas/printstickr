"use client";

import {
  LayoutMode,
  PAGE_FORMAT_LABEL,
  PageFormat,
  StickerSize,
} from "@/lib/types";

type Props = {
  format: PageFormat;
  onFormatChange: (format: PageFormat) => void;
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
  size: StickerSize;
  onSizeChange: (size: StickerSize) => void;
  gapMm: number;
  onGapChange: (mm: number) => void;
};

const SIZE_LABELS: Record<StickerSize, string> = {
  small: "Küçük",
  medium: "Orta",
  large: "Büyük",
};

const MODE_LABELS: Record<LayoutMode, string> = {
  uniform: "Düzenli",
  dense: "Yoğun",
};

const FORMATS: PageFormat[] = ["a4", "a5"];
const MODES: LayoutMode[] = ["uniform", "dense"];

export default function ControlsPanel({
  format,
  onFormatChange,
  mode,
  onModeChange,
  size,
  onSizeChange,
  gapMm,
  onGapChange,
}: Props) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-stone-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-stone-700">Ayarlar</h3>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-stone-600">
          Sayfa boyutu
        </label>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-stone-100 p-1">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onFormatChange(f)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                format === f
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {PAGE_FORMAT_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-stone-600">
          Dizilim
        </label>
        <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-stone-100 p-1">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === m
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-stone-500">
          {mode === "uniform"
            ? "Tüm sticker'lar aynı boyutta, satır satır."
            : "Sticker'lar farklı boyutlarda, aradaki boşluklar doldurulur."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-stone-600">
          Sticker boyutu
        </label>
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-stone-100 p-1">
          {(["small", "medium", "large"] as StickerSize[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSizeChange(s)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                size === s
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {SIZE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="gap"
            className="text-xs font-medium text-stone-600"
          >
            Kesim boşluğu
          </label>
          <span className="text-xs tabular-nums text-stone-500">
            {gapMm} mm
          </span>
        </div>
        <input
          id="gap"
          type="range"
          min={0}
          max={8}
          step={1}
          value={gapMm}
          onChange={(e) => onGapChange(Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </div>
    </div>
  );
}
