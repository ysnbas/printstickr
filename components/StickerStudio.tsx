"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ControlsPanel from "./ControlsPanel";
import PagePreview from "./PagePreview";
import StickerList from "./StickerList";
import Uploader from "./Uploader";

import { exportPdf, exportPng } from "@/lib/export";
import { blobToDataUrl, fileToDataUrl } from "@/lib/image";
import { layoutStickers } from "@/lib/layout";
import { autoTrim } from "@/lib/trim";
import {
  LayoutMode,
  PAGE_FORMAT_LABEL,
  PageFormat,
  Sticker,
  StickerSize,
} from "@/lib/types";

function uid(): string {
  return `s_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export default function StickerStudio() {
  const [entries, setEntries] = useState<Sticker[]>([]);
  const [format, setFormat] = useState<PageFormat>("a4");
  const [mode, setMode] = useState<LayoutMode>("uniform");
  const [size, setSize] = useState<StickerSize>("medium");
  const [gapMm, setGapMm] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pasteCounterRef = useRef(1);

  const addFromDataUrls = useCallback(
    async (items: Array<{ name: string; dataUrl: string }>) => {
      if (items.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const processed: Sticker[] = [];
        for (const item of items) {
          const out = await autoTrim(item.dataUrl);
          processed.push({
            id: uid(),
            name: item.name,
            dataUrl: out.dataUrl,
            width: out.width,
            height: out.height,
          });
        }
        setEntries((prev) => [...prev, ...processed]);
      } catch (e) {
        console.error(e);
        setError("Görsel işlenirken bir hata oluştu.");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const onFiles = useCallback(
    async (files: File[]) => {
      const items = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          dataUrl: await fileToDataUrl(f),
        })),
      );
      await addFromDataUrls(items);
    },
    [addFromDataUrls],
  );

  // Clipboard paste anywhere on the page.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const blobs: Blob[] = [];
      for (const it of Array.from(items)) {
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const blob = it.getAsFile();
          if (blob) blobs.push(blob);
        }
      }
      if (blobs.length === 0) return;
      e.preventDefault();
      const dataItems = await Promise.all(
        blobs.map(async (b) => ({
          name: `Yapıştırılan görsel ${pasteCounterRef.current++}`,
          dataUrl: await blobToDataUrl(b),
        })),
      );
      await addFromDataUrls(dataItems);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addFromDataUrls]);

  const onRemove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const onClearAll = useCallback(() => {
    setEntries([]);
  }, []);

  const layout = useMemo(
    () => layoutStickers(entries, { size, gapMm, format, mode }),
    [entries, size, gapMm, format, mode],
  );

  const canExport = entries.length > 0 && !busy;

  const onExportPdf = async () => {
    setBusy(true);
    try {
      await exportPdf(layout);
    } catch (e) {
      console.error(e);
      setError("PDF oluşturulurken hata oluştu.");
    } finally {
      setBusy(false);
    }
  };

  const onExportPng = async () => {
    setBusy(true);
    try {
      await exportPng(layout);
    } catch (e) {
      console.error(e);
      setError("PNG oluşturulurken hata oluştu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
      <aside className="flex w-full flex-col gap-4 lg:w-[360px]">
        <Uploader onFiles={onFiles} disabled={busy} />
        <ControlsPanel
          format={format}
          onFormatChange={setFormat}
          mode={mode}
          onModeChange={setMode}
          size={size}
          onSizeChange={setSize}
          gapMm={gapMm}
          onGapChange={setGapMm}
        />
        <StickerList
          stickers={entries}
          onRemove={onRemove}
          onClearAll={onClearAll}
        />
      </aside>

      <section className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
          <div className="text-sm text-stone-600">
            {entries.length === 0 ? (
              <>Önizleme: {PAGE_FORMAT_LABEL[format]} sayfası boş.</>
            ) : (
              <>
                <span className="font-medium text-stone-800">
                  {entries.length}
                </span>{" "}
                sticker · {layout.pages.length} {PAGE_FORMAT_LABEL[format]} sayfa
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onExportPng}
              disabled={!canExport}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              PNG İndir
            </button>
            <button
              type="button"
              onClick={onExportPdf}
              disabled={!canExport}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              PDF İndir
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {busy && (
          <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">
            İşleniyor…
          </div>
        )}

        <PagePreview layout={layout} />
      </section>
    </div>
  );
}
