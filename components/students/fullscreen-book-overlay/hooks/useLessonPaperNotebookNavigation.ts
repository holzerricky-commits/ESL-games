import { useCallback, useRef, useState } from 'react'

interface UseLessonPaperNotebookNavigationArgs {
  pageNumber: number
  goToPage: (page: number) => void
}

export function useLessonPaperNotebookNavigation({ pageNumber, goToPage }: UseLessonPaperNotebookNavigationArgs) {
  const returnPageRef = useRef<number | null>(null)
  const [notebookReturnPage, setNotebookReturnPage] = useState<number | null>(null)

  const goToNotebookSourcePage = useCallback(
    (targetPage: number) => {
      if (!Number.isFinite(targetPage) || targetPage < 1) return
      if (targetPage === pageNumber) return
      if (returnPageRef.current == null) {
        returnPageRef.current = pageNumber
        setNotebookReturnPage(pageNumber)
      }
      goToPage(targetPage)
    },
    [goToPage, pageNumber],
  )

  const returnToNotebookCurrentPage = useCallback(() => {
    if (returnPageRef.current == null) return
    goToPage(returnPageRef.current)
    returnPageRef.current = null
    setNotebookReturnPage(null)
  }, [goToPage])

  const clearNotebookReturnPage = useCallback(() => {
    returnPageRef.current = null
    setNotebookReturnPage(null)
  }, [])

  return {
    notebookReturnPage,
    goToNotebookSourcePage,
    returnToNotebookCurrentPage,
    clearNotebookReturnPage,
  }
}
