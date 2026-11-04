import { toast } from 'sonner'
import {
  decideLessonPrepChecks,
  planLessonPrepPart,
  storyTextIsComplete,
} from '@/lib/books/lesson-prep-plan'
import { resolvePartStoryKind } from '@/lib/books/part-structure-tag'
import { readingCheckPackCanApprove, type ReadingCheckPack } from '@/lib/books/reading-check-pack'
import {
  readingStoryPartKey,
  resolveReadingStoryRange,
  type ReadingStoryMap,
  type ReadingStoryRangeOverride,
} from '@/lib/books/reading-story-map'
import type { ReadingStoryTextRecord } from '@/lib/books/reading-story-text'
import {
  lessonSelectableJobKey,
  startSearchablePdfJob,
  stopSearchablePdfJob,
} from '@/lib/books/searchable-pdf-manager'
import { startStoryTextScan, stopStoryTextScan } from '@/lib/books/story-text-scan-manager'
import { resolveTocExtractProfileForBook } from '@/lib/books/toc-extract-profile'
import type { BookLessonRecord, BookRecord, BookUnitRecord } from '@/lib/books/types'

export type LessonPrepStepState = 'pending' | 'running' | 'done' | 'attention' | 'failed'

export interface LessonPrepStep {
  state: LessonPrepStepState
  note: string
}

export interface LessonPrepPartStatus {
  partId: string
  storyId: string
  title: string
  pages: LessonPrepStep
  text: LessonPrepStep
  checks: LessonPrepStep
}

export interface LessonPrepSnapshot {
  key: string
  running: boolean
  message: string | null
  selectable: LessonPrepStep
  parts: LessonPrepPartStatus[]
  /** Set once a run ends; cleared by dismiss or a new run. */
  finished: boolean
}

export interface LessonPrepOutcome {
  stopped: boolean
  /** Steps that did not end as done (attention, failed, or not run). */
  needsLook: number
}

type Listener = (snapshot: LessonPrepSnapshot) => void

type Job = {
  snapshot: LessonPrepSnapshot
  controller: AbortController
  listeners: Set<Listener>
  generation: number
  storyIds: string[]
  selectableKey: string | null
}

const jobs = new Map<string, Job>()

export function lessonPrepJobKey(bookId: string, unitId: string, lessonId: string): string {
  return `lesson-prep::${bookId}::${unitId}::${lessonId}`
}

function emptySnapshot(key: string): LessonPrepSnapshot {
  return {
    key,
    running: false,
    message: null,
    selectable: { state: 'pending', note: 'Waiting' },
    parts: [],
    finished: false,
  }
}

function emit(job: Job) {
  const snap = { ...job.snapshot, parts: job.snapshot.parts.map((p) => ({ ...p })) }
  for (const listener of job.listeners) {
    try {
      listener(snap)
    } catch {
      // Ignore one bad UI subscriber.
    }
  }
}

function pruneIdleJob(key: string) {
  const job = jobs.get(key)
  if (job && !job.snapshot.running && !job.snapshot.finished && job.listeners.size === 0) jobs.delete(key)
}

export function subscribeLessonPrepJob(key: string, listener: Listener): () => void {
  let job = jobs.get(key)
  if (!job) {
    job = {
      snapshot: emptySnapshot(key),
      controller: new AbortController(),
      listeners: new Set(),
      generation: 0,
      storyIds: [],
      selectableKey: null,
    }
    jobs.set(key, job)
  }
  job.listeners.add(listener)
  listener({ ...job.snapshot, parts: job.snapshot.parts.map((p) => ({ ...p })) })
  return () => {
    job?.listeners.delete(listener)
    pruneIdleJob(key)
  }
}

export function stopLessonPrepJob(key: string): void {
  const job = jobs.get(key)
  if (!job?.snapshot.running) return
  job.controller.abort()
  for (const storyId of job.storyIds) stopStoryTextScan(storyId)
  if (job.selectableKey) stopSearchablePdfJob(job.selectableKey)
}

