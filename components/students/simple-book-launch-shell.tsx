'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { useEffect } from 'react'
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react'
import { BookCoverMockup } from '@/components/books/book-cover-mockup'
import { BookCoverMockupArt } from '@/components/books/book-cover-mockup-art'
import { CachedBookImage } from '@/components/books/cached-book-image'
import { bookCoverImageUrl } from '@/lib/books/book-cover-display'
import { bookOverlayMaterialBgTextureEnabled } from '@/lib/books/feature-flags'
import { PDF_HERO_THUMB_WIDTH } from '@/lib/books/pdf-thumbnail-cache'
import { WelcomeCelebrationLayer } from '@/components/students/welcome-celebration-layer'
import { CLASS_LAUNCH_BTN } from '@/components/students/fullscreen-book-overlay/constants'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import {
  classroomHomeCoverAction,
  classroomHomeCoverMeta,
  splitClassroomHomeCovers,
} from '@/lib/students/classroom-home-covers'
import { type ClassroomHomeGoalLine } from '@/lib/students/classroom-home-goals'
import { ClassroomHomeTodayLesson } from '@/components/students/classroom-home-today-lesson'
import { ClassroomHomeReviewCard } from '@/components/students/classroom-home-review'
import {
  ClassroomHomeLastTime,
  ClassroomHomeStreakChip,
} from '@/components/students/classroom-home-continuity'
import {
  classroomHomeShouldShowStreak,
  type ClassroomHomeLastTime as ClassroomHomeLastTimeData,
} from '@/lib/students/classroom-home-continuity'
import {
  classroomHomeReviewHasExtras,
  type ClassroomHomeReview,
} from '@/lib/students/classroom-home-review'
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
  /** Planned book for this class — leads the Continue card. */
  isTodayPlan?: boolean
  /** Current unit name (e.g. "Unit 3"). */
  unitLabel?: string
  /** Current lesson / part name when known. */
  lessonLabel?: string
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
  onWrapDone?: () => void
  /** When set, Exit/Back runs this instead of navigating to `exitHref`. */
  onExit?: () => void
  exitLabel?: string
  todayLesson?: {
    contextLine: string | null
    lines: ClassroomHomeGoalLine[]
  } | null
  lastTime?: ClassroomHomeLastTimeData | null
  streakCount?: number
  review?: ClassroomHomeReview | null
}

function getStudentFirstName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  if (!trimmed) return null
  const first = trimmed.split(/\s+/)[0]
  return first || trimmed
}

function studentGreeting(displayName: string | null, firstClass: boolean): { aria: string; header: ReactNode } {
  const kicker = firstClass ? 'Welcome,' : 'Welcome back,'
  const solo = firstClass ? 'Welcome' : 'Welcome back'
  const aria = displayName ? `${kicker.replace(/,$/, '')} ${displayName}` : solo
  const header = displayName ? (
    <>
      <p className="book-launch-welcome__kicker">{kicker}</p>
      <p className="book-launch-welcome__name">{displayName}</p>
    </>
  ) : (
    <p className="book-launch-welcome__name book-launch-welcome__name--solo">{solo}</p>
  )
  return { aria, header }
}

