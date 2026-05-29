# printstickr

A browser-only generator for print-ready A4/A5 sticker sheets. Upload, paste,
or drag your images → they get auto-trimmed, normalised to a standard size,
and arranged on the page with cutting gaps. Export as PDF or PNG and take it
to any print shop.

No image is ever uploaded to a server. All image processing and file
generation happens locally in the browser via the Canvas API. No AI, no paid
APIs, zero running cost.

## Features

- Multi-file upload, drag-and-drop, and clipboard paste (Ctrl/⌘ + V)
- Auto-trim — corner-sampled background colour is removed via bounding box
  (works for white, pink, grey, and other flat colours)
- Three sticker size presets (Small / Medium / Large); no manual resizing
- Two layout modes:
  - **Uniform** — every sticker at the same height, simple row grid
  - **Dense** — slightly varied per-sticker height with skyline bin-packing,
    so row-end gaps get filled
- A4 (210 × 297 mm) or A5 (148 × 210 mm) page size
- Adjustable cutting gap in millimetres (default 2 mm, range 0–8 mm)
- Automatic multi-page output when content overflows
- 300 DPI export (A4 ≈ 2480 × 3508 px, A5 ≈ 1748 × 2480 px) as PDF or PNG

## Development

```bash
yarn install
yarn dev
```

Open <http://localhost:3000> in your browser.

## Production build

```bash
yarn build
yarn start
```

The `/` route is fully prerendered as a static page, so any static or edge
host (Vercel, Cloudflare Pages, Netlify, plain S3, …) works.

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push the repo to GitHub and import it from the Vercel dashboard — the
defaults (Framework: Next.js) are all you need.

## Architecture

- `app/` — Next.js App Router. `page.tsx` is a server component shell that
  mounts the client component `StickerStudio`.
- `components/` — `Uploader`, `StickerList`, `ControlsPanel`,
  `PagePreview`, `StickerStudio` (state owner). All `"use client"`.
- `lib/` — pure functions, UI-agnostic:
  - `image.ts` — canvas helpers (`loadImage`, `fileToDataUrl`, …)
  - `trim.ts` — `autoTrim`: corner-sampled, background-aware bounding-box crop
  - `layout.ts` — `layoutStickers`: uniform row grid and dense skyline bin-packer
  - `export.ts` — `exportPng`, `exportPdf` (jsPDF loaded via dynamic import)
  - `types.ts` — shared types and page/format constants (mm)

`jspdf` is loaded only at export time via `await import("jspdf")`, so SSR
never touches `window`.

## Limitations (important)

- **Auto-trim only works well on flat / single-colour backgrounds.** The
  algorithm samples the four corners and treats colours close to that
  background as croppable. On gradients, textures, or photographic
  backgrounds the trim mostly leaves the image untouched (safe fallback).
- For performance every input image is downsampled to at most 2000 px on
  its longest side before processing; the final sheet is still rendered at
  300 DPI.
- Adding many very large (e.g. 4K+) images at once can strain browser memory.
