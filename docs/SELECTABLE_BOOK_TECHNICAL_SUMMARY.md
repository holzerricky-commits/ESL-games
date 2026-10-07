# Selectable Text for Static Picture Book Scans — Technical Summary & Post-Mortem

## Executive Summary

Picture-only unit PDFs (scanned textbook pages with no embedded text) are made selectable by **OCR → invisible PDF text stamping → app-owned selection overlay in the reader**. The original scan is never modified. A sidecar copy under `.searchable/` gets word-level invisible text drawn with `pdf-lib`. At read time, `/api/book-file` transparently serves the sidecar when it exists. Selection uses **geometry from `getTextContent()`** drawn as blue highlights on the scan at z-45 (above spread ink), with copy via clipboard — not native PDF.js DOM text layers.

**Current phase:** Phase 1 is shipped (invisible selection that looks like the real book). Phases 2–4 (better OCR placement, vocab prep everywhere, tap spots) are planned or partial.

---

## 1. What Was Done

### 1.1 End-to-End Workflow

```
Teacher prep (Stories / Workshop)
  └─ Confirm story page range
  └─ Click "Make pages selectable"
       └─ POST /api/books/searchable-text { action: "plan" }
            └─ For each page: skip if original has text, skip if sidecar already stamped, else queue OCR
       └─ For each page needing OCR:
            POST /api/books/searchable-text { action: "page", pdfPage: N }
              └─ Copy original → book-library/<unit>/.searchable/<unit>.pdf (if needed)
              └─ Rasterize page to PNG (~1800px wide)
              └─ Tesseract.js word recognition
              └─ Map each word box → PDF coordinates
              └─ drawText(..., opacity: 0) onto sidecar page
              └─ Save sidecar PDF
       └─ Browser event: esl:searchable-pdf-updated
            └─ Reader reloads PDF + invalidates text probes

Class (fullscreen reader)
  └─ Select tool (V) active, no whiteboard / focus-draw / exercise-draw
  └─ Probe visible pages for ≥30 chars of extractable PDF text
  └─ BookPdfTextSelectLayer (z-45) loads word geometry via getTextContent()
  └─ Teacher drags to select → blue highlight on scan → Ctrl+C / copy
```

### 1.2 Core Architecture

| Layer | Role |
|-------|------|
| **Sidecar PDF** (`.searchable/unit.pdf`) | Persistent store of invisible text; original scan untouched |
| **Server OCR pipeline** | Rasterize → Tesseract → coordinate map → `pdf-lib` stamp |
| **Book file API** | Serves sidecar automatically when present |
| **pdf-page-text-geometry.ts** | Normalized word boxes from PDF.js `getTextContent()` |
| **BookPdfTextSelectLayer** (z-45) | Drag-select, blue highlights, copy; pass-through on empty areas |
| **Prefetch cache** | Sharp bitmap for page art; PDF text layer not rendered in reader |

**Design choice:** Stamp real PDF text rather than maintain a parallel HTML/SVG overlay. Alignment at all zoom levels is delegated to PDF.js, which already knows how to place text spans from PDF content streams.

### 1.3 Files Created or Modified

#### Server / build pipeline

| File | Purpose |
|------|---------|
| `lib/books/searchable-pdf-build.ts` | Plan pages, OCR one page, stamp sidecar (serialized writes) |
| `lib/books/searchable-pdf-ocr.ts` | Tesseract.js worker, word bbox extraction, confidence filter |
| `lib/books/searchable-pdf-text-layer.ts` | OCR box → PDF `drawText` placement math |
| `lib/books/searchable-pdf-types.ts` | Plan item types (`ocr` / `skip-has-text` / `skip-done`) |
| `lib/books/searchable-pdf-path.ts` | `.searchable/` sidecar path helpers |
| `lib/books/searchable-pdf-client.ts` | Client job runner (plan + per-page loop) |
| `lib/books/searchable-pdf-manager.ts` | Job state, toasts, subscribe API |
| `lib/books/use-searchable-pdf-job.ts` | React hook for prep UI |
| `lib/books/searchable-pdf-events.ts` | `esl:searchable-pdf-updated` browser event |
| `app/api/books/searchable-text/route.ts` | `plan` and `page` actions |
| `app/api/book-file/route.ts` | Prefer sidecar over original when serving PDFs |
| `lib/books/generate-book-cover-server.ts` | `renderPdfPageToPngBuffer` for OCR input |
| `lib/books/extract-story-pdf-text.ts` | Server pdf.js probe: "does this page already have text?" |
| `lib/books/pdf-page-text-probe.ts` | Client probe + 30-char threshold + LRU cache |
| `lib/books/server.ts` | Hides `.searchable` from library auto-discovery |

