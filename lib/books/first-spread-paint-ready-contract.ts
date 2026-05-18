/**
 * ## First spread “paint ready” (Phase E1a)
 *
 * The **inner book viewport** may show a paper-tone hold until the first visible spread is safe
 * to reveal without a blank white PDF stage.
 *
 * **Predicate (implemented in `BookCanvasStage`):** `react-pdf` `Page` has fired `onLoadSuccess`
 * for the **left** anchor page, and for the **right** page when `showSpreadRightPage` is true.
 * Prefetched `ImageBitmap`s can paint earlier under `ReaderPageSlot`, but we still wait for
 * `onLoadSuccess` so layout/aspect and handoff stay consistent.
 *
 * @see `docs/FULLSCREEN_BOOK_SEAMLESS_PAINT_PHASES.md` — Phase E1
 */

export {}
