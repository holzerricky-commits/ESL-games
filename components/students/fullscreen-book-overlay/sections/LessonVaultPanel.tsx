'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, Play, Settings, Vault, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ClassToolDrawerShell } from '@/components/students/fullscreen-book-overlay/sections/ClassToolDrawerShell'
import { LessonVaultRow } from '@/components/students/fullscreen-book-overlay/sections/LessonVaultRow'
import { VaultFlashcard } from '@/components/students/fullscreen-book-overlay/sections/vault-flashcard'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'
import { readImageFileFromDataTransfer } from '@/lib/books/clipboard-image'
import type { BookLessonRecord } from '@/lib/books/types'
import { isLessonVaultPasteZoneActive, LESSON_VAULT_PASTE_ZONE_ATTR } from '@/lib/lesson-vault/paste-zone'
import { readLessonVaultShowChinese, writeLessonVaultShowChinese } from '@/lib/lesson-vault/show-chinese'
import type { StoryScope } from '@/lib/lesson-vault/story-scope'
import type { LessonVaultCard } from '@/lib/lesson-vault/types'
import { getVaultDrag, LESSON_VAULT_DROP_ATTR, subscribeVaultDrag } from '@/lib/lesson-vault/vault-drag'
import { cn } from '@/lib/utils'

type LessonVaultPanelProps = {
  open: boolean
  onClose: () => void
  hasStudent: boolean
  viewedLesson: BookLessonRecord | null
  cards: LessonVaultCard[]
  /** Unfiltered lesson cards (for All chip count). */
  lessonAllCards: LessonVaultCard[]
  storyScopes: readonly StoryScope[]
  viewedPartId: string | null
  onViewedStoryChange: (partId: string | null) => void
  /** Book part for the page on screen — that section opens by default. */
  pagePartId: string | null
  pageLesson: BookLessonRecord | null
  hasPreviousLesson: boolean
  hasNextLesson: boolean
  onPreviousLesson: () => void
  onNextLesson: () => void
  onShowPageLesson: () => void
  onOpenReview: () => void
  onPictureFile: (card: LessonVaultCard, file: Blob) => Promise<boolean>
  /** Cards with an automatic picture search running. */
  findingIds: ReadonlySet<string>
}

const NAV_BTN =
  'h-7 w-7 shrink-0 cursor-pointer rounded-md text-[#a1a1aa] hover:bg-white/5 hover:text-[#f4f4f5] disabled:opacity-30'

const HEADER_ICON_BTN =
  'h-7 w-7 shrink-0 cursor-pointer rounded-md text-[#71717a] hover:bg-white/5 hover:text-[#f4f4f5]'

/** Same thin rounded thumb as the other class-tool drawers. */
const DRAWER_SCROLL = cn(
  '[scrollbar-width:thin] [scrollbar-color:#52525b_transparent]',
  '[&::-webkit-scrollbar]:w-1.5',
  '[&::-webkit-scrollbar-track]:bg-transparent',
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#52525b]',
)