function CoverButton({
  cover,
  layout,
  isPending,
  dimmed = false,
  shortcutHint,
  showTodayBadge = false,
  showAction = false,
  onOpen,
}: {
  cover: SimpleBookLaunchCover
  layout: 'feature' | 'row'
  isPending: boolean
  dimmed?: boolean
  shortcutHint?: string
  showTodayBadge?: boolean
  showAction?: boolean
  onOpen: () => void
}) {
  const isFeature = layout === 'feature'
  const widthPx = isFeature
    ? Math.round(PDF_HERO_THUMB_WIDTH * 1.08)
    : Math.round(PDF_HERO_THUMB_WIDTH * 0.82)
  const action = classroomHomeCoverAction(cover)
  const meta = classroomHomeCoverMeta(cover)
  const openLabel = isPending
    ? `Opening ${cover.bookTitle}`
    : shortcutHint
      ? `${action} ${cover.bookTitle} (${shortcutHint})`
      : `${action} ${cover.bookTitle}`

  return (
    <button
      type="button"
      aria-label={openLabel}
      aria-busy={isPending}
      disabled={isPending || dimmed}
      onClick={onOpen}
      title={isPending || dimmed ? undefined : `${openLabel} · Esc to close`}
      className={cn(
        'book-launch-cover-btn group flex flex-col items-center transition-transform duration-200',
        isFeature ? 'book-launch-cover-btn--feature gap-3.5' : 'max-w-[min(42vw,240px)] gap-3',
        isPending && 'book-launch-cover-btn--opening',
        dimmed && 'pointer-events-none opacity-40',
      )}
    >
      {isFeature && !cover.isTodayPlan && action === 'Continue' ? (
        <span className="book-launch-feature__kicker">Continue lesson</span>
      ) : null}
      <span className="relative inline-block shrink-0">
        <BookCoverMockup widthPx={widthPx} interactive>
          {cover.imagePath ? (
            <CachedBookImage
              src={bookCoverImageUrl(cover.imagePath)}
              className="book-cover-mockup__art"
            />
          ) : (
            <BookCoverMockupArt
              filePath={cover.filePath}
              pageNumber={1}
              label={cover.bookTitle}
            />
          )}
        </BookCoverMockup>
        {showTodayBadge ? (
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
      <span
        className={cn(
          'flex flex-col items-center text-center',
          isFeature ? 'max-w-[min(80vw,22rem)] gap-1.5' : 'max-w-[min(70vw,320px)] gap-0.5',
        )}
      >
        <span
          className={cn(
            'truncate font-semibold text-[#5c3d0a] drop-shadow-sm',
            isFeature ? 'text-base sm:text-lg' : 'text-sm',
          )}
        >
          {cover.bookTitle}
        </span>
        {isPending ? (
          <span className="text-xs font-semibold text-[#5c3d0a]/85">Opening…</span>
        ) : meta ? (
          <span className="text-xs font-medium leading-snug text-[#5c3d0a]/70">{meta}</span>
        ) : null}
        {(isFeature || showAction) && !isPending ? (
          <span className={cn('book-launch-cover-btn__action', isFeature && 'book-launch-cover-btn__action--feature')}>
            {action}
          </span>
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
  onWrapDone,
  onExit,
  exitLabel = 'Exit',
  todayLesson = null,
  lastTime = null,
  streakCount = 0,
  review = null,
}: SimpleBookLaunchShellProps) {
  const isWrap = shelfTone === 'wrap'
  const isHome = shelfTone === 'prep' || shelfTone === 'welcome'
  const isQuietShelf = shelfTone === 'pick'
  const useHomeChrome = isHome || isWrap

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
  const greeting = studentGreeting(displayName, showFirstClassWelcome)

  let header: ReactNode
  let welcomeAria: string

  if (shelfTone === 'pick') {
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
    welcomeAria = greeting.aria
    header = greeting.header
  }

  const todayCover = covers.find((c) => c.isTodayPlan)
  const primaryBookId = (todayCover ?? covers[0])?.bookId
  const secondaryBookId = covers.find((c) => c.bookId !== primaryBookId)?.bookId
  const homeSplit = isHome ? splitClassroomHomeCovers(covers) : { featured: null, others: covers }
  const showStreak = (isHome || isWrap) && classroomHomeShouldShowStreak(streakCount)
  const showLastTime = isHome && lastTime != null
  const showReview = isWrap && review != null && classroomHomeReviewHasExtras(review)

  function renderCover(
    cover: SimpleBookLaunchCover,
    layout: 'feature' | 'row',
    options?: { showTodayBadge?: boolean; showAction?: boolean },
  ) {
    const isPending = isBookOpeningPending && openingBookId === cover.bookId
    const shortcutHint =
      cover.bookId === primaryBookId ? 'B' : cover.bookId === secondaryBookId ? '2' : undefined
    return (
      <CoverButton
        key={cover.bookId}
        cover={cover}
        layout={layout}
        isPending={isPending}
        dimmed={isBookOpeningPending && !isPending}
        shortcutHint={shortcutHint}
        showTodayBadge={options?.showTodayBadge}
        showAction={options?.showAction}
        onOpen={() => onOpenBook?.(cover.bookId, cover.unitId)}
      />
    )
  }

  const emptyBook = (
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
  )

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
        onExit ? (
          <button
            type="button"
            onClick={onExit}
            aria-label={exitLabel}
            className={cn(
              CLASS_LAUNCH_BTN,
              'absolute left-4 top-4 z-10 inline-flex items-center gap-2 px-3.5 py-1.5 text-sm',
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {exitLabel}
          </button>
        ) : (
          <Link
            href={exitHref}
            aria-label="Exit lesson screen"
            className={cn(
              CLASS_LAUNCH_BTN,
              'absolute left-4 top-4 z-10 inline-flex items-center gap-2 px-3.5 py-1.5 text-sm',
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Exit
          </Link>
        )
      ) : null}

      <div
        className={cn(
          'book-launch-stage',
          useHomeChrome && 'book-launch-stage--home',
          isQuietShelf && 'book-launch-stage--shelf',
        )}
      >
        <header
          className={cn(
            'book-launch-welcome',
            useHomeChrome && 'book-launch-welcome--home',
            isQuietShelf && 'book-launch-welcome--shelf',
          )}
          aria-label={welcomeAria}
        >
          {header}
        </header>

        {showStreak ? (
          <ClassroomHomeStreakChip count={streakCount} encourage={isHome} />
        ) : null}

        {isWrap ? (
          <div className="book-launch-wrap pointer-events-auto flex flex-col items-center gap-6">
            {showReview && review ? <ClassroomHomeReviewCard review={review} /> : null}
            <button
              type="button"
              className={cn(CLASS_LAUNCH_BTN, 'min-w-[10rem] px-8 py-2.5 text-base')}
              onClick={() => onWrapDone?.()}
            >
              Done
            </button>
          </div>
        ) : isHome ? (
          <div className="book-launch-home-split">
            <div className="book-launch-home-plan">
              <ClassroomHomeTodayLesson
                contextLine={todayLesson?.contextLine ?? null}
                lines={todayLesson?.lines ?? []}
              />
              {showLastTime && lastTime ? <ClassroomHomeLastTime lastTime={lastTime} /> : null}
            </div>
            <div className="book-launch-home-books" aria-label="Books">
              {covers.length === 0
                ? emptyBook
                : (homeSplit.featured
                    ? [homeSplit.featured, ...homeSplit.others]
                    : homeSplit.others
                  ).map((cover) =>
                    renderCover(cover, 'row', {
                      showAction: true,
                      showTodayBadge: covers.length > 1 && Boolean(cover.isTodayPlan),
                    }),
                  )}
            </div>
          </div>
        ) : covers.length === 0 ? (
          <div className="book-launch-book">{emptyBook}</div>
        ) : (
          <div className={cn('book-launch-book', covers.length > 1 && 'book-launch-book--multi')}>
            {covers.map((cover) =>
              renderCover(cover, 'row', {
                showTodayBadge: covers.length > 1 && Boolean(cover.isTodayPlan),
                showAction: false,
              }),
            )}
          </div>
        )}
      </div>
    </div>
  )
}
