'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import {
  DismissibleScanNotice,
  type ScanNotice,
} from '@/components/books/dismissible-scan-notice'
import { CHECKS_DIALOG_STYLE } from '@/components/books/checks-editor-theme'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  isLessonFrameReady,
  joinLessonFrameTeachingNotes,
  lessonFrameHasContent,
  lessonFrameSectionCardPreview,
  lessonFrameSectionKind,
  lessonFrameSectionPageLabel,
  lessonFrameSectionShortLabel,
  lessonFrameStatusLabel,
  lessonFrameSummaryLine,
  splitLessonFrameTeachingNotes,
  type LessonFrameRecord,
  type LessonFrameScannedSection,
} from '@/lib/books/lesson-frame'
import type { LessonFrameSection } from '@/lib/books/lesson-frame-pages'
import { cn } from '@/lib/utils'

export interface LessonFrameFuelPanelProps {
  bookId: string
  unitId: string
  lessonId: string
  lessonTitle?: string | null
  frame: LessonFrameRecord | null
  onFrameChange: (frame: LessonFrameRecord | null) => void
  totalPdfPages?: number | null
  className?: string
  hideRowLabel?: boolean
}

type ScanPause = {
  sections: LessonFrameSection[]
  index: number
  error: string
}

/**
 * Lesson frame fuel: scan skill / EQ / vocab from discrete outline sections, edit, mark ready.
 */
