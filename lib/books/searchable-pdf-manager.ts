import { toast } from 'sonner'
import type { ScanNotice } from '@/components/books/dismissible-scan-notice'
import {
  runSearchablePdfForStory,
  type SearchablePdfJobResult,
  type SearchablePdfProgress,
  type SearchablePdfScope,
} from '@/lib/books/searchable-pdf-client'

/** Job key for a whole-lesson run; kept apart from story keys so both can show progress. */
export function lessonSelectableJobKey(bookId: string, unitId: string, lessonId: string): string {
  return `lesson-selectable::${bookId}::${unitId}::${lessonId}`
}

export type SearchablePdfJobSnapshot = {
  storyId: string
  running: boolean
  progress: SearchablePdfProgress | null
  /** Outcome of the last run; stays until dismissed or a new run starts. */
  lastNotice: ScanNotice | null
}

type Listener = (snapshot: SearchablePdfJobSnapshot) => void

type Job = {
  storyId: string
  controller: AbortController
  running: boolean
  progress: SearchablePdfProgress | null
  lastNotice: ScanNotice | null
  listeners: Set<Listener>
  generation: number
}

const jobs = new Map<string, Job>()

function snapshotOf(job: Job): SearchablePdfJobSnapshot {
  return {
    storyId: job.storyId,
    running: job.running,
    progress: job.progress,
    lastNotice: job.lastNotice,
  }
}

function emit(job: Job) {
  const snap = snapshotOf(job)
  for (const listener of job.listeners) {
    try {
      listener(snap)
    } catch {
      // Ignore one bad UI subscriber.
    }
  }
}

function pruneIdleJob(job: Job) {
  if (!job.running && !job.lastNotice && job.listeners.size === 0) jobs.delete(job.storyId)
}

function pagesLabel(n: number): string {
  return `${n} page${n === 1 ? '' : 's'}`
}

export function isSearchablePdfJobRunning(storyId: string): boolean {
  return Boolean(jobs.get(storyId.trim())?.running)
}

export function subscribeSearchablePdfJob(storyId: string, listener: Listener): () => void {
  const id = storyId.trim()
  if (!id) return () => {}
  let job = jobs.get(id)
  if (!job) {
    job = {
      storyId: id,
      controller: new AbortController(),
      running: false,
      progress: null,
      lastNotice: null,
      listeners: new Set(),
      generation: 0,
    }
    jobs.set(id, job)
  }
  job.listeners.add(listener)
  listener(snapshotOf(job))
  return () => {
    const current = jobs.get(id)
    if (!current) return
    current.listeners.delete(listener)
    pruneIdleJob(current)
  }
}

export function stopSearchablePdfJob(storyId: string): void {
  const job = jobs.get(storyId.trim())
  if (!job?.running) return
  job.controller.abort()
}

export function dismissSearchablePdfJobNotice(storyId: string): void {
  const job = jobs.get(storyId.trim())
  if (!job?.lastNotice) return
  job.lastNotice = null
  emit(job)
  pruneIdleJob(job)
}

export function startSearchablePdfJob(input: {
  storyId: string
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  scope?: SearchablePdfScope
  force?: boolean
}): Promise<SearchablePdfJobResult> {
  const storyId = input.storyId.trim()
  if (!storyId) {
    return Promise.resolve({ ok: false, error: 'Missing job id.', filePath: null, stamped: 0 })
  }

  const prev = jobs.get(storyId)
  if (prev?.running) prev.controller.abort()

  const controller = new AbortController()
  const generation = (prev?.generation ?? 0) + 1
  const listeners = prev?.listeners ?? new Set<Listener>()
  const force = Boolean(input.force)
  const job: Job = {
    storyId,
    controller,
    running: true,
    progress: {
      pages: [],
      doneCount: 0,
      totalCount: 0,
      percent: 0,
      activeLabel: null,
      activeStartedAt: null,
      phase: 'reading',
      message: force ? 'Preparing redo…' : 'Checking pages…',
    },
    lastNotice: null,
    listeners,
    generation,
  }
  jobs.set(storyId, job)
  emit(job)

  const finish = (current: Job, notice: ScanNotice) => {
    current.running = false
    current.progress = null
    current.lastNotice = notice
    emit(current)
    pruneIdleJob(current)
  }

  return (async (): Promise<SearchablePdfJobResult> => {
    try {
      const result = await runSearchablePdfForStory({
        ...input,
        storyId,
        force,
        signal: controller.signal,
        onProgress: (progress) => {
          const current = jobs.get(storyId)
          if (!current || current.generation !== generation) return
          current.progress = progress
          emit(current)
        },
      })

      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return result

      if (result.ok) {
        if (result.stamped === 0) {
          const message = force
            ? 'Nothing to redo — these pages already have text in the book.'
            : 'These pages already have selectable text.'
          toast.message(message)
          finish(current, { kind: 'info', message })
        } else {
          toast.success(
            force
              ? `Selectable text redone on ${pagesLabel(result.stamped)}.`
              : `Selectable text is ready on ${pagesLabel(result.stamped)}. Drag words on the book to copy or translate.`,
          )
          finish(current, {
            kind: 'success',
            message: force
              ? `Selectable text redone on ${pagesLabel(result.stamped)}.`
              : `Selectable text is ready on ${pagesLabel(result.stamped)}. Drag words on the book to copy or translate.`,
          })
        }
      } else if (result.error.startsWith('Stopped')) {
        finish(current, {
          kind: 'info',
          message:
            result.stamped > 0
              ? `Stopped — ${pagesLabel(result.stamped)} done. Finished pages were kept.`
              : 'Stopped before any page was finished.',
        })
      } else {
        toast.error(result.error)
        finish(current, {
          kind: 'error',
          message:
            result.stamped > 0
              ? `${result.error} ${pagesLabel(result.stamped)} finished before it stopped.`
              : result.error,
        })
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not make pages selectable.'
      const failed: SearchablePdfJobResult = {
        ok: false,
        error: controller.signal.aborted ? 'Stopped.' : message,
        filePath: null,
        stamped: 0,
      }
      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return failed
      if (!controller.signal.aborted) toast.error(message)
      finish(
        current,
        controller.signal.aborted
          ? { kind: 'info', message: 'Stopped before any page was finished.' }
          : { kind: 'error', message },
      )
      return failed
    }
  })()
}
