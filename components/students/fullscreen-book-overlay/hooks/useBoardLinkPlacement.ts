'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getLessonBoardActivePage,
} from '@/lib/books/lesson-board-types'
import { getLessonBoardActivePageIndex } from '@/lib/books/lesson-board-session-ops'
import {
  findLessonBoardPageLinkForBoardPage,
  loadLessonBoardPageLinks,
  removeLessonBoardPageLink,
  resolveLessonBoardPageIdFromLink,
  upsertLessonBoardPageLink,
  type LessonBoardPageLink,
  type LessonBoardPageLinksScope,
} from '@/lib/books/lesson-board-page-links'
import { hydrateLessonBoardLinksFromDisk } from '@/lib/local-data/lesson-board-links-disk-client'
import type { WhiteboardSessionDocument } from '@/lib/books/whiteboard-session-types'

export type UseBoardLinkPlacementArgs = {
  studentId: string
  bookId: string | null
  unitId: string | null
  whiteboardSessionDoc: WhiteboardSessionDocument | null
  minimizeWhiteboard: () => void
  openWhiteboard: () => void
  selectLessonBoardPage: (pageId: string) => void
  setLessonBoardPageBookPageHint: (pageId: string, bookPageHint: number) => boolean
}

export function useBoardLinkPlacement({
  studentId,
  bookId,
  unitId,
  whiteboardSessionDoc,
  minimizeWhiteboard,
  openWhiteboard,
  selectLessonBoardPage,
  setLessonBoardPageBookPageHint,
}: UseBoardLinkPlacementArgs) {
  const [placementActive, setPlacementActive] = useState(false)
  const [linksRevision, setLinksRevision] = useState(0)

  const scope = useMemo<LessonBoardPageLinksScope | null>(() => {
    if (!bookId || !unitId) return null
    return { studentId, bookId, unitId }
  }, [bookId, studentId, unitId])

  const links = useMemo(() => {
    if (!scope) return []
    void linksRevision
    return loadLessonBoardPageLinks(scope)
  }, [linksRevision, scope])

  const refreshLinks = useCallback(() => {
    setLinksRevision((n) => n + 1)
  }, [])

  // First reads can happen before saved links finish loading from disk;
  // re-read once hydration completes so markers don't stay empty until a new link is placed.
  useEffect(() => {
    let cancelled = false
    void hydrateLessonBoardLinksFromDisk().then(() => {
      if (!cancelled) refreshLinks()
    })
    return () => {
      cancelled = true
    }
  }, [refreshLinks])

  useEffect(() => {
    refreshLinks()
  }, [refreshLinks, whiteboardSessionDoc?.activePageId, bookId, unitId])

  const activeBoardPage = whiteboardSessionDoc
    ? getLessonBoardActivePage(whiteboardSessionDoc.pages, whiteboardSessionDoc.activePageId)
    : null

  const activeBoardPageLink = useMemo(() => {
    if (!activeBoardPage) return null
    return findLessonBoardPageLinkForBoardPage(links, activeBoardPage.id)
  }, [activeBoardPage, links])

  const startBoardLinkPlacement = useCallback(() => {
    if (!activeBoardPage || !scope) return
    minimizeWhiteboard()
    setPlacementActive(true)
  }, [activeBoardPage, minimizeWhiteboard, scope])

  const cancelBoardLinkPlacement = useCallback(() => {
    setPlacementActive(false)
  }, [])

  const placeBoardLinkAt = useCallback(
    (pdfPage: number, center: [number, number]) => {
      if (!scope || !whiteboardSessionDoc || !activeBoardPage) {
        toast.error('Could not place link — open the board and try again.')
        setPlacementActive(false)
        return false
      }
      const ordinal = getLessonBoardActivePageIndex(whiteboardSessionDoc)
      upsertLessonBoardPageLink(scope, {
        pdfPage,
        center,
        boardPage: activeBoardPage,
        ordinal,
      })
      setLessonBoardPageBookPageHint(activeBoardPage.id, pdfPage)
      refreshLinks()
      setPlacementActive(false)
      toast.success(`Linked to book page ${pdfPage}`)
      return true
    },
    [
      activeBoardPage,
      refreshLinks,
      scope,
      setLessonBoardPageBookPageHint,
      whiteboardSessionDoc,
    ],
  )

  const removeActiveBoardPageLink = useCallback(() => {
    if (!scope || !activeBoardPage) return false
    const removed = removeLessonBoardPageLink(scope, activeBoardPage.id)
    if (!removed) return false
    refreshLinks()
    toast.success('Book link removed')
    return true
  }, [activeBoardPage, refreshLinks, scope])

  const openBoardFromLink = useCallback(
    (link: LessonBoardPageLink) => {
      if (!whiteboardSessionDoc) return false
      const resolvedId = resolveLessonBoardPageIdFromLink(link, whiteboardSessionDoc.pages)
      if (!resolvedId) {
        toast.error("That board page couldn't be found — open the board list and re-link.")
        return false
      }
      openWhiteboard()
      selectLessonBoardPage(resolvedId)
      return true
    },
    [openWhiteboard, selectLessonBoardPage, whiteboardSessionDoc],
  )

  return {
    boardLinkPlacementActive: placementActive,
    lessonBoardPageLinks: links,
    activeBoardPageLink,
    startBoardLinkPlacement,
    cancelBoardLinkPlacement,
    placeBoardLinkAt,
    removeActiveBoardPageLink,
    openBoardFromLink,
    refreshLinks,
  }
}
