'use client'

import { useEffect, useState } from 'react'

interface UseUnitPdfPageCountOptions {
  fileUrl: string | null
  pdfReady: boolean
}

export function useUnitPdfPageCount({ fileUrl, pdfReady }: UseUnitPdfPageCountOptions) {
  const [numPages, setNumPages] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!pdfReady || !fileUrl?.trim()) {
      setNumPages(null)
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const { pdfjs } = await import('react-pdf')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        const task = pdfjs.getDocument({ url: fileUrl!, wasmUrl: '/wasm/' })
        const doc = await task.promise
        if (!active) return
        setNumPages(doc.numPages)
      } catch (e) {
        if (!active) return
        setNumPages(null)
        setError(e instanceof Error ? e.message : 'Could not read PDF page count.')
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [fileUrl, pdfReady])

  return { numPages, loading, error }
}
