'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  getLessonBoardActivePage,
} from '@/lib/books/lesson-board-types'
import type { LessonBoardPagePrimaryLink } from '@/lib/books/lesson-board-types'
import {
  findLessonBoardPageLinkForBoardPage,
  formatNotebookBookLinkLabel,
  listBoardLinksFromNotebookPages,
  resolveLessonBoardPageIdFromLink,
  stampLegacyBoardLinksOntoPages,
  type LessonBoardPageLink,
} from '@/lib/books/lesson-board-page-links'
import { hydrateLessonBoardLinksFromDisk } from '@/lib/local-data/lesson-board-links-disk-client'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'
import type { BookLibraryPayload } from '@/lib/books/types'

export type UseBoardLinkPlacementArgs = {
  studentId: string
  /** Currently focused PDF book — new links cite this book. */
  openBookId: string | null
  library: BookLibraryPayload | null
  whiteboardSessionDoc: WhiteboardSessionDocument | null
  minimizeWhiteboard: () => void
  /** Marker tap: Pin notebook and show that page (book stays Focus). */
  pinNotebook: () => void
  selectLessonBoardPage: (pageId: string) => void
  setLessonBoardPagePrimaryLink: (
    pageId: string,
    link: LessonBoardPagePrimaryLink | null,
  ) => boolean
  applyLessonBoardPagePrimaryLinks: (
    linksByPageId: ReadonlyMap<string, LessonBoardPagePrimaryLink>,
  ) => boolean
}

export function useBoardLinkPlacement({
  studentId,
  openBookId,
  library,
  whiteboardSessionDoc,
  minimizeWhiteboard,
  pinNotebook,
  selectLessonBoardPage,
  setLessonBoardPagePrimaryLink,
  applyLessonBoardPagePrimaryLinks,
}: UseBoardLinkPlacementArgs) {
  const [placementActive, setPlacementActive] = useState(false)
  const [legacyStampEpoch, setLegacyStampEpoch] = useState(0)
  const stampedDocIdRef = useRef<string | null>(null)

  const links = useMemo(
    () => listBoardLinksFromNotebookPages(whiteboardSessionDoc?.pages ?? []),
    [whiteboardSessionDoc?.pages],
  )

  const stampLegacyLinks = useCallback(() => {
    const doc = whiteboardSessionDoc
    if (!doc) return
    const stamped = stampLegacyBoardLinksOntoPages(studentId, doc.pages)
    if (!stamped.changed) return
    const byPageId = new Map<string, LessonBoardPagePrimaryLink>()
    for (const page of stamped.pages) {
      if (!page.primaryLink) continue
      const current = doc.pages.find((p) => p.id === page.id)?.primaryLink
      if (current) continue
      byPageId.set(page.id, page.primaryLink)
    }
    if (byPageId.size === 0) return
    applyLessonBoardPagePrimaryLinks(byPageId)
  }, [applyLessonBoardPagePrimaryLinks, studentId, whiteboardSessionDoc])

  useEffect(() => {
    let cancelled = false
    void hydrateLessonBoardLinksFromDisk().then(() => {
      if (cancelled) return
      setLegacyStampEpoch((n) => n + 1)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!whiteboardSessionDoc) {
      stampedDocIdRef.current = null
      return
    }
    const token = `${whiteboardSessionDoc.docId}:${legacyStampEpoch}`
    if (stampedDocIdRef.current === token) return
    stampedDocIdRef.current = token
    stampLegacyLinks()
  }, [legacyStampEpoch, stampLegacyLinks, whiteboardSessionDoc])

  const activeBoardPage = whiteboardSessionDoc
    ? getLessonBoardActivePage(whiteboardSessionDoc.pages, whiteboardSessionDoc.activePageId)
    : null

  const activeBoardPageLink = useMemo(() => {
    if (!activeBoardPage) return null
    return findLessonBoardPageLinkForBoardPage(links, activeBoardPage.id)
  }, [activeBoardPage, links])

  const activePrimaryLink = activeBoardPage?.primaryLink ?? null

  const startBoardLinkPlacement = useCallback(() => {
    if (!activeBoardPage || !openBookId) return
    minimizeWhiteboard()
    setPlacementActive(true)
  }, [activeBoardPage, minimizeWhiteboard, openBookId])

  const cancelBoardLinkPlacement = useCallback(() => {
    setPlacementActive(false)
  }, [])

  const placeBoardLinkAt = useCallback(
    (pdfPage: number, center: [number, number]) => {
      const bookId = openBookId?.trim()
      if (!bookId || !activeBoardPage) {
        toast.error('Could not place link — open a book and try again.')
        setPlacementActive(false)
        return false
      }
      const next: LessonBoardPagePrimaryLink = { bookId, pdfPage, center }
      const saved = setLessonBoardPagePrimaryLink(activeBoardPage.id, next)
      setPlacementActive(false)
      if (!saved) {
        toast.error('Could not place link — open the notebook and try again.')
        return false
      }
      toast.success(`Linked to ${formatNotebookBookLinkLabel(next, library)}`)
      return true
    },
    [activeBoardPage, library, openBookId, setLessonBoardPagePrimaryLink],
  )

  const removeActiveBoardPageLink = useCallback(() => {
    if (!activeBoardPage) return false
    const removed = setLessonBoardPagePrimaryLink(activeBoardPage.id, null)
    if (!removed) return false
    toast.success('Book link removed')
    return true
  }, [activeBoardPage, setLessonBoardPagePrimaryLink])

  const openBoardFromLink = useCallback(
    (link: LessonBoardPageLink) => {
      if (!whiteboardSessionDoc) return false
      const resolvedId = resolveLessonBoardPageIdFromLink(link, whiteboardSessionDoc.pages)
      if (!resolvedId) {
        toast.error("That notebook page couldn't be found — open the page list and re-link.")
        return false
      }
      pinNotebook()
      selectLessonBoardPage(resolvedId)
      return true
    },
    [pinNotebook, selectLessonBoardPage, whiteboardSessionDoc],
  )

  return {
    boardLinkPlacementActive: placementActive,
    lessonBoardPageLinks: links,
    activeBoardPageLink,
    activePrimaryLink,
    startBoardLinkPlacement,
    cancelBoardLinkPlacement,
    placeBoardLinkAt,
    removeActiveBoardPageLink,
    openBoardFromLink,
  }
}
