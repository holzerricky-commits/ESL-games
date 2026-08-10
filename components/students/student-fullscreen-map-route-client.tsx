'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ReadingCheckPrepPanel } from '@/components/books/reading-check-prep-panel'
import { ClassSessionMapTimer } from '@/components/students/class-session-map-timer'
import { ClassAutoStartReconciler } from '@/components/class-auto-start-reconciler'
import { FantasyHUD } from '@/components/students/fantasy-hud'
import { FullscreenBookOverlay } from '@/components/students/fullscreen-book-overlay'
import { PrepSessionCapsule } from '@/components/students/prep-session-capsule'
import { SimpleBookLaunchShell, type SimpleBookLaunchCover, type BookLaunchShelfTone } from '@/components/students/simple-book-launch-shell'
import { StudentMapTab } from '@/components/students/tabs/student-map-tab'
import { flushAnnotationsForClassEnd } from '@/lib/books/class-annotation-durability'
import type { ReadingCheckClassWrapSummary } from '@/lib/books/reading-check-live-marks'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { challengeMapLayerEnabled } from '@/lib/books/feature-flags'
import { resolveLauncherBookCovers } from '@/lib/books/resolve-initial-book-reader-selection'
import { fetchBooksLibraryCached } from '@/lib/books/fetch-books-library-cached'
import { isMapAnchorSpreadCacheReady } from '@/lib/books/map-anchor-spread-context'
import { warmMapInitialBookSpreadPrefetch } from '@/lib/books/map-initial-book-spread-warmup'
import { subscribePageRenderCache } from '@/lib/books/page-render-cache'
import {
  clearMapBookOverlayOpenSession,
  readMapBookOverlayOpenSession,
  writeMapBookOverlayOpenSession,
} from '@/lib/students/map-book-overlay-session'
import {
  readMapWelcomeConsumed,
  writeMapWelcomeConsumed,
} from '@/lib/students/map-welcome-greeting-session'
import {
  ensureStudentRecordsHydrated,
  STUDENT_RECORDS_HYDRATED_EVENT,
} from '@/lib/local-data/student-records-client'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import {
  FULLSCREEN_CLASS_SCOPE,
} from '@/components/students/fullscreen-book-overlay/constants'
import {
  getStudentProfileView,
  getStudentTeachingOpenPdfPageForBookUnit,
  resolveBookOverlayClassSessionId,
  resolveClassTeachingBookUnit,
  STUDENT_LOCAL_DATA_CHANGED_EVENT,
} from '@/lib/students/selectors'
import { StudentRewardBurstProvider, useStudentRewardBurst } from '@/components/students/student-reward-burst-context'
import { cn } from '@/lib/utils'

/** Opens the spell book from the fullscreen map (outside AppShell — no sidebar conflict). */
const MAP_SPELL_BOOK_SHORTCUT_KEY = 'b'
const MAP_STUDENT_REWARD_SHORTCUT_KEY = 'g'

interface StudentFullscreenMapRouteClientProps {
  studentId: string
  introMode: 'mission' | null
  /** Optional class session id from `?classSession=` (prep or live lesson). */
  activeClassSessionId?: string | null
  /** When true (`?openBook=1`), open the teaching book as soon as pages are ready. */
  openBookOnEnter?: boolean
  /** Map URL `book` — explicit teaching target. */
  preferBookId?: string | null
  /** Map URL `unit` — explicit unit when paired with `preferBookId`. */
  preferUnitId?: string | null
  /** When true (`?checksPrep=1`), open the reading-checks prep panel in prep mode. */
  openChecksPrep?: boolean
}

export function StudentFullscreenMapRouteClient(props: StudentFullscreenMapRouteClientProps) {
  return (
    <StudentRewardBurstProvider>
      <StudentFullscreenMapRouteClientContent {...props} />
    </StudentRewardBurstProvider>
  )
}

