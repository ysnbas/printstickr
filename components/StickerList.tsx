"use client";

import { Sticker } from "@/lib/types";

type Props = {
  stickers: Sticker[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

export default function StickerList({ stickers, onRemove, onClearAll }: Props) {
  if (stickers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-stone-300 bg-white p-6 text-center text-sm text-stone-500">
        Henüz sticker eklenmedi.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-700">
          Sticker’lar{" "}
          <span className="text-stone-400">({stickers.length})</span>
        </h3>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-stone-500 underline underline-offset-2 hover:text-red-600"
        >
          Tümünü Temizle
        </button>
      </div>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {stickers.map((s) => (
          <li
            key={s.id}
            className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm"
          >
            {/* Local data: URLs only; safe to use img element. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.dataUrl}
              alt={s.name}
              className="h-full w-full object-contain p-1.5"
            />
            <button
              type="button"
              onClick={() => onRemove(s.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow ring-1 ring-stone-200 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
              aria-label={`${s.name} sil`}
              title="Sil"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
