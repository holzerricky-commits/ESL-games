'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { BookCoverMockup } from '@/components/books/book-cover-mockup'
import { BookCoverMockupArt } from '@/components/books/book-cover-mockup-art'
import { Button } from '@/components/ui/button'
import { makeUnitFileUrl } from '@/components/students/fullscreen-book-overlay/constants'
import { bookCoverImageUrl } from '@/lib/books/book-cover-display'
import { bookOverlayMaterialBgTextureEnabled } from '@/lib/books/feature-flags'
import { ensureReactPdfWorker } from '@/lib/books/ensure-react-pdf-worker'
import { PDF_HERO_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import type { ReadingCheckClassWrapSummary } from '@/lib/books/reading-check-live-marks'
import { WelcomeCelebrationLayer } from '@/components/students/welcome-celebration-layer'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { cn } from '@/lib/utils'

export interface SimpleBookLaunchCover {
  bookId: string
  unitId: string
  filePath: string
  cacheUnitId: string
  bookTitle: string
  /** When set, shown instead of PDF page 1. */
  imagePath?: string
  /** Short resume hint under the title (e.g. "p. 42"). */
  lastStopLabel?: string
  /** Planned book for this class — soft "Today" hint on the cover. */
  isTodayPlan?: boolean
}

/** prep = teacher-only; welcome = student ceremony; pick = mid-class shelf; wrap = end-of-class goodbye. */
export type BookLaunchShelfTone = 'prep' | 'welcome' | 'pick' | 'wrap'

interface SimpleBookLaunchShellProps {
  exitHref: string
  studentName?: string | null
  /** When true, greet as a first-time student ("Welcome") instead of "Welcome back". */
  showFirstClassWelcome?: boolean
  /** Shelf headline tone. Defaults to welcome ceremony. */
  shelfTone?: BookLaunchShelfTone
  covers?: SimpleBookLaunchCover[]
  onOpenBook?: (bookId: string, unitId: string) => void
  /** Book id currently loading / opening (shows spinner on that cover). */
  openingBookId?: string | null
  isBookOpeningPending?: boolean
  hidden?: boolean
  /** End-of-class reading-check summary (shown when shelfTone is wrap). */
  wrapSummary?: ReadingCheckClassWrapSummary | null
  onWrapDone?: () => void
}

function getStudentFirstName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const first = trimmed.split(/\s+/)[0]
  return first || trimmed
}