function StudentFullscreenMapRouteClientContent({
  studentId,
  introMode,
  activeClassSessionId = null,
  openBookOnEnter = false,
  preferBookId = null,
  preferUnitId = null,
  openChecksPrep = false,
}: StudentFullscreenMapRouteClientProps) {
  const router = useRouter()
  const { triggerReward } = useStudentRewardBurst()
  const [isHydrated, setIsHydrated] = useState(false)
  const [recordsReady, setRecordsReady] = useState(false)
  /** Bumps when class status changes on this route (e.g. soft auto-start). */
  const [profileTick, setProfileTick] = useState(0)
  const [prepExitBusy, setPrepExitBusy] = useState<'save' | 'leave' | null>(null)
  const [checksPrepOpen, setChecksPrepOpen] = useState(openChecksPrep)
  /** Mounts overlay off-screen on map enter so PDF + first spread render before the user opens the book. */
  const [bookWarmArmed, setBookWarmArmed] = useState(false)
  /** First spread drawable while warming (prefetch + slot pixels). */
  const [bookPagesReady, setBookPagesReady] = useState(false)
  /** Open requested (click, shortcut, session restore, or auto-open) — present once pages are ready. */
  const [bookOpenAttempted, setBookOpenAttempted] = useState(false)
  /** True only after an explicit teacher click/shortcut — drives welcome-screen spinner, not session restore. */
  const [userOpenPending, setUserOpenPending] = useState(false)
  /** User chose to reveal the warmed book overlay. */
  const [bookOpenPresented, setBookOpenPresented] = useState(false)
  /**
   * Class-start welcome on the book shelf. Once a book has been opened this visit,
   * closing the book returns to a quiet "pick a book" shelf instead of re-welcoming.
   */
  const [showClassStartWelcome, setShowClassStartWelcome] = useState(true)
  /** Student-facing end-of-class goodbye (after manual End class). */
  const [classWrapSummary, setClassWrapSummary] = useState<ReadingCheckClassWrapSummary | null>(null)
  const [launcherCovers, setLauncherCovers] = useState<SimpleBookLaunchCover[]>([])
  /** Welcome-shelf pick (overrides URL prefer while on this route). */
  const [chosenBookId, setChosenBookId] = useState<string | null>(() => preferBookId?.trim() || null)
  const [chosenUnitId, setChosenUnitId] = useState<string | null>(() => preferUnitId?.trim() || null)
  /** Lesson board open (not minimized) — class chrome stays under the book/board stack. */
  const [lessonBoardOpen, setLessonBoardOpen] = useState(false)

  const mapBookChromeOpen = bookOpenPresented
  /** Above the book only while the board is not covering the center. */
  const classChromeElevated = mapBookChromeOpen && !lessonBoardOpen

  const shelfDefaultBookId = launcherCovers[0]?.bookId ?? null
  const shelfDefaultUnitId = launcherCovers[0]?.unitId ?? null
  const urlPreferBookId = preferBookId?.trim() || null
  const urlPreferUnitId = preferUnitId?.trim() || null
  const teachingBookId = chosenBookId || urlPreferBookId || shelfDefaultBookId
  const teachingUnitId = chosenUnitId || urlPreferUnitId || shelfDefaultUnitId

  const refreshProfile = useCallback(() => {
    setProfileTick((n) => n + 1)
  }, [])

  useEffect(() => {
    if (openChecksPrep) setChecksPrepOpen(true)
  }, [openChecksPrep])

  useEffect(() => {
    setChosenBookId(preferBookId?.trim() || null)
    setChosenUnitId(preferUnitId?.trim() || null)
  }, [preferBookId, preferUnitId, studentId])

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ studentId?: string }>).detail
      if (detail?.studentId && detail.studentId !== studentId) return
      refreshProfile()
    }
    window.addEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(STUDENT_LOCAL_DATA_CHANGED_EVENT, onChanged)
  }, [studentId, refreshProfile])

  /** Arm hidden reader warm-up as soon as the map shell is ready for this student. */
  useEffect(() => {
    if (!isHydrated || !recordsReady) return
    const student = getStudentProfileView(studentId)
    if (!student) return
    const session = activeClassSessionId
      ? student.scheduledClasses?.find((s) => s.id === activeClassSessionId)
      : undefined
    const isPrep =
      Boolean(session) && (session?.status === 'planned' || session?.status === 'prepared')
    const autoOpen = openBookOnEnter
    // Restore a prior open only on a bare map return — not when entering a class
    // (shelf/welcome should lead; stale open often pointed at the wrong unit).
    const restoringBook =
      !activeClassSessionId && readMapBookOverlayOpenSession(studentId)
    const welcomeAlreadyUsed = readMapWelcomeConsumed(studentId, activeClassSessionId ?? null)
    setBookWarmArmed(true)
    setBookPagesReady(false)
    setBookOpenPresented(false)
    setUserOpenPending(false)
    setBookOpenAttempted(autoOpen || restoringBook)
    // Prep never uses student welcome. Live: ceremony until a book is opened this class.
    setShowClassStartWelcome(
      !isPrep && !(welcomeAlreadyUsed || restoringBook || autoOpen),
    )
  }, [isHydrated, recordsReady, studentId, activeClassSessionId, openBookOnEnter])

  /**
   * When soft auto-start flips prep → live on the same route, show the student welcome
   * (unless this live class already used it, or the book is already / about to be open).
   */
  useEffect(() => {
    if (!isHydrated || !recordsReady) return
    const student = getStudentProfileView(studentId)
    if (!student) return
    const session = activeClassSessionId
      ? student.scheduledClasses?.find((s) => s.id === activeClassSessionId)
      : undefined
    if (session?.status !== 'in_progress') return
    if (readMapWelcomeConsumed(studentId, activeClassSessionId ?? null)) {
      setShowClassStartWelcome(false)
      return
    }
    if (
      bookOpenPresented ||
      readMapBookOverlayOpenSession(studentId) ||
      openBookOnEnter
    ) {
      if (bookOpenPresented) {
        writeMapWelcomeConsumed(studentId, activeClassSessionId ?? null)
      }
      setShowClassStartWelcome(false)
      return
    }
    setShowClassStartWelcome(true)
  }, [
    isHydrated,
    recordsReady,
    studentId,
    activeClassSessionId,
    profileTick,
    bookOpenPresented,
    openBookOnEnter,
  ])

  /** After the book is shown once in a live class, remember so returns to the shelf stay quiet. */
  useEffect(() => {
    if (!bookOpenPresented) return
    const student = getStudentProfileView(studentId)
    const session = activeClassSessionId
      ? student?.scheduledClasses?.find((s) => s.id === activeClassSessionId)
      : undefined
    if (session?.status !== 'in_progress') return
    writeMapWelcomeConsumed(studentId, activeClassSessionId ?? null)
    setShowClassStartWelcome(false)
  }, [bookOpenPresented, studentId, activeClassSessionId])

  const rewarmTeachingTarget = useCallback(
    (bookId: string, unitId: string) => {
      const student = getStudentProfileView(studentId)
      if (!student) return
      void fetchBooksLibraryCached()
        .then((lib) =>
          warmMapInitialBookSpreadPrefetch({
            library: lib,
            assignedBookIds: student.assignedBookIds ?? [],
            assignedUnitRefs: student.assignedUnitRefs ?? [],
            curriculumHistory: student.curriculumHistory ?? [],
            preferBookId: bookId,
            preferUnitId: unitId,
          preferResumePage: getStudentTeachingOpenPdfPageForBookUnit(studentId, bookId, unitId, lib),
          }),
        )
        .catch(() => {})
    },
    [studentId],
  )

  const handleOpenBook = useCallback(
    (bookId: string, unitId: string) => {
      if (bookOpenPresented) return

      const targetChanged = teachingBookId !== bookId || teachingUnitId !== unitId

      setChosenBookId(bookId)
      setChosenUnitId(unitId)

      if (targetChanged) {
        setBookPagesReady(false)
        rewarmTeachingTarget(bookId, unitId)
      }

      // Teacher tapped Open — show the reader now. Waiting on the warm-ready gate
      // left the cover stuck on "Opening…" when paint had been invalidated on the shelf.
      // The overlay already has its own loading hold until pages are drawable.
      setUserOpenPending(false)
      setBookOpenAttempted(false)
      setBookOpenPresented(true)
    },
    [bookOpenPresented, rewarmTeachingTarget, teachingBookId, teachingUnitId],
  )

  const handleOpenDefaultBook = useCallback(() => {
    const first = launcherCovers[0]
    if (!first) return
    handleOpenBook(first.bookId, first.unitId)
  }, [handleOpenBook, launcherCovers])

  const handleBookReadyToPresent = useCallback(() => {
    setBookPagesReady(true)
  }, [])

  /** After a pending open request, open the book once pages are drawable. */
  useEffect(() => {
    if (!bookOpenAttempted || !bookPagesReady || bookOpenPresented) return
    setBookOpenPresented(true)
    setBookOpenAttempted(false)
    setUserOpenPending(false)
  }, [bookOpenAttempted, bookPagesReady, bookOpenPresented])

  const handleBookPaintInvalidated = useCallback(() => {
    setBookPagesReady(false)
  }, [])

  const handleBookOpenPaintTimeout = useCallback(() => {
    toast.error('The book is taking too long to load. Retrying…')
    clearMapBookOverlayOpenSession(studentId)
    setBookPagesReady(false)
    setBookOpenAttempted(false)
    setUserOpenPending(false)
    setBookOpenPresented(false)
    setBookWarmArmed(false)
    window.requestAnimationFrame(() => setBookWarmArmed(true))
  }, [studentId])

  const handleBookClose = useCallback(() => {
    clearMapBookOverlayOpenSession(studentId)
    setBookOpenPresented(false)
    setBookOpenAttempted(false)
    setUserOpenPending(false)
    setLessonBoardOpen(false)
  }, [studentId])

  const handleClassEndedWrap = useCallback(
    (payload: { sessionId: string; summary: ReadingCheckClassWrapSummary }) => {
      handleBookClose()
      setClassWrapSummary(payload.summary)
      setProfileTick((n) => n + 1)
    },
    [handleBookClose],
  )

  const handleWrapDone = useCallback(() => {
    setClassWrapSummary(null)
    clearMapBookOverlayOpenSession(studentId)
    router.replace('/students')
    router.refresh()
  }, [router, studentId])

  useEffect(() => {
    if (!bookOpenPresented) return
    writeMapBookOverlayOpenSession(studentId)
  }, [bookOpenPresented, studentId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (isBookOverlayKeyboardTypingTarget()) return

      const mod = e.ctrlKey || e.metaKey || e.altKey
      const keyLower = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (keyLower === 'escape' && bookOpenPresented) {
        e.preventDefault()
        clearMapBookOverlayOpenSession(studentId)
        setBookOpenPresented(false)
        setBookOpenAttempted(false)
        setUserOpenPending(false)
        return
      }

      if (
        challengeMapLayerEnabled &&
        !mod &&
        keyLower === MAP_SPELL_BOOK_SHORTCUT_KEY &&
        !bookOpenPresented
      ) {
        e.preventDefault()
        handleOpenDefaultBook()
        return
      }

      if (!mod && keyLower === MAP_STUDENT_REWARD_SHORTCUT_KEY && !bookOpenPresented) {
        if (e.repeat) return
        e.preventDefault()
        triggerReward()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [bookOpenPresented, handleOpenDefaultBook, studentId, triggerReward])

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

  /** Warm covers + first teaching target (URL prefer, else first assigned cover). */
  useEffect(() => {
    if (!isHydrated || !recordsReady) return
    const student = getStudentProfileView(studentId)
    if (!student) return
    void fetchBooksLibraryCached()
      .then((lib) => {
        const planned =
          activeClassSessionId != null
            ? resolveClassTeachingBookUnit(studentId, activeClassSessionId, lib)
            : null
        const todayBookId = planned?.bookId ?? preferBookId?.trim() ?? null
        const todayUnitId = planned?.unitId ?? preferUnitId?.trim() ?? null

        const covers = resolveLauncherBookCovers({
          library: lib,
          assignedBookIds: student.assignedBookIds ?? [],
          assignedUnitRefs: student.assignedUnitRefs ?? [],
        }).map((entry) => {
          const unitId =
            todayBookId && entry.bookId === todayBookId && todayUnitId ? todayUnitId : entry.unitId
          const page = getStudentTeachingOpenPdfPageForBookUnit(studentId, entry.bookId, unitId, lib)
          return {
            ...entry,
            unitId,
            ...(page != null && page >= 1 ? { lastStopLabel: `p. ${page}` } : {}),
            ...(todayBookId && entry.bookId === todayBookId ? { isTodayPlan: true } : {}),
          } satisfies SimpleBookLaunchCover
        })
        setLauncherCovers(covers)

        const warmBookId = preferBookId?.trim() || todayBookId || covers[0]?.bookId || null
        const warmUnitId = preferUnitId?.trim() || todayUnitId || covers[0]?.unitId || null
        if (!warmBookId || !warmUnitId) return

        return warmMapInitialBookSpreadPrefetch({
          library: lib,
          assignedBookIds: student.assignedBookIds ?? [],
          assignedUnitRefs: student.assignedUnitRefs ?? [],
          curriculumHistory: student.curriculumHistory ?? [],
          preferBookId: warmBookId,
          preferUnitId: warmUnitId,
          preferResumePage: getStudentTeachingOpenPdfPageForBookUnit(studentId, warmBookId, warmUnitId, lib),
        })
      })
      .catch(() => {})
    void ensureReactPdfWorker().catch(() => {})
  }, [isHydrated, recordsReady, studentId, preferBookId, preferUnitId, profileTick, activeClassSessionId])

  if (!isHydrated || !recordsReady) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  // profileTick forces re-read after Start class from prep chrome
  void profileTick
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

  const bookOverlayClassSessionId = resolveBookOverlayClassSessionId({
    urlClassSessionId: activeClassSessionId,
    sessions: student.scheduledClasses,
  })

  const isLive = activeSession?.status === 'in_progress'
  const isPrepMode =
    Boolean(activeSession) &&
    (activeSession?.status === 'planned' || activeSession?.status === 'prepared')
  const showClassWrap = classWrapSummary != null

  const shelfTone: BookLaunchShelfTone = showClassWrap
    ? 'wrap'
    : isLive
      ? showClassStartWelcome
        ? 'welcome'
        : 'pick'
      : 'prep'

  /** Welcome / map exit — teacher plan (not the student-facing profile). */
  const mapExitHref = `/students/${encodeURIComponent(studentId)}?tab=classes`

  async function handleSaveAndExitPrep() {
    if (prepExitBusy) return
    setPrepExitBusy('save')
    try {
      await flushAnnotationsForClassEnd()
      clearMapBookOverlayOpenSession(studentId)
      toast.success('Prep saved')
      router.push(`/students/${encodeURIComponent(studentId)}?tab=classes`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save prep.')
      setPrepExitBusy(null)
    }
  }

  function handleExitPrepWithoutSave() {
    if (prepExitBusy) return
    setPrepExitBusy('leave')
    clearMapBookOverlayOpenSession(studentId)
    router.push(`/students/${encodeURIComponent(studentId)}?tab=classes`)
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-0 overflow-hidden overscroll-none',
        FULLSCREEN_CLASS_SCOPE,
        mapBookChromeOpen ? 'bg-[var(--book-reading-mat)]' : 'bg-background',
      )}
    >
      <ClassAutoStartReconciler />
      {isLive && activeSession && !showClassWrap ? (
        <ClassSessionMapTimer
          studentId={student.id}
          studentName={student.name}
          session={activeSession}
          assignedBookIds={student.assignedBookIds ?? []}
          elevated={classChromeElevated}
          onClassEnded={handleClassEndedWrap}
        />
      ) : null}
      {isPrepMode && activeSession && !showClassWrap ? (
        <PrepSessionCapsule
          bookOpen={mapBookChromeOpen}
          checksPrepOpen={checksPrepOpen}
          onOpenChecksPrep={() => setChecksPrepOpen(true)}
          exitBusy={prepExitBusy}
          onSaveAndExit={() => void handleSaveAndExitPrep()}
          onExitWithoutSave={handleExitPrepWithoutSave}
        />
      ) : null}
      {challengeMapLayerEnabled && !showClassWrap ? (
        <div className={mapBookChromeOpen ? 'hidden' : 'relative h-full min-h-0 w-full'}>
          <div className="map-viewport-bottom-shadow" aria-hidden />
          <StudentMapTab key={student.id} student={student} fullscreen introMode={introMode} />
        </div>
      ) : (
        <SimpleBookLaunchShell
          exitHref={mapExitHref}
          studentName={student.name}
          showFirstClassWelcome={student.showFirstClassWelcome}
          shelfTone={shelfTone}
          covers={launcherCovers}
          onOpenBook={handleOpenBook}
          openingBookId={teachingBookId}
          isBookOpeningPending={userOpenPending && !bookOpenPresented}
          hidden={mapBookChromeOpen && !showClassWrap}
          wrapSummary={classWrapSummary}
          onWrapDone={handleWrapDone}
        />
      )}
      {challengeMapLayerEnabled && !showClassWrap ? (
        <FantasyHUD
          exitHref={mapExitHref}
          onOpenBook={handleOpenDefaultBook}
          isBookOverlayOpen={mapBookChromeOpen}
          isBookOpeningPending={userOpenPending && !bookOpenPresented}
        />
      ) : null}
      {isPrepMode && activeSession && !showClassWrap ? (
        <ReadingCheckPrepPanel
          open={checksPrepOpen}
          onOpenChange={setChecksPrepOpen}
          studentId={studentId}
          bookId={teachingBookId ?? preferBookId}
          unitId={teachingUnitId ?? preferUnitId}
        />
      ) : null}
      <FullscreenBookOverlay
        key={student.id}
        studentId={student.id}
        activeClassSessionId={bookOverlayClassSessionId}
        assignedBookIds={student.assignedBookIds}
        assignedUnitRefs={student.assignedUnitRefs}
        curriculumHistory={student.curriculumHistory}
        studentName={student.name}
        isPrepMode={isPrepMode}
        preferBookId={teachingBookId}
        preferUnitId={teachingUnitId}
        open={bookWarmArmed}
        presented={bookOpenPresented}
        onBookReadyToPresent={handleBookReadyToPresent}
        onBookPaintInvalidated={handleBookPaintInvalidated}
        onBookOpenPaintTimeout={handleBookOpenPaintTimeout}
        onLessonBoardOpenChange={setLessonBoardOpen}
        onClose={handleBookClose}
      />
    </div>
  )
}