#### Reader / selection UX

| File | Purpose |
|------|---------|
| `components/students/fullscreen-book-overlay/sections/ReaderPageSlot.tsx` | `renderTextLayer={false}`; cache + live PDF canvas only |
| `components/students/fullscreen-book-overlay/sections/BookCanvasStage.tsx` | Select-tool gating, PDF reload on sidecar update, mounts text select layer |
| `components/students/fullscreen-book-overlay/sections/BookPdfTextSelectLayer.tsx` | Spread overlay: drag select, highlights, copy |
| `components/students/fullscreen-book-overlay/hooks/usePdfPageTextGeometry.ts` | Load/cache geometry per page |
| `lib/books/pdf-page-text-geometry.ts` | Hit-test, range select, plain text from runs |
| `components/students/fullscreen-book-overlay/hooks/usePdfPageTextCapability.ts` | Per-page "has selectable text?" state |
| `lib/books/reader-page-display.ts` | Sharp cache vs live-PDF layer visibility |
| `lib/books/feature-flags.ts` | `bookPdfTextSelectionEnabled`, `interactiveVocabPageHighlightsEnabled` |

#### Prep UI entry points

| File | Purpose |
|------|---------|
| `components/books/story-text-fuel-panel.tsx` | "Make pages selectable" button |
| `components/books/books-workshop-story-tools.tsx` | Workshop wiring |
| `components/books/tabs/book-stories-tab.tsx` | Stories tab wiring |
| `components/books/book-part-story-text-prep.tsx` | Part-level prep |
| `components/books/reading-check-prep-panel.tsx` | Reading-check prep wiring |

#### Tests

| File | Covers |
|------|--------|
| `lib/books/searchable-pdf-text-layer.test.ts` | Y-flip, font sizing, WinAnsi sanitization |
| `lib/books/searchable-pdf-path.test.ts` | Sidecar path resolution |
| `lib/books/pdf-page-text-geometry.test.ts` | Geometry extraction, hit-test, range selection |
| `lib/books/reader-page-display.test.ts` | Cache + PDF layer visibility rules |

#### Related (Phase 4, currently off)

| File | Purpose |
|------|---------|
| `lib/books/interactive-vocab-text-hits.ts` | Match vocab words to PDF spans → normalized boxes |
| `components/students/fullscreen-book-overlay/sections/InteractiveVocabHighlightLayer.tsx` | Semi-transparent tap/highlight overlays (disabled) |

#### Planning doc

| File | Purpose |
|------|---------|
| `docs/SELECTABLE_BOOK_PHASED_PLAN.md` | Phased rollout checklist |

---

## 2. How the Problem Was Solved

### 2.1 Detecting Whether a Page Needs OCR

**Server (`planSearchablePdfPages`):**

1. Open original PDF with pdf.js.
2. For each page in the story range, call `getTextContent()`.
3. If joined text ≥ **30 characters** (`PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS`), mark `skip-has-text`.
4. Else if sidecar exists and same page already has ≥30 chars, mark `skip-done`.
5. Else mark `ocr`.

**Client (reader):** `usePdfPageTextCapability` probes the **loaded** document (which is already the sidecar via `/api/book-file`) and sets per-page `true | false | 'pending'`.

### 2.2 OCR and Coordinate Extraction

Per page stamped:

