/**
 * Browser-only: configures `react-pdf` / pdf.js worker once per page session.
 * Used from the fullscreen map (before overlay mounts) and from `usePdfJsWorker`.
 */
let reactPdfWorkerReady: Promise<void> | null = null

export function ensureReactPdfWorker(): Promise<void> {
  if (!reactPdfWorkerReady) {
    reactPdfWorkerReady = import('react-pdf').then(({ pdfjs }) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url,
      ).toString()
    })
  }
  return reactPdfWorkerReady
}
