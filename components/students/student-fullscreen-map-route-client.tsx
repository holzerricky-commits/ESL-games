'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClassSessionMapTimer } from '@/components/students/class-session-map-timer'
import { FantasyHUD } from '@/components/students/fantasy-hud'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { preloadBookOpenedFrameImage, removeBookOpenedFramePreload } from '@/components/students/fullscreen-book-overlay/constants'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { warmMapInitialBookSpreadPrefetch } from '@/lib/books/map-initial-book-spread-warmup'
import { getStudentProfileView } from '@/lib/students/selectors'

interface StudentFullscreenMapRouteClientProps {
  studentId: string
  introMode: 'mission' | null
  /** Optional class session id from `?classSession=` (live lesson). */
  activeClassSessionId?: string | null
}

export function StudentFullscreenMapRouteClient({
  studentId,
  introMode,
  activeClassSessionId = null,
}: StudentFullscreenMapRouteClientProps) {
  const [isHydrated, setIsHydrated] = useState(false)
  /** Arms PDF + reader work off-screen; map shows loading until first spread is painted. */
  const [bookOpenArmed, setBookOpenArmed] = useState(false)
  /** When true with `bookOpenArmed`, the book shell is visible (locked with first paint). */
  const [bookOpenPresented, setBookOpenPresented] = useState(false)

  const mapBookChromeOpen = bookOpenArmed && bookOpenPresented

  const handleOpenBook = useCallback(() => {
    setBookOpenArmed(true)
    setBookOpenPresented(false)
  }, [])

  const handleBookReadyToPresent = useCallback(() => {
    setBookOpenPresented(true)
  }, [])

  const handleBookOpenPaintTimeout = useCallback(() => {
    toast.error('The book is taking too long to open. Please try again.')
    setBookOpenArmed(false)
    setBookOpenPresented(false)
  }, [])

  const handleBookClose = useCallback(() => {
    setBookOpenArmed(false)
    setBookOpenPresented(false)
  }, [])

  useEffect(() => {
    if (!bookOpenArmed || bookOpenPresented) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setBookOpenArmed(false)
      setBookOpenPresented(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bookOpenArmed, bookOpenPresented])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  /** Keep the route from scrolling the document; wheel/trackpad and mobile overscroll were revealing the page behind the map. */
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevHtmlOverflow = html.style.overflow
    const prevBodyOverflow = body.style.overflow
    const prevHtmlOverscroll = html.style.overscrollBehavior
    const prevBodyOverscroll = body.style.overscrollBehavior
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
    return () => {
      html.style.overflow = prevHtmlOverflow
      body.style.overflow = prevBodyOverflow
      html.style.overscrollBehavior = prevHtmlOverscroll
      body.style.overscrollBehavior = prevBodyOverscroll
    }
  }, [])

  /** Warm global `/api/books`, pdf.js worker, book frame asset, and likely first-spread bitmaps (A2/A3/B4 + Phase E1c). */
  useEffect(() => {
    if (!isHydrated) return
    const student = getStudentProfileView(studentId)
    if (!student) return
    void fetchBooksLibraryCached()
      .then((lib) =>
        warmMapInitialBookSpreadPrefetch({
          library: lib,
          assignedBookIds: student.assignedBookIds ?? [],
          assignedUnitRefs: student.assignedUnitRefs ?? [],
          curriculumHistory: student.curriculumHistory ?? [],
        }),
      )
      .catch(() => {})
    void ensureReactPdfWorker().catch(() => {})
    preloadBookOpenedFrameImage()
    return () => {
      removeBookOpenedFramePreload()
    }
  }, [isHydrated, studentId])

  if (!isHydrated) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading challenge map...</p>
      </div>
    )
  }

  const student = getStudentProfileView(studentId)

  if (!student) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-base font-semibold text-foreground">Student not found</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This map is not available yet. Return to Students and select an active student.
        </p>
      </div>
    )
  }

  const activeSession =
    activeClassSessionId ? student.scheduledClasses?.find((s) => s.id === activeClassSessionId) : undefined

  return (
    <div className="fixed inset-0 z-0 overflow-hidden overscroll-none bg-background">
      {activeSession?.status === 'in_progress' ? (
        <ClassSessionMapTimer
          studentId={student.id}
          session={activeSession}
          assignedBookIds={student.assignedBookIds ?? []}
        />
      ) : null}
      {/*
        Do not use flex here: FantasyHUD is `absolute inset-0` with only absolutely positioned children,
        so a flex sibling would collapse to zero height and clip the HUD. Map fills this `fixed inset-0` shell.
      */}
      <div
        className={`h-full min-h-0 w-full transition-[filter,opacity] duration-300 ${
          mapBookChromeOpen ? 'pointer-events-none blur-[3px] brightness-75' : ''
        }`}
      >
        <StudentMapTab key={student.id} student={student} fullscreen introMode={introMode} />
      </div>
      {mapBookChromeOpen ? <div className="pointer-events-none absolute inset-0 z-30 bg-black/50" /> : null}
      <FantasyHUD
        exitHref={`/students/${student.id}`}
        onOpenBook={handleOpenBook}
        isBookOverlayOpen={mapBookChromeOpen}
        isBookOpeningPending={bookOpenArmed && !bookOpenPresented}
      />
      <FullscreenBookOverlay
        key={student.id}
        studentId={student.id}
        assignedBookIds={student.assignedBookIds}
        assignedUnitRefs={student.assignedUnitRefs}
        curriculumHistory={student.curriculumHistory}
        studentName={student.name}
        open={bookOpenArmed}
        presented={bookOpenPresented}
        onBookReadyToPresent={handleBookReadyToPresent}
        onBookOpenPaintTimeout={handleBookOpenPaintTimeout}
        onClose={handleBookClose}
      />
    </div>
  )
}