1. **Rasterize** original PDF page to PNG at `OCR_RENDER_WIDTH = 1800` (~200 DPI on a typical page) via pdf.js + `@napi-rs/canvas`.
2. **Tesseract.js** (`eng`, OEM 1) returns word-level bounding boxes in **image pixel space**, origin **top-left**, Y down.
3. **Filter words:** non-empty text, confidence ≥ **40** (`OCR_MIN_CONFIDENCE`), valid finite bbox.

### 2.3 Mapping OCR Boxes to PDF Text Placement

`mapOcrWordToPdfText` in `searchable-pdf-text-layer.ts`:

```
scaleX = pageWidth  / imageWidth
scaleY = pageHeight / imageHeight

x          = word.x0 * scaleX
boxWidth   = (word.x1 - word.x0) * scaleX
boxHeight  = (word.y1 - word.y0) * scaleY
pdfBoxBottom = pageHeight - word.y1 * scaleY   // Y-flip to PDF bottom-left origin

sizeFromHeight = boxHeight * 0.85               // HEIGHT_TO_SIZE
sizeFromWidth  = boxWidth / helveticaWidthAtSize1
fontSize       = max(4, min(sizeFromWidth, sizeFromHeight))

y = pdfBoxBottom - descenderRatio * fontSize    // HELVETICA_DESCENDER_RATIO = -0.207
```

Text is sanitized with `winAnsiSafePdfText` (curly quotes → ASCII, strip non–WinAnsi glyphs) before `page.drawText(..., opacity: 0)` with **StandardFonts.Helvetica**.

### 2.4 App-owned selection overlay (not PDF.js DOM text layer)

**Reader does not render react-pdf text spans.** `ReaderPageSlot` sets `renderTextLayer={false}`.

`BookPdfTextSelectLayer` (z-45, above spread ink at z-40):

- Loads word geometry once per page via `page.getTextContent()` → `pdf-page-text-geometry.ts`.
- Pointer drag extends selection in reading order; paints blue boxes from normalized run rects.
- `copy` event writes selected plain text to clipboard.
- Clicks on empty margins pass through to spread ink / marquee below.

Result: drag-select shows only the scan + blue highlight—no visible Helvetica on top of the picture.

### 2.5 Layer stacking and alignment

`resolveReaderPageLayerVisibility` controls cache vs live PDF canvas for page art only (no text layer stacking).

**Scaling / resize:**

- Page CSS width = `spreadPageWidth` (layout-driven).
- PDF render width = `resolveReaderPagePdfRenderWidthPx(spreadPageWidth, screenScale)`.
- Text select layer re-hit-tests geometry on window resize via capture refs.

**Hot reload after prep:** `SEARCHABLE_PDF_UPDATED_EVENT` → clear PDF load cache, invalidate text probes, bump `pdfFileEpoch`.

---

## 3. Techniques & Libraries