/** Lesson word bank: peek paper cards; paste/drop pictures; Review for practice and edit. */
export function LessonVaultPanel({
  open,
  onClose,
  hasStudent,
  viewedLesson,
  cards,
  lessonAllCards,
  storyScopes,
  viewedPartId,
  onViewedStoryChange,
  pagePartId,
  pageLesson,
  hasPreviousLesson,
  hasNextLesson,
  onPreviousLesson,
  onNextLesson,
  onShowPageLesson,
  onOpenReview,
  onPictureFile,
  findingIds,
}: LessonVaultPanelProps) {
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [peekFlipped, setPeekFlipped] = useState(false)
  const [showChinese, setShowChinese] = useState(readLessonVaultShowChinese)
  const [collapsedSectionIds, setCollapsedSectionIds] = useState<ReadonlySet<string>>(() => new Set())
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set())
  const pasteTargetIdRef = useRef<string | null>(null)
  const wordDrag = useSyncExternalStore(subscribeVaultDrag, getVaultDrag, () => null)

  function toggleShowChinese(next: boolean) {
    writeLessonVaultShowChinese(next)
    setShowChinese(next)
  }

  function toggleSectionCollapsed(sectionKey: string, sectionCards: readonly LessonVaultCard[]) {
    const collapsing = !collapsedSectionIds.has(sectionKey)
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev)
      if (collapsing) next.add(sectionKey)
      else next.delete(sectionKey)
      return next
    })
    if (collapsing && openCardId != null && sectionCards.some((card) => card.id === openCardId)) {
      setOpenCardId(null)
      setPeekFlipped(false)
    }
  }

  const sortNewestFirst = useCallback(
    (list: readonly LessonVaultCard[]) =>
      [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0)),
    [],
  )

  /** Group by story/vocab part; hide section chrome when there is only one visible group. */
  const cardSections = useMemo(() => {
    const newest = sortNewestFirst(cards)
    const showLabels = storyScopes.length > 1 && viewedPartId == null
    if (!showLabels) {
      return newest.length > 0
        ? [{ partId: viewedPartId ?? storyScopes[0]?.partId ?? '', label: null as string | null, cards: newest }]
        : []
    }
    const byPart = new Map<string, LessonVaultCard[]>()
    const unmatched: LessonVaultCard[] = []
    for (const card of newest) {
      const partId = card.partId.trim()
      if (!partId || !storyScopes.some((scope) => scope.partId === partId)) {
        unmatched.push(card)
        continue
      }
      const list = byPart.get(partId)
      if (list) list.push(card)
      else byPart.set(partId, [card])
    }
    const sections: { partId: string; label: string | null; cards: LessonVaultCard[] }[] = []
    for (const scope of storyScopes) {
      const list = byPart.get(scope.partId)
      if (!list?.length) continue
      sections.push({ partId: scope.partId, label: scope.label, cards: list })
    }
    if (unmatched.length > 0) {
      sections.push({ partId: '', label: 'Other', cards: unmatched })
    }
    return sections
  }, [cards, sortNewestFirst, storyScopes, viewedPartId])

  const sectionKeysWithLabels = useMemo(
    () => cardSections.filter((section) => section.label).map((section) => section.partId || 'other'),
    [cardSections],
  )

  /** Collapse every labeled section except the book part currently on screen. */
  const collapsedForPagePart = useCallback(
    (keys: readonly string[], openPartId: string | null) => {
      const openKey = openPartId?.trim() || ''
      if (keys.length <= 1) return new Set<string>()
      if (!openKey || !keys.includes(openKey)) return new Set<string>()
      return new Set(keys.filter((key) => key !== openKey))
    },
    [],
  )

  useEffect(() => {
    setOpenCardId(null)
    setPeekFlipped(false)
  }, [viewedLesson?.id])

  // Opening the drawer or switching lesson: page part expanded, other stories collapsed.
  useEffect(() => {
    if (!open) return
    setCollapsedSectionIds(collapsedForPagePart(sectionKeysWithLabels, pagePartId))
    // sectionKeys / pagePartId from this render; do not re-run when cards alone change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lesson/open are the intentional triggers
  }, [open, viewedLesson?.id, collapsedForPagePart])

  // Turning pages: keep the current book part open without collapsing others the teacher opened.
  useEffect(() => {
    const openKey = pagePartId?.trim() || ''
    if (!openKey) return
    setCollapsedSectionIds((prev) => {
      if (!prev.has(openKey)) return prev
      const next = new Set(prev)
      next.delete(openKey)
      return next
    })
  }, [pagePartId])

  const [freshIds, setFreshIds] = useState<ReadonlySet<string>>(() => new Set())
  const freshTimerRef = useRef<number | null>(null)
  const seenRef = useRef<{ lessonId: string | null; ids: Set<string> }>({ lessonId: null, ids: new Set() })
  useEffect(() => {
    const lessonId = viewedLesson?.id ?? null
    const ids = new Set(cards.map((c) => c.id))
    const seen = seenRef.current
    seenRef.current = { lessonId, ids }
    if (seen.lessonId !== lessonId) return
    const added = cards.filter((c) => !seen.ids.has(c.id)).map((c) => c.id)
    if (added.length === 0) return
    setFreshIds(new Set(added))
    if (freshTimerRef.current) window.clearTimeout(freshTimerRef.current)
    freshTimerRef.current = window.setTimeout(() => setFreshIds(new Set()), 900)
  }, [cards, viewedLesson?.id])
  useEffect(
    () => () => {
      if (freshTimerRef.current) window.clearTimeout(freshTimerRef.current)
    },
    [],
  )

  const storePictureFile = useCallback(
    async (card: LessonVaultCard, file: Blob) => {
      setBusyIds((prev) => new Set(prev).add(card.id))
      try {
        await onPictureFile(card, file)
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(card.id)
          return next
        })
      }
    },
    [onPictureFile],
  )

  useEffect(() => {
    if (!open) return
    function onPaste(e: ClipboardEvent) {
      if (!e.clipboardData || !isLessonVaultPasteZoneActive()) return
      if (isBookOverlayKeyboardTypingTarget()) return
      const file = readImageFileFromDataTransfer(e.clipboardData)
      if (!file) return
      const focusedId =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>('[data-vault-card-id]')?.dataset.vaultCardId
          : undefined
      const targetId = focusedId ?? pasteTargetIdRef.current ?? openCardId
      const card = cards.find((c) => c.id === targetId)
      e.preventDefault()
      if (!card) {
        toast.message('Point at a card, then paste.')
        return
      }
      void storePictureFile(card, file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [open, cards, storePictureFile, openCardId])

  useEffect(() => {
    if (!open || openCardId == null) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape' || isBookOverlayKeyboardTypingTarget()) return
      e.preventDefault()
      e.stopPropagation()
      setOpenCardId(null)
      setPeekFlipped(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open, openCardId])

  const pageIsOtherLesson = pageLesson != null && viewedLesson != null && pageLesson.id !== viewedLesson.id
  const openCard = openCardId != null ? cards.find((c) => c.id === openCardId) : null
  const canFocusStory = storyScopes.length > 1
  const focusedScope =
    viewedPartId != null ? storyScopes.find((scope) => scope.partId === viewedPartId) ?? null : null
  const hasList = hasStudent && viewedLesson != null && cards.length > 0

  const settingsMenu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(HEADER_ICON_BTN, focusedScope != null && 'text-sky-300 hover:text-sky-200')}
          aria-label="Vault settings"
          title="Vault settings"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="dark z-[60] min-w-[13.5rem] border-white/10 bg-[#1c1c21] text-[#f4f4f5]"
      >
        <DropdownMenuLabel className="text-xs font-normal text-white/45">Display</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={showChinese}
          onCheckedChange={(checked) => toggleShowChinese(checked === true)}
          className="focus:bg-white/10 focus:text-white"
        >
          Show Chinese
        </DropdownMenuCheckboxItem>
        {canFocusStory ? (
          <>
            <DropdownMenuSeparator className="bg-white/10" />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="focus:bg-white/10 focus:text-white data-[state=open]:bg-white/10">
                Focus story
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="dark z-[70] min-w-[12rem] border-white/10 bg-[#1c1c21] text-[#f4f4f5]">
                <DropdownMenuRadioGroup
                  value={viewedPartId ?? 'all'}
                  onValueChange={(value) => onViewedStoryChange(value === 'all' ? null : value)}
                >
                  <DropdownMenuRadioItem value="all" className="gap-2 focus:bg-white/10 focus:text-white">
                    <span className="flex-1">All stories</span>
                    <span className="tabular-nums text-white/45">{lessonAllCards.length}</span>
                  </DropdownMenuRadioItem>
                  {storyScopes.map((scope) => (
                    <DropdownMenuRadioItem
                      key={scope.partId}
                      value={scope.partId}
                      className="gap-2 focus:bg-white/10 focus:text-white"
                    >
                      <span className="min-w-0 flex-1 truncate">{scope.label}</span>
                      <span className="shrink-0 tabular-nums text-white/45">{scope.count}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
        <DropdownMenuSeparator className="bg-white/10" />
        <p className="px-2 py-1.5 text-[11px] leading-snug text-white/35">
          Chinese applies to vault rows, card peek, and Review.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <ClassToolDrawerShell
      open={open}
      onClose={onClose}
      title="Vault"
      icon={Vault}
      ariaLabel="Words saved for this lesson"
      headerActions={settingsMenu}
      headerExtra={
        viewedLesson ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={NAV_BTN}
                disabled={!hasPreviousLesson}
                onClick={onPreviousLesson}
                aria-label="Previous lesson"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-[#f4f4f5]">
                {viewedLesson.title}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={NAV_BTN}
                disabled={!hasNextLesson}
                onClick={onNextLesson}
                aria-label="Next lesson"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {pageIsOtherLesson ? (
              <div className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2.5 py-1">
                <p className="min-w-0 truncate text-[11px] text-white/55">Page is on {pageLesson.title}</p>
                <button
                  type="button"
                  className="shrink-0 cursor-pointer text-[11px] font-medium text-sky-300 hover:text-sky-200"
                  onClick={onShowPageLesson}
                >
                  Show this page
                </button>
              </div>
            ) : null}
          </div>
        ) : null
      }
    >
      <div
        className={cn(
          'relative flex min-h-0 flex-1 flex-col transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none',
          wordDrag && 'shadow-[inset_0_0_0_2px_rgba(56,189,248,0.35)]',
          wordDrag?.overVault && 'bg-sky-500/10 shadow-[inset_0_0_0_2px_rgba(56,189,248,0.9)]',
        )}
        {...{ [LESSON_VAULT_PASTE_ZONE_ATTR]: '', [LESSON_VAULT_DROP_ATTR]: '' }}
      >
        {!hasStudent ? (
          <p className="px-4 pt-2 text-sm text-white/55">Open a student session to use the vault.</p>
        ) : !viewedLesson ? (
          <p className="px-4 pt-2 text-sm text-white/55">
            This page is not part of a lesson yet. Outline the book to use the vault.
          </p>
        ) : cards.length === 0 ? (
          <p className="px-4 pt-2 text-sm leading-relaxed text-white/55">
            No words yet. In Select mode, click a word on the page and choose Save to vault.
          </p>
        ) : (
          <>
            {openCard ? (
              <div
                data-vault-card-id={openCard.id}
                className="relative shrink-0 border-b border-black/40 animate-in fade-in slide-in-from-top-2 duration-200 motion-reduce:animate-none"
                style={{
                  background:
                    'linear-gradient(180deg, #3a342c 0%, #2c2924 48%, #23211e 100%)',
                  boxShadow: 'inset 0 -12px 24px rgba(0,0,0,0.28)',
                }}
                onPointerEnter={() => {
                  pasteTargetIdRef.current = openCard.id
                }}
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8DFC8]/35 to-transparent"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(ellipse 90% 80% at 50% 20%, rgba(246,242,233,0.22) 0%, transparent 60%)',
                  }}
                  aria-hidden
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-black/25 text-[#E8DFC8]/70 ring-1 ring-white/10 hover:bg-black/40 hover:text-[#F6F2E9]"
                  aria-label={`Close ${openCard.word}`}
                  title="Close"
                  onClick={() => {
                    setOpenCardId(null)
                    setPeekFlipped(false)
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
                <div className="relative flex w-full justify-center px-4 py-4">
                  <div className="rounded-[18px] p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45),0_0_0_1px_rgba(232,223,200,0.12)]">
                    <VaultFlashcard
                      card={openCard}
                      size="small"
                      flipped={peekFlipped}
                      label={`${openCard.word}. Click to turn over. Esc to close.`}
                      onActivate={() => setPeekFlipped((f) => !f)}
                      showMeaning={showChinese}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            <div
              className={cn(
                'min-h-0 flex-1 overflow-y-auto px-4 pb-20',
                DRAWER_SCROLL,
                openCard ? 'pt-3' : 'pt-2',
              )}
            >
              {!openCard ? (
                <p className="pb-2 text-xs text-white/35">
                  Open a word to peek · hover + Ctrl+V to paste · edit in Review
                </p>
              ) : null}
              {focusedScope ? (
                <div className="mb-2 flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs text-white/55">
                    Showing <span className="font-medium text-white/80">{focusedScope.label}</span>
                  </p>
                  <button
                    type="button"
                    className="shrink-0 cursor-pointer text-xs font-medium text-sky-300 hover:text-sky-200"
                    onClick={() => onViewedStoryChange(null)}
                  >
                    Show all
                  </button>
                </div>
              ) : null}
              <div className="flex flex-col gap-4">
                {cardSections.map((section) => {
                  const sectionKey = section.partId || 'other'
                  const collapsed = Boolean(section.label) && collapsedSectionIds.has(sectionKey)
                  return (
                    <section key={sectionKey} className="flex flex-col gap-1.5">
                      {section.label ? (
                        <button
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md px-0.5 py-0.5 text-left hover:bg-white/[0.04]"
                          aria-expanded={!collapsed}
                          onClick={() => toggleSectionCollapsed(sectionKey, section.cards)}
                        >
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 shrink-0 text-white/35 transition-transform duration-150 motion-reduce:transition-none',
                              collapsed && '-rotate-90',
                            )}
                            aria-hidden
                          />
                          <h3 className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                            {section.label}
                          </h3>
                          <span className="shrink-0 text-[11px] tabular-nums text-white/30">{section.cards.length}</span>
                        </button>
                      ) : null}
                      {!collapsed ? (
                        <ul className="flex flex-col gap-1.5">
                          {section.cards.map((card) => {
                            const setPasteTarget = () => {
                              pasteTargetIdRef.current = card.id
                            }
                            const selected = openCardId === card.id
                            return (
                              <li key={card.id}>
                                <LessonVaultRow
                                  card={card}
                                  selected={selected}
                                  showChinese={showChinese}
                                  onOpen={() => {
                                    if (selected) {
                                      setOpenCardId(null)
                                      setPeekFlipped(false)
                                      return
                                    }
                                    setOpenCardId(card.id)
                                    setPeekFlipped(false)
                                  }}
                                  onPictureFile={(file) => void storePictureFile(card, file)}
                                  onPasteTarget={setPasteTarget}
                                  pictureBusy={busyIds.has(card.id)}
                                  finding={findingIds.has(card.id)}
                                  fresh={freshIds.has(card.id)}
                                />
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {hasList ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#2a2a2e] via-[#2a2a2e]/95 to-transparent px-4 pb-4 pt-8">
            <button
              type="button"
              className="pointer-events-auto flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-sky-500 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(14,165,233,0.35)] hover:bg-sky-400"
              onClick={onOpenReview}
            >
              <Play className="h-4 w-4" aria-hidden />
              Review {cards.length} {cards.length === 1 ? 'word' : 'words'}
            </button>
          </div>
        ) : null}
      </div>
    </ClassToolDrawerShell>
  )
}
