'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClassSessionMapTimer } from '@/components/students/class-session-map-timer'
import { FantasyHUD } from '@/components/students/fantasy-hud'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { isMapAnchorSpreadCacheReady } from '@/lib/books/map-anchor-spread-context'
import { warmMapInitialBookSpreadPrefetch } from '@/lib/books/map-initial-book-spread-warmup'
import { subscribePageRenderCache } from '@/lib/books/page-render-cache'
import { flushPendingUnitPageSave } from '@/lib/books/progress'
import { requestSpreadSessionFlush } from '@/lib/books/spread-session-events'
import { requestWhiteboardSessionFlush } from '@/lib/books/whiteboard-session-events'
import {
  ensureStudentRecordsHydrated,
  STUDENT_RECORDS_HYDRATED_EVENT,
} from '@/lib/local-data/student-records-client'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { getStudentProfileView } from '@/lib/students/selectors'

/** Opens the spell book from the fullscreen map (outside AppShell — no sidebar conflict). */
const MAP_SPELL_BOOK_SHORTCUT_KEY = 'b'

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
  const [recordsReady, setRecordsReady] = useState(false)
  /** Mounts overlay off-screen on map enter so PDF + first spread render before the user opens the book. */
  const [bookWarmArmed, setBookWarmArmed] = useState(false)
  /** First spread drawable while warming (prefetch + slot pixels). */
  const [bookPagesReady, setBookPagesReady] = useState(false)
  /** User clicked open before pages were drawable — show HUD spinner until ready. */
  const [bookOpenAttempted, setBookOpenAttempted] = useState(false)
  /** User chose to reveal the warmed book overlay. */
  const [bookOpenPresented, setBookOpenPresented] = useState(false)

  const mapBookChromeOpen = bookOpenPresented

  /** Arm hidden reader warm-up as soon as the map shell is ready for this student. */
  useEffect(() => {
    if (!isHydrated || !recordsReady) return
    const student = getStudentProfileView(studentId)
    if (!student) return
    setBookWarmArmed(true)
    setBookPagesReady(false)
    setBookOpenAttempted(false)
    setBookOpenPresented(false)
  }, [isHydrated, recordsReady, studentId])

  const handleOpenBook = useCallback(() => {
    if (bookOpenPresented) return
    if (bookPagesReady) {
      setBookOpenPresented(true)
      return
    }
    setBookOpenAttempted(true)
  }, [bookPagesReady, bookOpenPresented])

  const handleBookReadyToPresent = useCallback(() => {
    setBookPagesReady(true)
  }, [])

  /** After a pending HUD click, open the book once pages are drawable. */
  useEffect(() => {
    if (!bookOpenAttempted || !bookPagesReady || bookOpenPresented) return
    setBookOpenPresented(true)
    setBookOpenAttempted(false)
  }, [bookOpenAttempted, bookPagesReady, bookOpenPresented])

  const handleBookPaintInvalidated = useCallback(() => {
    setBookPagesReady(false)
  }, [])

  const handleBookOpenPaintTimeout = useCallback(() => {
    toast.error('The book is taking too long to load. Retrying…')
    setBookPagesReady(false)
    setBookOpenAttempted(false)
    setBookOpenPresented(false)
    setBookWarmArmed(false)
    window.requestAnimationFrame(() => setBookWarmArmed(true))
  }, [])

  const handleBookClose = useCallback(() => {
    flushPendingUnitPageSave()
    requestSpreadSessionFlush()
    requestWhiteboardSessionFlush()
    setBookOpenPresented(false)
    setBookOpenAttempted(false)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (isBookOverlayKeyboardTypingTarget()) return

      const mod = e.ctrlKey || e.metaKey || e.altKey
      const keyLower = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (keyLower === 'escape' && bookOpenPresented) {
        e.preventDefault()
        setBookOpenPresented(false)
        return
      }

      if (!mod && keyLower === MAP_SPELL_BOOK_SHORTCUT_KEY && !bookOpenPresented) {
        e.preventDefault()
        handleOpenBook()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bookOpenPresented, handleOpenBook])

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  /** Start books + PDF worker as soon as the client mounts — do not wait for student records. */
  useEffect(() => {
    if (!isHydrated) return
    void fetchBooksLibraryCached().catch(() => {})
    void ensureReactPdfWorker().catch(() => {})
  }, [isHydrated])

  /** Mark spell book ready when anchor spread is cached (even before the user opens). */
  useEffect(() => {
    if (!bookWarmArmed || bookPagesReady) return
    const tick = () => {
      if (isMapAnchorSpreadCacheReady()) {
        setBookPagesReady(true)
      }
    }
    tick()
    return subscribePageRenderCache(tick)
  }, [bookWarmArmed, bookPagesReady])

  /** Fullscreen map is outside AppShell — load student records from disk before lookup (same as Students list). */
  useEffect(() => {
    let cancelled = false
    void ensureStudentRecordsHydrated().then(() => {
      if (!cancelled) setRecordsReady(true)
    })
    const onHydrated = () => setRecordsReady(true)
    window.addEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
    return () => {
      cancelled = true
      window.removeEventListener(STUDENT_RECORDS_HYDRATED_EVENT, onHydrated)
    }
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
    if (!isHydrated || !recordsReady) return
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
  }, [isHydrated, recordsReady, studentId])

  if (!isHydrated || !recordsReady) {
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

  const liveClassSessionId =
    activeSession?.status === 'in_progress'
      ? activeSession.id
      : student.scheduledClasses?.find((s) => s.status === 'in_progress')?.id ?? null

  return (
    <div className="fixed inset-0 z-0 overflow-hidden overscroll-none bg-background">
      {activeSession?.status === 'in_progress' ? (
        <ClassSessionMapTimer
          studentId={student.id}
          session={activeSession}
          assignedBookIds={student.assignedBookIds ?? []}
          elevated={mapBookChromeOpen}
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
        isBookOpeningPending={bookOpenAttempted && !bookPagesReady}
      />
      <FullscreenBookOverlay
        key={student.id}
        studentId={student.id}
        activeClassSessionId={liveClassSessionId}
        assignedBookIds={student.assignedBookIds}
        assignedUnitRefs={student.assignedUnitRefs}
        curriculumHistory={student.curriculumHistory}
        studentName={student.name}
        open={bookWarmArmed}
        presented={bookOpenPresented}
        onBookReadyToPresent={handleBookReadyToPresent}
        onBookPaintInvalidated={handleBookPaintInvalidated}
        onBookOpenPaintTimeout={handleBookOpenPaintTimeout}
        onClose={handleBookClose}
      />
    </div>
  )
}