export function dismissLessonPrepJob(key: string): void {
  const job = jobs.get(key)
  if (!job || job.snapshot.running) return
  job.snapshot = emptySnapshot(key)
  emit(job)
  pruneIdleJob(key)
}

async function postJson<T>(url: string, body: unknown, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  return (await res.json()) as T
}

async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  return (await res.json()) as T
}

function lessonStories(book: BookRecord, unit: BookUnitRecord, lesson: BookLessonRecord): ReadingStoryMap[] {
  const profile = resolveTocExtractProfileForBook(book)
  const out: ReadingStoryMap[] = []
  ;(lesson.parts ?? []).forEach((part, index) => {
    const kind = resolvePartStoryKind(part, index, profile)
    if (!kind) return
    out.push({
      id: readingStoryPartKey(book.id, unit.id, lesson.id, part.id),
      bookId: book.id,
      unitId: unit.id,
      lessonId: lesson.id,
      partId: part.id,
      title: part.title?.trim() || 'Story',
      kind,
      lessonTitle: lesson.title,
    })
  })
  return out
}

export function lessonHasStoryParts(book: BookRecord, unit: BookUnitRecord, lesson: BookLessonRecord): boolean {
  return lessonStories(book, unit, lesson).length > 0
}

/**
 * Prep every story in a lesson: confirm pages, make the whole lesson selectable,
 * scan story text, then generate and auto-approve reading checks.
 * Existing approved packs and drafts with questions are never overwritten.
 */
