/**
 * Browser-only persistence:
 *   - sticker dataURLs go into IndexedDB (large quota, async)
 *   - small UI preferences go into localStorage (sync, simple)
 *
 * Everything is per-origin. No server, no account; if the user clears site
 * data their work is gone (this is the expected trade-off).
 */

import { LayoutMode, PageFormat, Sticker, StickerSize } from "./types";

/* ---------------- IndexedDB: stickers ---------------- */

const DB_NAME = "printstickr";
const DB_VERSION = 1;
const STORE = "stickers";

type StoredSticker = Sticker & { addedAt: number };

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadStickers(): Promise<Sticker[]> {
  if (!isBrowser()) return [];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as StoredSticker[]).sort(
        (a, b) => a.addedAt - b.addedAt,
      );
      resolve(rows.map(({ addedAt: _addedAt, ...s }) => s));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addStickers(stickers: Sticker[]): Promise<void> {
  if (!isBrowser() || stickers.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const base = Date.now();
  stickers.forEach((s, i) => {
    const row: StoredSticker = { ...s, addedAt: base + i };
    store.put(row);
  });
  await txDone(tx);
}

export async function removeSticker(id: string): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

export async function clearAllStickers(): Promise<void> {
  if (!isBrowser()) return;
  const db = await openDB();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
}

/* ---------------- localStorage: preferences ---------------- */

export type Prefs = {
  format: PageFormat;
  mode: LayoutMode;
  size: StickerSize;
  gapMm: number;
  shrinkNonSquare: boolean;
};

const PREFS_KEY = "printstickr.prefs.v1";

export const DEFAULT_PREFS: Prefs = {
  format: "a4",
  mode: "uniform",
  size: "medium",
  gapMm: 1,
  shrinkNonSquare: false,
};

export function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      format: parsed.format === "a5" ? "a5" : "a4",
      mode: parsed.mode === "dense" ? "dense" : "uniform",
      size:
        parsed.size === "small" || parsed.size === "large"
          ? parsed.size
          : "medium",
      gapMm:
        typeof parsed.gapMm === "number" &&
        parsed.gapMm >= 0 &&
        parsed.gapMm <= 8
          ? Math.round(parsed.gapMm)
          : DEFAULT_PREFS.gapMm,
      shrinkNonSquare:
        typeof parsed.shrinkNonSquare === "boolean"
          ? parsed.shrinkNonSquare
          : DEFAULT_PREFS.shrinkNonSquare,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function savePrefs(prefs: Prefs): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // quota or privacy mode — silently ignore; prefs are non-critical
  }
}