| Category | Choice |
|----------|--------|
| **OCR engine** | [Tesseract.js](https://github.com/naptha/tesseract.js) (Node worker, `eng`, cache in `.tesseract-cache/`) |
| **PDF read (server)** | `pdfjs-dist/legacy` |
| **PDF write (stamp)** | `pdf-lib` — `drawText` with `opacity: 0`, Helvetica |
| **Rasterization** | `@napi-rs/canvas` + pdf.js `page.render` |
| **Coordinate system** | Linear scale image pixels → PDF points; Y-axis flip; descender offset for baseline |
| **PDF read (client)** | `react-pdf` canvas only; geometry via `pdfjs-dist` `getTextContent()` |
| **Font** | Standard Helvetica only (WinAnsi-safe subset) |
| **Normalization (vocab/debug)** | Page-normalized 0–1 boxes from geometry or `getBoundingClientRect()` |
| **Selection UX** | App overlay at z-45 — not native DOM selection on spans |
| **Job orchestration** | Serialized OCR queue + serialized sidecar writes (one worker, one writer) |
| **Storage** | Filesystem sidecar `book-library/<unit>/.searchable/<unit>.pdf` |

**Not used:** Apple Vision, ML Kit, Google Cloud Vision, Gemini for OCR placement, custom SVG selection layer.

---

## 4. Edge Cases, Limitations & Known Issues

### 4.1 What Works

- Image-only scans → teacher runs prep → drag-select in reader (Select / V tool).
- Pages that already have real PDF text are skipped automatically.
- Re-running prep skips already-stamped sidecar pages.
- Selection highlight only—no ghost text on the scan (Phase 1 goal).
- Copy via clipboard handler on text select layer (Ctrl+C).
- Sidecar is hidden from library listing (`isHiddenLibraryDirName`).
- Partial job stop keeps finished pages; reader reloads on update.

### 4.2 OCR / Placement Limitations (Phase 2 not done)

| Issue | Cause | Symptom |
|-------|-------|---------|
| **Per-word boxes only** | Tesseract word bboxes stamped individually | Misaligned selection on tight kerning, justified text, or multi-word phrases |
| **Single font metric** | All words use Helvetica sizing heuristic | Font size/width mismatch vs printed typeface |
| **No line grouping** | Planned Phase 2: line-aware stamping | Line height drift; words on same line may select inconsistently |
| **No junk filter** | Low-quality boxes still stamped if confidence ≥40 | Stray boxes in margins, artifacts |
| **1800px raster** | Fixed OCR resolution | Very small text or fine print may miss or mis-box |
| **Helvetica / WinAnsi only** | `winAnsiSafePdfText` strips non-ASCII | `café` → `caf`; words with special chars may be dropped entirely |
| **Axis-aligned boxes only** | Tesseract + `drawText` horizontal | Curved, rotated, or vertical text not supported |

### 4.3 Reader / UX Limitations

| Issue | Details |
|-------|---------|
| **Select tool only** | `bookPdfTextSelectActive` requires `annotationMode === 'select'`; pen/marker/etc. do not enable text layer |
| **Disabled during focus-draw / exercise-draw / whiteboard** | Text select turned off in those modes |
| **30-char probe threshold** | Sparse pages (title only) may not activate text layer even if some words were stamped |
| **Pinch zoom** | Text select stays enabled during pinch zoom; PDF.js spans scale with CSS transform—generally OK, but extreme zoom + cache-primary mode can stress alignment if cache and text layer diverge |
| **Toolbar hints unused** | `bookTextSpreadHasSelectable` is plumbed to toolbar but not yet shown in UI |
| **Vocab highlights off** | `interactiveVocabPageHighlightsEnabled = false` until Phase 4 |

### 4.4 Failure Modes

- `Path2D` / canvas errors → "Could not read this page picture."
- Empty OCR on a page → page saved with 0 words; still not selectable (probe stays false).
- Tesseract worker crash → page fails; prior pages in batch retained.
- Original replaced (newer mtime) → sidecar recopied from original on next stamp (stamped text on old sidecar may be lost if copy overwrites—only happens when original is newer than sidecar).

---

## 5. Debugging Bounding Box Alignment

There is **no shipped debug flag**. Use these approaches:

### 5.1 Temporarily Reveal the Text Layer (fastest)

In `app/globals.css`, under `.book-pdf-text-select`, temporarily override span styles:

```css
/* DEBUG ONLY — remove before commit */
.fullscreen-class .book-pdf-text-select .react-pdf__Page__textContent span {
  color: rgba(255, 0, 0, 0.35) !important;
  -webkit-text-fill-color: rgba(255, 0, 0, 0.35) !important;
  opacity: 1 !important;
  background: rgba(0, 255, 0, 0.15);
}
```

Open reader → Select tool → red/green boxes show PDF.js span positions vs scan.

### 5.2 Browser DevTools

1. Open fullscreen reader with Select tool on a stamped page.
2. Inspect `.react-pdf__Page__textContent span` elements.
3. Check `transform`, `font-size`, and `getBoundingClientRect()` vs visible print on the canvas/cache below.
4. Toggle `book-pdf-text-select-over-cache` on the parent—confirm whether misalignment is cache-vs-text or OCR-vs-PDF.

### 5.3 Vocab Highlight Layer as Box Overlay (Phase 4 preview)

Set `interactiveVocabPageHighlightsEnabled = true` in `lib/books/feature-flags.ts` and ensure vocab words exist in the pack. `InteractiveVocabHighlightLayer` draws **sky-blue semi-transparent boxes** (`bg-sky-400/25`) from span union rects—useful to see where the text layer thinks words are, independent of selection.

### 5.4 Server-Side Placement Math

Run unit tests:

```bash
npx vitest lib/books/searchable-pdf-text-layer.test.ts
```

Add temporary logging in `stampPageOnSidecar` after `mapOcrWordToPdfText` to dump `{ text, x, y, size }` vs OCR bbox for one page.

### 5.5 Verify Sidecar vs Original

1. Confirm file exists: `book-library/<unit>/.searchable/<unit>.pdf`
2. Open sidecar in a desktop PDF viewer with "highlight invisible text" or select-all—words should highlight over the image.
3. Confirm reader URL serves sidecar: network tab for `/api/book-file?path=...` should hit the updated file after prep (watch for `esl:searchable-pdf-updated`).

### 5.6 Probe / Capability Issues

If Select tool is on but nothing selects:

- Check `pageTextCapability` in React devtools (`BookCanvasStage`)—page may be `'pending'` or `false`.
- Invalidate probe cache: sidecar update should call `invalidatePdfPageTextProbeCacheForFileUrl`.
- Confirm page has ≥30 chars of extracted text after stamping.

### 5.7 Text select layer issues

If Select tool is on but nothing selects:

- Confirm `BookPdfTextSelectLayer` is mounted (`spreadPdfTextSelectLayer` in `BookCanvasStage`).
- Check `pageTextCapability` — page may be `'pending'` or `false`.
- Confirm geometry loaded: `usePdfPageTextGeometry` returns runs for the page.
- Empty-margin clicks should still hit ink — only text hits anchor selection.

---

## 6. Phased Roadmap (from project plan)

| Phase | Status | Scope |
|-------|--------|-------|
| **0** | Manual test | One unit end-to-end |
| **1** | ✅ Done | App-owned overlay selection, no DOM text layer, vocab highlights off |
| **2** | 🔲 Planned | Line-aware OCR, per-line font size, per-word X tuning, junk box filter |
| **3** | 🔲 Partial | "Make pages selectable" on Vocabulary prep (not only Stories) |
| **4** | 🔲 Planned | Vocab tap spots from OCR boxes + manual nudge; re-enable highlight layer |
| **5** | 🔲 Planned | Prep preview of all taps, batch place, optional Gemini for text cleanup only |

---

## 7. Post-Mortem — Key Lessons

1. **Sidecar PDF + geometry overlay** beats fighting the ink stack with native DOM text layers and pointer piercing.
2. **Text select lives above spread ink (z-45)** so Select mode does not compete with z-40 session layer.
3. **Same `getTextContent()` source as PDF.js** keeps boxes aligned with stamped invisible text at all zoom levels.
4. **Pass-through on non-text hits** lets marquee and annotation select work on empty margins.
5. **Word-level Tesseract + Helvetica is good enough for Phase 1** but will not match picture-book typography until Phase 2 placement work lands.
6. **Serialized OCR/writes** prevent corrupt sidecar PDFs from concurrent page stamps on a single Node process.

---

## 8. Quick Reference — Important Constants

| Constant | Value | Location |
|----------|-------|----------|
| `OCR_RENDER_WIDTH` | 1800 px | `searchable-pdf-build.ts` |
| `OCR_MIN_CONFIDENCE` | 40 | `searchable-pdf-ocr.ts` |
| `PDF_PAGE_SELECTABLE_TEXT_MIN_CHARS` | 30 | `pdf-page-text-probe.ts` |
| `HEIGHT_TO_SIZE` | 0.85 | `searchable-pdf-text-layer.ts` |
| `MIN_FONT_SIZE` | 4 pt | `searchable-pdf-text-layer.ts` |
| `HELVETICA_DESCENDER_RATIO` | −0.207 | `searchable-pdf-text-layer.ts` |
| Sidecar directory | `.searchable/` | `searchable-pdf-path.ts` |
| Feature flag | `bookPdfTextSelectionEnabled = true` | `feature-flags.ts` |

---

*Generated from codebase state as of the selectable-book Phase 1 implementation.*
