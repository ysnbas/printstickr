"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
};

export default function Uploader({ onFiles, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list) return;
      const files = Array.from(list).filter((f) => f.type.startsWith("image/"));
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
        dragOver
          ? "border-accent bg-accent-soft/40"
          : "border-stone-300 bg-white hover:border-stone-400"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="text-3xl">🖼️</div>
      <div>
        <p className="text-sm font-medium text-stone-800">
          Görselleri buraya sürükle
        </p>
        <p className="text-xs text-stone-500">
          ya da{" "}
          <button
            type="button"
            className="text-accent underline underline-offset-2 hover:text-orange-600 disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            dosya seç
          </button>{" "}
          · veya <kbd className="rounded border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] font-medium">Ctrl/⌘ + V</kbd> ile yapıştır
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
