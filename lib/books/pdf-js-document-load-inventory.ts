/**
 * ## Session warm contract (fullscreen map + book overlay)
 *
 * Policy for later phases (`docs/FULLSCREEN_BOOK_PREFETCH_PAGE_TURN_TASKS.md`):
 *
 * **Blocking — before we treat the overlay reader as “ready” to show (no empty frame):**
 * - Books library payload for the active student (same shape as `/api/books` today).
 * - PDF.js worker configured for the **browser** `react-pdf` stack (`wasmUrl` + workerSrc) — warm via `ensureReactPdfWorker()` from the map route and `usePdfJsWorker`.
 * - First **visible** spread for the resolved unit is either painted or we explicitly time out / degrade.
 *
 * **Idle / optional — never block map HUD or first tap:**
 * - Neighbour PDF pages at spread resolution — window policy in `lib/books/reader-prefetch-window.ts`.
 * - HTTP cache priming for the unit PDF URL.
 * - Decorative frame image decode.
 *
 * Anything in the “idle” tier must be cancellable or low-priority so low-end devices stay usable.
 */

/** One discovered load path; keep in sync when adding PDF open flows. */
export interface PdfJsDocumentLoadPath {
  /** Stable id for docs and task checklists */
  id: string
  /** Repo-relative path */
  modulePath: string
  /** `getDocument` vs react-pdf wrapper */
  kind: 'pdfjs_getDocument' | 'react_pdf_document'
  /** `url` (browser), `data` (bytes), etc. */
  transportNote: string
  /** Student reader / teacher tools / server pipeline */
  surface: 'student_reader' | 'teacher_or_books_ui' | 'server_node'
}

/**
 * Inventory as of Phase A1 — every path that opens a PDF via PDF.js or `react-pdf`’s `Document`.
 * `react-pdf`’s `<Document file=…>` ultimately calls `getDocument` internally; it does not automatically
 * dedupe with our explicit `getDocument` caches unless we wire that in (Phase A4).
 */
export const PDF_JS_DOCUMENT_LOAD_PATHS = [
  {
    id: 'thumbnail_cache',
    modulePath: 'lib/books/pdf-thumbnail-cache.ts',
    kind: 'pdfjs_getDocument',
    transportNote: 'url + wasmUrl `/wasm/`; promise cached per fileUrl in pdfLoadCache',
    surface: 'student_reader',
  },
  {
    id: 'capture_toc_client',
    modulePath: 'lib/books/capture-toc-images-client.ts',
    kind: 'pdfjs_getDocument',
    transportNote: 'url + wasmUrl; TOC image capture flow',
    surface: 'teacher_or_books_ui',
  },
  {
    id: 'materials_map_server',
    modulePath: 'lib/context/materials-map.ts (extractPdfText)',
    kind: 'pdfjs_getDocument',
    transportNote:
      'Server: `pdfjs-dist/legacy/build/pdf.mjs`, `data: Uint8Array` from readFile — separate from browser wasm stack',
    surface: 'server_node',
  },
  {
    id: 'fullscreen_book_overlay',
    modulePath: 'fullscreen-book-overlay/sections/BookCanvasStage.tsx',
    kind: 'pdfjs_getDocument',
    transportNote:
      '`loadCachedPdfDocument(makeUnitFileUrl(path))` (shared with thumbnails) + `react-pdf` Page with `pdf` prop — no second getDocument for the same URL',
    surface: 'student_reader',
  },
  {
    id: 'reader_page_prefetch_queue',
    modulePath: 'lib/books/reader-page-prefetch-queue.ts',
    kind: 'pdfjs_getDocument',
    transportNote:
      'Idle neighbour prefetch: `loadCachedPdfDocument` + `page.render` → `createImageBitmap` (same URL cache as overlay)',
    surface: 'student_reader',
  },
  {
    id: 'books_page_client',
    modulePath: 'components/books/books-page-client.tsx',
    kind: 'react_pdf_document',
    transportNote: 'teacher books UI preview / library',
    surface: 'teacher_or_books_ui',
  },
  {
    id: 'book_structure_wizard',
    modulePath: 'components/books/book-structure-wizard.tsx',
    kind: 'react_pdf_document',
    transportNote: 'wizard previews',
    surface: 'teacher_or_books_ui',
  },
  {
    id: 'book_outline_part_row',
    modulePath: 'components/books/book-outline-part-row.tsx',
    kind: 'react_pdf_document',
    transportNote: 'per-part PDF preview',
    surface: 'teacher_or_books_ui',
  },
] as const satisfies readonly PdfJsDocumentLoadPath[]
