# Selectable book (picture PDFs) — phased plan

Picture-only unit PDFs need invisible text behind the scan so teachers can select, translate, and later tap vocab words.

## Phase 0 — Test unit

Pick one unit (e.g. Literature wolf story). Stories tab → confirm pages → Make pages selectable → test drag-select in reader (Select mode).

## Phase 1 — App-owned text selection overlay (current)

**Goal:** Drag-select on searchable pages with blue highlight on the scan only — no ghost Helvetica, no fighting the ink stack.

**Build:**

- `lib/books/pdf-page-text-geometry.ts` — word boxes from `getTextContent()`, hit-test, range select.
- `BookPdfTextSelectLayer` at z-45 above spread ink — drag select, copy, pass-through on empty margins.
- `ReaderPageSlot`: `renderTextLayer={false}`; removed pointer routing and invisible DOM text layer.
- Lower character probe threshold from 30 → 5 in `lib/books/pdf-page-text-probe.ts` so short picture-book pages are not skipped.
- Vocab on-page highlights remain off (`interactiveVocabPageHighlightsEnabled = false`) until Phase 4.

**Test:** Make pages selectable → reader → Select tool → drag words and phrases. Blue boxes on scan only; Ctrl+C copies text; ink/annotation select still works on empty areas.

## Phase 2 — Line-aware OCR stamping ✅

In `lib/books/searchable-pdf-text-layer.ts` and `searchable-pdf-build.ts`:

- Group OCR words on the same baseline into lines.
- Scale font size **per line** (not per word width-stretch).
- Map curly quotes cleanly instead of stripping to ASCII.
- Fallback to Gemini vision when the median Tesseract confidence is under 65% (or the page has no words). If the cloud read fails, the Tesseract words are kept.

## Phase 3 — Unified prep workflow ✅

**Make pages selectable** button added directly on `BookPartVocabPrep` (vocabulary part prep desk), with progress bar and stop control, matching the Stories tab version.

## Phase 4 — Vocab tap spots ✅

- `VocabTapSpot` type: `pdfPage` + normalized `x`/`y`/`w`/`h` (0–1) on `PartContextVocabularyWord` and `InteractiveVocabWord`.
- Save API persists tap spots; `suggestTapSpots` auto-finds word positions from PDF text runs.
- Highlight layer uses saved tap spots when available (no DOM scanning needed).
- `interactiveVocabPageHighlightsEnabled` flipped **on**.

## Selectable body text — Phase A ✅

Stamp **body-sized OCR only**. Titles, tiny labels, and junk boxes are dropped before invisible text is written. Gemini extract is unchanged. Re-run Make pages selectable (old sidecar pages stay until restamped).

## Selectable line stamp — Phase B ✅

Body lines stamp as **one invisible string** stretched to the printed line width. Short or gappy lines still use per-word boxes. Use **Redo** on already-stamped stories so the new placement lands.

## Phase 5 — Polish & batch walkthrough ✅

- Each word card shows a tap spot badge: blue pin with page number when placed, amber "unplaced" when missing.
- Auto-suggest on save: when saving, unplaced words are automatically matched against the PDF text layer and given tap spots.
- `/api/context/suggest-tap-spots` — server-side endpoint reads searchable PDF, runs text geometry matching, returns spots.
- "Fix OCR" button in the vocab toolbar sends words to Gemini to fix OCR typos in word/definition text (positions unchanged).
- `/api/context/cleanup-vocab-text` — lightweight Gemini route for OCR text cleanup.
- Saved words with tap spots refresh into the editor after save.