export function startLessonPrepJob(input: {
  book: BookRecord
  unit: BookUnitRecord
  lesson: BookLessonRecord
  totalPdfPages: number | null
  /** Shown in the final toast, e.g. "for Anna's class at 3:00 PM". */
  contextLabel?: string
}): Promise<LessonPrepOutcome | null> {
  const { book, unit, lesson, totalPdfPages } = input
  const key = lessonPrepJobKey(book.id, unit.id, lesson.id)
  const prev = jobs.get(key)
  if (prev?.snapshot.running) return Promise.resolve(null)
  const lessonLabel = lesson.title?.trim() || 'Lesson'
  const context = input.contextLabel?.trim() ? ` ${input.contextLabel.trim()}` : ''

  const stories = lessonStories(book, unit, lesson)
  const controller = new AbortController()
  const generation = (prev?.generation ?? 0) + 1
  const job: Job = {
    snapshot: {
      key,
      running: true,
      message: 'Checking the lesson\u2026',
      selectable: { state: 'pending', note: 'Waiting for pages' },
      parts: stories.map((story) => ({
        partId: story.partId ?? story.id,
        storyId: story.id,
        title: story.title,
        pages: { state: 'pending', note: 'Waiting' },
        text: { state: 'pending', note: 'Waiting' },
        checks: { state: 'pending', note: 'Waiting' },
      })),
      finished: false,
    },
    controller,
    listeners: prev?.listeners ?? new Set(),
    generation,
    storyIds: stories.map((s) => s.id),
    selectableKey: lessonSelectableJobKey(book.id, unit.id, lesson.id),
  }
  jobs.set(key, job)
  emit(job)

  const { signal } = controller
  const live = () => jobs.get(key)?.generation === generation
  const update = (mutate: (snap: LessonPrepSnapshot) => void) => {
    if (!live()) return
    mutate(job.snapshot)
    emit(job)
  }
  const setPart = (storyId: string, step: 'pages' | 'text' | 'checks', value: LessonPrepStep) =>
    update((snap) => {
      const part = snap.parts.find((p) => p.storyId === storyId)
      if (part) part[step] = value
    })

  return (async (): Promise<LessonPrepOutcome | null> => {
    try {
      const overridesRes = await getJson<{ ok?: boolean; overrides?: ReadingStoryRangeOverride[] }>(
        `/api/reading-stories?bookId=${encodeURIComponent(book.id)}`,
        signal,
      )
      const overrides = overridesRes.overrides ?? []

      const texts = await Promise.all(
        stories.map(async (story) => {
          const res = await getJson<{ ok?: boolean; text?: ReadingStoryTextRecord | null }>(
            `/api/reading-stories/text?storyId=${encodeURIComponent(story.id)}`,
            signal,
          )
          return res.text ?? null
        }),
      )

      update((snap) => {
        snap.message = 'Confirming story pages\u2026'
      })
      const ready: Array<{ story: ReadingStoryMap; text: ReadingStoryTextRecord | null; textAction: 'full' | 'continue' | 'skip' }> = []
      for (let i = 0; i < stories.length; i += 1) {
        const story = stories[i]!
        const override =
          overrides.find(
            (o) =>
              o.storyId === story.id ||
              (o.partId != null && o.partId === story.partId && o.lessonId === lesson.id),
          ) ?? null
        const range = resolveReadingStoryRange(story, book, unit, totalPdfPages, override)
        const plan = planLessonPrepPart({ range, text: texts[i] ?? null })
        if (plan.pages === 'missing' || plan.text == null) {
          setPart(story.id, 'pages', { state: 'attention', note: 'Set the story pages' })
          setPart(story.id, 'text', { state: 'attention', note: 'Needs pages' })
          setPart(story.id, 'checks', { state: 'attention', note: 'Needs pages' })
          continue
        }
        if (plan.pages === 'confirm') {
          setPart(story.id, 'pages', { state: 'running', note: 'Saving pages' })
          const saved = await postJson<{ ok?: boolean; error?: string }>(
            '/api/reading-stories',
            {
              storyId: story.id,
              bookId: story.bookId,
              unitId: story.unitId,
              lessonId: story.lessonId,
              partId: story.partId,
              title: story.title,
              startPage: range.startDisplayPage,
              endPage: range.endDisplayPage,
              rangeConfirmed: true,
            },
            signal,
          )
          if (!saved.ok) {
            setPart(story.id, 'pages', { state: 'failed', note: saved.error ?? 'Could not save pages' })
            setPart(story.id, 'text', { state: 'attention', note: 'Needs pages' })
            setPart(story.id, 'checks', { state: 'attention', note: 'Needs pages' })
            continue
          }
        }
        setPart(story.id, 'pages', {
          state: 'done',
          note: `Pages ${range.startDisplayPage}\u2013${range.endDisplayPage}`,
        })
        ready.push({ story, text: texts[i] ?? null, textAction: plan.text })
      }

      update((snap) => {
        snap.selectable = { state: 'running', note: 'Making lesson pages selectable' }
      })
      const selectableRun = startSearchablePdfJob({
        storyId: job.selectableKey!,
        bookId: book.id,
        unitId: unit.id,
        lessonId: lesson.id,
        title: lesson.title?.trim() || 'Lesson',
        totalPdfPages,
        scope: 'lesson',
      }).then((result) => {
        update((snap) => {
          snap.selectable = result.ok
            ? {
                state: 'done',
                note: result.stamped > 0 ? `${result.stamped} pages made selectable` : 'Already selectable',
              }
            : { state: result.error.startsWith('Stopped') ? 'attention' : 'failed', note: result.error }
        })
      })

      for (const { story, text, textAction } of ready) {
        if (signal.aborted) break
        update((snap) => {
          snap.message = `Preparing \u201c${story.title}\u201d\u2026`
        })

        let finalText = text
        if (textAction === 'skip') {
          setPart(story.id, 'text', { state: 'done', note: 'Text already saved' })
        } else {
          setPart(story.id, 'text', {
            state: 'running',
            note: textAction === 'continue' ? 'Continuing scan' : 'Scanning text',
          })
          const result = await startStoryTextScan({
            storyId: story.id,
            bookId: story.bookId,
            unitId: story.unitId,
            lessonId: story.lessonId,
            partId: story.partId,
            title: story.title,
            totalPdfPages,
            mode: textAction,
            existingText: text,
            notify: false,
          })
          finalText = result.text ?? text
          if (!result.ok) {
            setPart(story.id, 'text', {
              state: signal.aborted ? 'attention' : 'failed',
              note: signal.aborted ? 'Stopped' : result.error,
            })
          } else if (result.interrupted || !storyTextIsComplete(result.text)) {
            setPart(story.id, 'text', { state: 'attention', note: 'Scan stopped part way' })
          } else {
            setPart(story.id, 'text', { state: 'done', note: 'Text saved' })
          }
        }
        if (signal.aborted) break

        const packRes = await getJson<{ ok?: boolean; pack?: ReadingCheckPack | null }>(
          `/api/reading-stories/checks?storyId=${encodeURIComponent(story.id)}`,
          signal,
        )
        const action = decideLessonPrepChecks({
          pack: packRes.pack ?? null,
          textComplete: storyTextIsComplete(finalText),
        })
        if (action === 'skip-approved') {
          setPart(story.id, 'checks', { state: 'done', note: 'Already approved' })
          continue
        }
        if (action === 'skip-draft') {
          setPart(story.id, 'checks', { state: 'attention', note: 'Draft waiting for review' })
          continue
        }
        if (action === 'blocked') {
          setPart(story.id, 'checks', { state: 'attention', note: 'Needs complete story text' })
          continue
        }

        setPart(story.id, 'checks', { state: 'running', note: 'Writing checks' })
        const generated = await postJson<{ ok?: boolean; error?: string; pack?: ReadingCheckPack }>(
          '/api/reading-stories/checks',
          {
            action: 'generate',
            storyId: story.id,
            bookId: story.bookId,
            unitId: story.unitId,
            lessonId: story.lessonId,
            title: story.title,
          },
          signal,
        )
        if (!generated.ok || !generated.pack) {
          setPart(story.id, 'checks', { state: 'failed', note: generated.error ?? 'Could not write checks' })
          continue
        }
        if (!readingCheckPackCanApprove(generated.pack)) {
          setPart(story.id, 'checks', { state: 'attention', note: 'No questions were written' })
          continue
        }
        const approved = await postJson<{ ok?: boolean; error?: string }>(
          '/api/reading-stories/checks',
          { action: 'approve', storyId: story.id, bookId: story.bookId, unitId: story.unitId, auto: true },
          signal,
        )
        setPart(
          story.id,
          'checks',
          approved.ok
            ? { state: 'done', note: 'Approved (auto)' }
            : { state: 'failed', note: approved.error ?? 'Could not approve checks' },
        )
      }

      await selectableRun
      return finishJob()
    } catch (err) {
      if (!live()) return null
      if (!signal.aborted) {
        toast.error(err instanceof Error ? err.message : 'Lesson prep stopped unexpectedly.')
      }
      return finishJob()
    }
  })()

  function finishJob(): LessonPrepOutcome | null {
    let outcome: LessonPrepOutcome | null = null
    update((snap) => {
      const stopped = signal.aborted
      for (const part of snap.parts) {
        for (const step of ['pages', 'text', 'checks'] as const) {
          if (part[step].state === 'pending' || part[step].state === 'running') {
            part[step] = { state: 'attention', note: stopped ? 'Stopped' : 'Not run' }
          }
        }
      }
      if (snap.selectable.state === 'pending' || snap.selectable.state === 'running') {
        snap.selectable = { state: 'attention', note: stopped ? 'Stopped' : 'Not run' }
      }
      const steps = [snap.selectable, ...snap.parts.flatMap((p) => [p.pages, p.text, p.checks])]
      const needsLook = steps.filter((s) => s.state !== 'done').length
      snap.running = false
      snap.finished = true
      snap.message = stopped
        ? 'Lesson prep stopped. Finished steps were kept.'
        : needsLook === 0
          ? 'Lesson is ready for class.'
          : `Lesson prep finished \u2014 ${needsLook} step${needsLook === 1 ? '' : 's'} need a look.`
      const toastText = context ? `${lessonLabel}${context}: ${snap.message}` : snap.message
      if (stopped) toast.message(toastText)
      else if (needsLook === 0) toast.success(toastText)
      else toast.warning(toastText)
      outcome = { stopped, needsLook }
    })
    return outcome
  }
}