export function LessonFrameFuelPanel({
  bookId,
  unitId,
  lessonId,
  lessonTitle = null,
  frame,
  onFrameChange,
  totalPdfPages = null,
  className,
  hideRowLabel = false,
}: LessonFrameFuelPanelProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<'scan' | 'save' | null>(null)
  const [draft, setDraft] = useState<LessonFrameRecord | null>(frame)
  const [scanPause, setScanPause] = useState<ScanPause | null>(null)
  const [scanProgress, setScanProgress] = useState<string | null>(null)
  const [scanNotice, setScanNotice] = useState<ScanNotice | null>(null)

  useEffect(() => {
    setDraft(frame)
  }, [frame])

  const ready = isLessonFrameReady(frame)
  const status = lessonFrameStatusLabel(frame)
  const viewableFrame = draft ?? frame
  const canOpen = Boolean(viewableFrame)
  const summary = frame
    ? lessonFrameSummaryLine(frame)
    : scanPause
      ? `Paused on section ${scanPause.index + 1} — retry or continue`
      : 'Scan skill / vocab pages for this lesson'

  function applyFrame(next: LessonFrameRecord | null) {
    if (!next) return
    setDraft(next)
    onFrameChange(next)
  }

  async function planSections(): Promise<LessonFrameSection[] | null> {
    const res = await fetch('/api/reading-lessons/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'plan',
        bookId,
        unitId,
        lessonId,
        lessonTitle: lessonTitle ?? undefined,
        totalPdfPages: typeof totalPdfPages === 'number' ? totalPdfPages : undefined,
      }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      sections?: LessonFrameSection[]
      error?: string
    }
    if (!data.ok || !data.sections?.length) {
      setScanNotice({
        kind: 'error',
        message: `${data.error ?? 'Could not plan lesson frame pages.'} Click to dismiss.`,
      })
      return null
    }
    return data.sections
  }

  async function scanOneSection(
    section: LessonFrameSection,
    sectionIndex: number,
  ): Promise<{ ok: true; frame: LessonFrameRecord | null; empty: boolean } | { ok: false; error: string }> {
    const res = await fetch('/api/reading-lessons/frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scan-section',
        bookId,
        unitId,
        lessonId,
        lessonTitle: lessonTitle ?? undefined,
        totalPdfPages: typeof totalPdfPages === 'number' ? totalPdfPages : undefined,
        partId: section.partId,
        partIndex: section.partIndex,
        sectionIndex,
      }),
    })
    const data = (await res.json()) as {
      ok?: boolean
      frame?: LessonFrameRecord | null
      empty?: boolean
      error?: string
    }
    if (!data.ok) {
      return { ok: false, error: data.error ?? 'Could not scan this section.' }
    }
    return { ok: true, frame: data.frame ?? null, empty: Boolean(data.empty) }
  }

  function finishScan(latest: LessonFrameRecord | null) {
    setScanPause(null)
    setScanProgress(null)
    if (latest && lessonFrameHasContent(latest)) {
      applyFrame(latest)
      setScanNotice({
        kind: 'success',
        message: 'Lesson frame draft ready — review and mark ready. Click to dismiss.',
      })
      setOpen(true)
      return
    }
    if (latest) {
      applyFrame(latest)
      setScanNotice({
        kind: 'info',
        message:
          'Partial frame saved — open it to review what we have, or fill gaps by hand. Click to dismiss.',
      })
      setOpen(true)
      return
    }
    setScanNotice({
      kind: 'error',
      message:
        'AI found little lesson-frame content on those pages. Try again, or fill the frame by hand. Click to dismiss.',
    })
  }

  async function runSectionLoop(sections: LessonFrameSection[], startIndex: number) {
    setBusy('scan')
    setScanPause(null)
    setScanNotice(null)
    let latest: LessonFrameRecord | null = frame

    try {
      for (let i = startIndex; i < sections.length; i += 1) {
        const section = sections[i]!
        setScanProgress(`${i + 1}/${sections.length}: ${section.title}`)
        const result = await scanOneSection(section, i)
        if (!result.ok) {
          if (latest) applyFrame(latest)
          setScanPause({ sections, index: i, error: result.error })
          setScanNotice({
            kind: 'error',
            message: `${result.error} Click to dismiss.`,
          })
          return
        }
        if (result.frame) {
          latest = result.frame
          applyFrame(result.frame)
        }
        if (result.empty) {
          toast.message(`Skipped · ${section.title} (${i + 1}/${sections.length})`)
        } else {
          toast.success(`Saved · ${section.title} (${i + 1}/${sections.length})`)
        }
      }
      finishScan(latest)
    } catch {
      setScanNotice({
        kind: 'error',
        message: 'Could not scan lesson frame. Click to dismiss.',
      })
      if (latest) applyFrame(latest)
    } finally {
      setBusy(null)
      setScanProgress(null)
    }
  }

  async function scanFrame() {
    setScanPause(null)
    setScanNotice(null)
    setBusy('scan')
    try {
      const sections = await planSections()
      if (!sections) {
        setBusy(null)
        return
      }
      toast.message(`Scanning ${sections.length} skill/vocab section${sections.length === 1 ? '' : 's'}…`)
      await runSectionLoop(sections, 0)
    } catch {
      setScanNotice({
        kind: 'error',
        message: 'Could not scan lesson frame. Click to dismiss.',
      })
      setBusy(null)
      setScanProgress(null)
    }
  }

  function retryPausedSection() {
    if (!scanPause) return
    void runSectionLoop(scanPause.sections, scanPause.index)
  }

  function continueAfterPause() {
    if (!scanPause) return
    const next = scanPause.index + 1
    if (next >= scanPause.sections.length) {
      finishScan(frame)
      return
    }
    void runSectionLoop(scanPause.sections, next)
  }

  async function saveDraft(status: 'draft' | 'ready') {
    if (!draft) return false
    setBusy('save')
    try {
      const action = status === 'ready' ? 'mark-ready' : 'save'
      const res = await fetch('/api/reading-lessons/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...draft,
          bookId,
          unitId,
          lessonId,
          status,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        frame?: LessonFrameRecord
        error?: string
      }
      if (!data.ok || !data.frame) {
        toast.error(data.error ?? 'Could not save lesson frame.')
        return false
      }
      setDraft(data.frame)
      onFrameChange(data.frame)
      toast.success(status === 'ready' ? 'Lesson frame ready for Generate.' : 'Lesson frame saved.')
      return true
    } catch {
      toast.error('Could not save lesson frame.')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function unready() {
    setBusy('save')
    try {
      const res = await fetch('/api/reading-lessons/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unready',
          bookId,
          unitId,
          lessonId,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        frame?: LessonFrameRecord
        error?: string
      }
      if (!data.ok || !data.frame) {
        toast.error(data.error ?? 'Could not unlock frame.')
        return
      }
      setDraft(data.frame)
      onFrameChange(data.frame)
      toast.success('Back to draft — edit anytime.')
    } catch {
      toast.error('Could not unlock frame.')
    } finally {
      setBusy(null)
    }
  }

  function patchDraft(patch: Partial<LessonFrameRecord>) {
    setDraft((prev) => {
      if (!prev) {
        return {
          id: `frame:${bookId}:${unitId}:${lessonId}`,
          bookId,
          unitId,
          lessonId,
          lessonTitle: lessonTitle ?? undefined,
          comprehensionSkill: '',
          readingStrategy: '',
          essentialQuestion: '',
          lessonGoals: [],
          targetVocabulary: [],
          teachingNotes: '',
          sourcePageRange: { startPdfPage: 1, endPdfPage: 1 },
          startDisplayPage: null,
          endDisplayPage: null,
          status: 'draft',
          source: 'paste',
          updatedAt: new Date().toISOString(),
          ...patch,
        }
      }
      return { ...prev, ...patch }
    })
  }

  function patchTeachingNotesPart(part: 'genre' | 'vocabularyStrategy' | 'other', value: string) {
    const current = splitLessonFrameTeachingNotes(draft?.teachingNotes ?? '')
    const next = joinLessonFrameTeachingNotes({
      ...current,
      [part]: value,
    })
    patchDraft({ teachingNotes: next })
  }

  const notesParts = splitLessonFrameTeachingNotes(draft?.teachingNotes ?? '')
  const scannedSections = draft?.scannedSections ?? []

  function sectionCardBody(section: LessonFrameScannedSection) {
    if (!draft) return null
    const kind = lessonFrameSectionKind(section.title, section.tag)
    const preview = lessonFrameSectionCardPreview(draft, section)

    if (kind === 'vocab') {
      return (
        <Input
          value={(draft.targetVocabulary ?? []).join(', ')}
          onChange={(e) =>
            patchDraft({
              targetVocabulary: e.target.value
                .split(',')
                .map((w) => w.trim())
                .filter(Boolean),
            })
          }
          placeholder="Words to Know…"
          disabled={ready}
        />
      )
    }
    if (kind === 'skill') {
      return (
        <Input
          value={draft.comprehensionSkill}
          onChange={(e) => patchDraft({ comprehensionSkill: e.target.value })}
          placeholder="e.g. Key Details"
          disabled={ready}
        />
      )
    }
    if (kind === 'strategy') {
      return (
        <Input
          value={draft.readingStrategy}
          onChange={(e) => patchDraft({ readingStrategy: e.target.value })}
          placeholder="e.g. Visualize"
          disabled={ready}
        />
      )
    }
    if (kind === 'genre') {
      return (
        <Input
          value={notesParts.genre}
          onChange={(e) => patchTeachingNotesPart('genre', e.target.value)}
          placeholder="e.g. Fantasy"
          disabled={ready}
        />
      )
    }
    if (kind === 'vocab_strategy') {
      return (
        <Input
          value={notesParts.vocabularyStrategy}
          onChange={(e) => patchTeachingNotesPart('vocabularyStrategy', e.target.value)}
          placeholder="e.g. Inflectional Endings"
          disabled={ready}
        />
      )
    }
    return <p className="text-sm text-[var(--checks-ink)]">{preview}</p>
  }

  return (
    <div className={cn(className)} style={CHECKS_DIALOG_STYLE}>
      <div className="rounded-xl border border-[var(--checks-border)] bg-[var(--checks-card)]">
        <div className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {!hideRowLabel ? (
                  <span className="text-xs font-medium text-[var(--checks-muted)]">Frame</span>
                ) : null}
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
                    ready
                      ? 'bg-[var(--checks-ok-soft)] text-[var(--checks-ok)]'
                      : frame
                        ? 'bg-[var(--checks-warn-soft)] text-[var(--checks-ink)]'
                        : 'bg-[var(--checks-warn-soft)] text-[var(--checks-ink)]',
                  )}
                >
                  {status}
                </span>
              </div>
              <p className="truncate text-sm text-[var(--checks-muted)]">
                {busy === 'scan' && scanProgress ? `Scanning… ${scanProgress}` : summary}
              </p>
              {scanPause ? (
                <p className="text-[11px] text-[var(--checks-muted)]">{scanPause.error}</p>
              ) : null}
              {scanNotice ? (
                <DismissibleScanNotice notice={scanNotice} onDismiss={() => setScanNotice(null)} />
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {canOpen ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 border-[var(--checks-border)]"
                  disabled={busy === 'save'}
                  onClick={() => {
                    if (viewableFrame) setDraft(viewableFrame)
                    setOpen(true)
                  }}
                >
                  Open
                </Button>
              ) : null}
              {scanPause ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8"
                    disabled={busy !== null}
                    onClick={() => retryPausedSection()}
                  >
                    Retry
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[var(--checks-muted)]"
                    disabled={busy !== null}
                    onClick={() => continueAfterPause()}
                  >
                    Continue
                  </Button>
                </>
              ) : !frame ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-1.5"
                    disabled={busy !== null}
                    onClick={() => void scanFrame()}
                  >
                    {busy === 'scan' ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                        Scanning…
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5" aria-hidden />
                        Scan frame
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-[var(--checks-muted)]"
                    disabled={busy !== null}
                    onClick={() => {
                      patchDraft({})
                      setOpen(true)
                    }}
                  >
                    Fill by hand
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 text-[var(--checks-muted)]"
                  disabled={busy !== null}
                  onClick={() => void scanFrame()}
                >
                  {busy === 'scan' ? 'Scanning…' : 'Re-scan'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[90vh] max-w-lg overflow-y-auto border-[var(--checks-border)] bg-[var(--checks-card)] sm:max-w-xl"
          style={CHECKS_DIALOG_STYLE}
        >
          <DialogHeader>
            <DialogTitle className="text-[var(--checks-ink)]">Lesson frame</DialogTitle>
            <DialogDescription className="text-[var(--checks-muted)]">
              {lessonTitle
                ? `${lessonTitle} — skill and vocab for smarter reading checks.`
                : 'Skill and vocab for smarter reading checks.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--checks-muted)]">
                Summary for Generate
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="lf-skill" className="text-[var(--checks-muted)]">
                  Comprehension skill
                </Label>
                <Input
                  id="lf-skill"
                  value={draft?.comprehensionSkill ?? ''}
                  onChange={(e) => patchDraft({ comprehensionSkill: e.target.value })}
                  placeholder="e.g. Cause and Effect"
                  disabled={ready}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lf-strategy" className="text-[var(--checks-muted)]">
                  Reading strategy
                </Label>
                <Input
                  id="lf-strategy"
                  value={draft?.readingStrategy ?? ''}
                  onChange={(e) => patchDraft({ readingStrategy: e.target.value })}
                  placeholder="e.g. Make Predictions"
                  disabled={ready}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lf-eq" className="text-[var(--checks-muted)]">
                  Essential question
                </Label>
                <Input
                  id="lf-eq"
                  value={draft?.essentialQuestion ?? ''}
                  onChange={(e) => patchDraft({ essentialQuestion: e.target.value })}
                  placeholder="Week’s big question"
                  disabled={ready}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lf-vocab" className="text-[var(--checks-muted)]">
                  Target vocabulary (comma-separated)
                </Label>
                <Input
                  id="lf-vocab"
                  value={(draft?.targetVocabulary ?? []).join(', ')}
                  onChange={(e) =>
                    patchDraft({
                      targetVocabulary: e.target.value
                        .split(',')
                        .map((w) => w.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="soar, ambition, …"
                  disabled={ready}
                />
              </div>
            </div>

            {scannedSections.length > 0 ? (
              <div className="space-y-2">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--checks-muted)]">
                    Scanned parts
                  </p>
                  <p className="text-[11px] text-[var(--checks-muted)]">
                    One card per lesson piece. Full page text comes in a later pass — labels and words
                    for now.
                  </p>
                </div>
                <div className="space-y-2">
                  {scannedSections.map((section) => {
                    const short = lessonFrameSectionShortLabel(section.title, section.tag)
                    const pages = lessonFrameSectionPageLabel(section)
                    return (
                      <div
                        key={`${section.tag}:${section.title}:${section.startDisplayPage}:${section.endDisplayPage}`}
                        className="rounded-lg border border-[var(--checks-border)] bg-[var(--checks-card)] p-3"
                      >
                        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[var(--checks-ink)]">{short}</p>
                            <p className="truncate text-[11px] text-[var(--checks-muted)]">
                              {section.title}
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[var(--checks-warn-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--checks-ink)]">
                            {pages}
                          </span>
                        </div>
                        {sectionCardBody(section)}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--checks-muted)]">
                No scanned parts yet — use Scan frame to fill lesson pieces by page.
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="lf-notes" className="text-[var(--checks-muted)]">
                Other teaching notes
              </Label>
              <Textarea
                id="lf-notes"
                value={notesParts.other}
                onChange={(e) => patchTeachingNotesPart('other', e.target.value)}
                rows={3}
                className="resize-y"
                placeholder="Anything else worth keeping (not Genre / Vocab strategy — those live on their cards)."
                disabled={ready}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {ready ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void unready()}
              >
                Edit again
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null || !draft}
                  onClick={() => void saveDraft('draft').then((ok) => ok && setOpen(false))}
                >
                  {busy === 'save' ? 'Saving…' : 'Save draft'}
                </Button>
                <Button
                  type="button"
                  disabled={busy !== null || !draft}
                  onClick={() => void saveDraft('ready').then((ok) => ok && setOpen(false))}
                >
                  Mark ready
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