function CoverButton({
  cover,
  pdfReady,
  multi,
  isPending,
  shortcutHint,
  onOpen,
}: {
  cover: SimpleBookLaunchCover
  pdfReady: boolean
  multi: boolean
  isPending: boolean
  shortcutHint?: string
  onOpen: () => void
}) {
  const widthPx = multi ? Math.round(PDF_HERO_THUMB_WIDTH * 0.82) : PDF_HERO_THUMB_WIDTH
  const openLabel = isPending
    ? `Opening ${cover.bookTitle}`
    : shortcutHint
      ? `Open ${cover.bookTitle} (${shortcutHint})`
      : `Open ${cover.bookTitle}`

  return (
    <button
      type="button"
      aria-label={openLabel}
      aria-busy={isPending}
      disabled={isPending}
      onClick={onOpen}
      title={isPending ? undefined : `${openLabel} · Esc to close`}
      className={cn(
        'book-launch-cover-btn group flex flex-col items-center gap-3 transition-transform duration-200',
        multi ? 'max-w-[min(42vw,240px)]' : 'max-w-[min(56vw,300px)]',
        isPending && 'book-launch-cover-btn--opening',
      )}
    >
      <span className="relative inline-block shrink-0">
        <BookCoverMockup widthPx={widthPx} interactive>
          {cover.imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element -- local book-library cover
            <img
              src={bookCoverImageUrl(cover.imagePath)}
              alt=""
              className="book-cover-mockup__art"
              draggable={false}
            />
          ) : (
            <BookCoverMockupArt
              fileUrl={makeUnitFileUrl(cover.filePath)}
              unitId={cover.cacheUnitId}
              pageNumber={1}
              width={widthPx}
              pdfReady={pdfReady}
              label={cover.bookTitle}
              eager
            />
          )}
        </BookCoverMockup>
        {multi && cover.isTodayPlan ? (
          <span
            className="book-launch-cover-btn__today pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-[145%]"
            role="note"
          >
            Today
          </span>
        ) : null}
        {isPending ? (
          <span
            className="pointer-events-none absolute left-0 top-0 z-10 flex items-center justify-center"
            style={{ width: widthPx, bottom: '1.25rem' }}
          >
            <Loader2 className="h-10 w-10 animate-spin text-[#5c3d0a] drop-shadow-md" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="flex max-w-[min(70vw,320px)] flex-col items-center gap-0.5 text-center">
        <span className="truncate text-sm font-semibold text-[#5c3d0a] drop-shadow-sm">{cover.bookTitle}</span>
        {isPending ? (
          <span className="text-xs font-semibold text-[#5c3d0a]/85">Opening…</span>
        ) : cover.lastStopLabel ? (
          <span className="text-xs font-medium text-[#5c3d0a]/70">{cover.lastStopLabel}</span>
        ) : null}
      </span>
    </button>
  )
}

export function SimpleBookLaunchShell({
  exitHref,
  studentName = null,
  showFirstClassWelcome = false,
  shelfTone = 'welcome',
  covers = [],
  onOpenBook,
  openingBookId = null,
  isBookOpeningPending = false,
  hidden = false,
  wrapSummary = null,
  onWrapDone,
}: SimpleBookLaunchShellProps) {
  const [pdfReady, setPdfReady] = useState(false)
  const isWrap = shelfTone === 'wrap'

  useEffect(() => {
    let cancelled = false
    void ensureReactPdfWorker().then(() => {
      if (!cancelled) setPdfReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (hidden || isWrap || !onOpenBook) return
    const openBook = onOpenBook
    const todayCover = covers.find((c) => c.isTodayPlan)
    const primary = todayCover ?? covers[0]
    const secondary = covers.find((c) => c.bookId !== primary?.bookId) ?? covers[1]

    function onKeyDown(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      if (isBookOverlayKeyboardTypingTarget()) return
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if ((key === 'b' || key === '1') && primary) {
        e.preventDefault()
        openBook(primary.bookId, primary.unitId)
        return
      }

      if (key === '2' && secondary) {
        e.preventDefault()
        openBook(secondary.bookId, secondary.unitId)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hidden, isWrap, onOpenBook, covers])

  const displayName = getStudentFirstName(studentName)
  const isCeremony = shelfTone === 'welcome'
  const isQuietShelf = shelfTone === 'prep' || shelfTone === 'pick'
  const attempted = wrapSummary?.attempted ?? 0

  let header: ReactNode
  let welcomeAria: string

  if (shelfTone === 'prep') {
    welcomeAria = 'Prep'
    header = <p className="book-launch-welcome__name book-launch-welcome__name--solo">Prep</p>
  } else if (shelfTone === 'pick') {
    welcomeAria = displayName ? `${displayName}'s books` : 'Books'
    header = (
      <p className="book-launch-welcome__name book-launch-welcome__name--solo">
        {displayName ? `${displayName}'s books` : 'Books'}
      </p>
    )
  } else if (shelfTone === 'wrap') {
    welcomeAria = displayName ? `Great work, ${displayName}` : 'Great work today'
    header = displayName ? (
      <>
        <p className="book-launch-welcome__kicker">Great work,</p>
        <p className="book-launch-welcome__name">{displayName}</p>
      </>
    ) : (
      <p className="book-launch-welcome__name book-launch-welcome__name--solo">Great work today</p>
    )
  } else {
    const welcomeKicker = showFirstClassWelcome ? 'Welcome,' : 'Welcome back,'
    welcomeAria = displayName
      ? showFirstClassWelcome
        ? `Welcome, ${displayName}`
        : `Welcome back, ${displayName}`
      : showFirstClassWelcome
        ? 'Welcome'
        : 'Welcome back'
    const welcomeSolo = showFirstClassWelcome ? 'Welcome' : 'Welcome back'
    header = displayName ? (
      <>
        <p className="book-launch-welcome__kicker">{welcomeKicker}</p>
        <p className="book-launch-welcome__name">{displayName}</p>
      </>
    ) : (
      <p className="book-launch-welcome__name book-launch-welcome__name--solo">{welcomeSolo}</p>
    )
  }

  const multi = covers.length > 1
  const todayCover = covers.find((c) => c.isTodayPlan)
  const primaryBookId = (todayCover ?? covers[0])?.bookId
  const secondaryBookId = covers.find((c) => c.bookId !== primaryBookId)?.bookId

  return (
    <div
      className={cn(
        'relative h-full min-h-0 w-full overflow-hidden',
        hidden && 'hidden',
      )}
    >
      <div
        className={cn(
          'book-overlay-material-bg absolute inset-0',
          bookOverlayMaterialBgTextureEnabled && 'book-overlay-material-bg--textured',
        )}
        aria-hidden
      />

      <WelcomeCelebrationLayer active={isCeremony && showFirstClassWelcome} />

      {!isWrap ? (
        <Link
          href={exitHref}
          aria-label="Exit lesson screen"
          className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-full border border-[#b48218]/40 bg-[#eab333]/80 px-3 py-1.5 text-sm font-semibold text-[#5c3d0a] shadow-sm backdrop-blur-sm transition hover:bg-[#f0c040]/90 active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Exit
        </Link>
      ) : null}

      <div className={cn('book-launch-stage', isQuietShelf && 'book-launch-stage--shelf')}>
        <header
          className={cn('book-launch-welcome', isQuietShelf && 'book-launch-welcome--shelf')}
          aria-label={welcomeAria}
        >
          {header}
        </header>

        {isWrap ? (
          <div className="book-launch-wrap pointer-events-auto flex flex-col items-center gap-8">
            {attempted > 0 && wrapSummary ? (
              <div className="book-launch-wrap__stats flex flex-col items-center gap-3 text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5c3d0a]/70">
                  Reading checks today
                </p>
                <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-10">
                  <div>
                    <p className="text-5xl font-bold tabular-nums text-emerald-800 sm:text-6xl">
                      {wrapSummary.correct}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#5c3d0a]/80">right</p>
                  </div>
                  {wrapSummary.incorrect > 0 ? (
                    <div>
                      <p className="text-5xl font-bold tabular-nums text-rose-800 sm:text-6xl">
                        {wrapSummary.incorrect}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5c3d0a]/80">miss</p>
                    </div>
                  ) : null}
                  {wrapSummary.skip > 0 ? (
                    <div>
                      <p className="text-5xl font-bold tabular-nums text-[#5c3d0a]/70 sm:text-6xl">
                        {wrapSummary.skip}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#5c3d0a]/80">skip</p>
                    </div>
                  ) : null}
                </div>
                <p className="max-w-md text-base font-medium text-[#5c3d0a]/85">
                  {wrapSummary.totalInPack != null && wrapSummary.totalInPack > 0
                    ? `${wrapSummary.attempted} of ${wrapSummary.totalInPack} for this story — more next time`
                    : `${wrapSummary.attempted} check${wrapSummary.attempted === 1 ? '' : 's'} today`}
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="min-w-[10rem] rounded-full border border-[#b48218]/40 bg-[#eab333] px-8 text-base font-semibold text-[#5c3d0a] shadow-sm hover:bg-[#f0c040]"
              onClick={() => onWrapDone?.()}
            >
              Done
            </Button>
          </div>
        ) : (
          <div className={cn('book-launch-book', multi && 'book-launch-book--multi')}>
            {covers.length > 0 ? (
              covers.map((cover) => {
                const isPending = isBookOpeningPending && openingBookId === cover.bookId
                const shortcutHint =
                  cover.bookId === primaryBookId
                    ? 'B'
                    : cover.bookId === secondaryBookId
                      ? '2'
                      : undefined
                return (
                  <CoverButton
                    key={cover.bookId}
                    cover={cover}
                    pdfReady={pdfReady}
                    multi={multi}
                    isPending={isPending}
                    shortcutHint={shortcutHint}
                    onOpen={() => onOpenBook?.(cover.bookId, cover.unitId)}
                  />
                )
              })
            ) : (
              <button
                type="button"
                aria-label={isBookOpeningPending ? 'Loading book' : 'Open book (B)'}
                aria-busy={isBookOpeningPending}
                disabled
                className="group flex max-w-[min(56vw,300px)] flex-col items-center gap-3 disabled:pointer-events-none disabled:opacity-90"
              >
                <span className="relative w-[min(48vw,260px)] shrink-0">
                  <BookCoverMockup widthPx={PDF_HERO_THUMB_WIDTH} interactive>
                    <div className="book-cover-mockup__fallback">
                      <BookOpen className="h-10 w-10 opacity-60" aria-hidden />
                      <span className="book-cover-mockup__fallback-label">No book assigned</span>
                    </div>
                  </BookCoverMockup>
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
