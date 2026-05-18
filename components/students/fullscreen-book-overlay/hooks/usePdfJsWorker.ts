import { useEffect } from 'react'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'

export function usePdfJsWorker(setPdfReady: (v: boolean) => void) {
  useEffect(() => {
    let active = true
    void ensureReactPdfWorker().then(() => {
      if (active) setPdfReady(true)
    })
    return () => {
      active = false
    }
  }, [setPdfReady])
}
