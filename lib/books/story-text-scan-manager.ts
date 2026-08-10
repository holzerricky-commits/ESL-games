import { toast } from 'sonner'
import type { ReadingStoryTextRecord } from '@/lib/books/reading-story-text'
import {
  runChunkedStoryTextScan,
  type StoryScanProgress,
  type StoryTextScanMode,
} from '@/lib/books/story-text-scan-client'

export type StoryTextScanJobSnapshot = {
  storyId: string
  title: string
  running: boolean
  progress: StoryScanProgress | null
  lastText: ReadingStoryTextRecord | null
}

export type StoryTextScanListener = (snapshot: StoryTextScanJobSnapshot) => void

type StartStoryTextScanInput = {
  storyId: string
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
  mode?: StoryTextScanMode
  existingText?: ReadingStoryTextRecord | null
  /** When false, manager still toasts; callers that show their own UI can skip. Default true. */
  notify?: boolean
}

type Job = {
  storyId: string
  title: string
  controller: AbortController
  progress: StoryScanProgress | null
  lastText: ReadingStoryTextRecord | null
  running: boolean
  listeners: Set<StoryTextScanListener>
  generation: number
}

const jobs = new Map<string, Job>()

function snapshotOf(job: Job): StoryTextScanJobSnapshot {
  return {
    storyId: job.storyId,
    title: job.title,
    running: job.running,
    progress: job.progress,
    lastText: job.lastText,
  }
}

function emit(job: Job) {
  const snap = snapshotOf(job)
  for (const listener of job.listeners) {
    try {
      listener(snap)
    } catch {
      // Ignore listener errors so one bad UI sub doesn't kill the job.
    }
  }
}

function finishToasts(
  title: string,
  result: Awaited<ReturnType<typeof runChunkedStoryTextScan>>,
) {
  const label = title.trim() || 'this story'
  if (result.ok) {
    if (result.interrupted) {
      toast.message(
        `Scan stopped for “${label}” — finished pages were kept. Use Continue scan to finish.`,
      )
    } else {
      toast.success(
        result.text.source === 'gemini'
          ? `Story text ready for “${label}” (read from page images).`
          : `Story text ready for “${label}”.`,
      )
    }
    return
  }
  if (result.text) {
    toast.error(`${result.error} Finished pages were kept for “${label}”.`)
  } else if (result.error !== 'Scan stopped.') {
    toast.error(result.error || `Could not scan “${label}”.`)
  }
}

export function isStoryTextScanRunning(storyId: string): boolean {
  const id = storyId.trim()
  if (!id) return false
  return Boolean(jobs.get(id)?.running)
}

export function getStoryTextScanProgress(storyId: string): StoryScanProgress | null {
  const id = storyId.trim()
  if (!id) return null
  return jobs.get(id)?.progress ?? null
}

export function getStoryTextScanSnapshot(storyId: string): StoryTextScanJobSnapshot | null {
  const id = storyId.trim()
  if (!id) return null
  const job = jobs.get(id)
  return job ? snapshotOf(job) : null
}

export function stopStoryTextScan(storyId: string): void {
  const id = storyId.trim()
  if (!id) return
  const job = jobs.get(id)
  if (!job?.running) return
  job.controller.abort()
}

/**
 * Subscribe to progress for a story. Immediately receives current snapshot if a job exists.
 * Returns unsubscribe.
 */
export function subscribeStoryTextScan(
  storyId: string,
  listener: StoryTextScanListener,
): () => void {
  const id = storyId.trim()
  if (!id) return () => {}

  let job = jobs.get(id)
  if (!job) {
    job = {
      storyId: id,
      title: '',
      controller: new AbortController(),
      progress: null,
      lastText: null,
      running: false,
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
    if (!current.running && current.listeners.size === 0) {
      jobs.delete(id)
    }
  }
}

/**
 * Start (or restart) a chunked story text scan that outlives Prep/Books UI.
 * Starting again for the same story aborts the previous job first.
 */
export function startStoryTextScan(input: StartStoryTextScanInput): void {
  const storyId = input.storyId.trim()
  if (!storyId) return

  const title = (input.title ?? '').trim() || 'Story'
  const notify = input.notify !== false

  const prev = jobs.get(storyId)
  if (prev?.running) {
    prev.controller.abort()
  }

  const controller = new AbortController()
  const generation = (prev?.generation ?? 0) + 1
  const listeners = prev?.listeners ?? new Set<StoryTextScanListener>()

  const job: Job = {
    storyId,
    title,
    controller,
    progress: {
      pages: [],
      doneCount: 0,
      totalCount: 0,
      percent: 0,
      activeLabel: null,
      message: 'Planning pages…',
    },
    lastText: input.existingText ?? prev?.lastText ?? null,
    running: true,
    listeners,
    generation,
  }
  jobs.set(storyId, job)
  emit(job)

  void (async () => {
    try {
      const result = await runChunkedStoryTextScan({
        storyId,
        bookId: input.bookId,
        unitId: input.unitId,
        lessonId: input.lessonId,
        partId: input.partId,
        title: input.title,
        totalPdfPages: input.totalPdfPages,
        mode: input.mode ?? 'full',
        existingText: input.existingText ?? null,
        signal: controller.signal,
        onProgress: (progress) => {
          const current = jobs.get(storyId)
          if (!current || current.generation !== generation) return
          current.progress = progress
          emit(current)
        },
        onChunkSaved: (text) => {
          const current = jobs.get(storyId)
          if (!current || current.generation !== generation) return
          current.lastText = text
          emit(current)
        },
      })

      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return

      if (result.ok) {
        current.lastText = result.text
      } else if (result.text) {
        current.lastText = result.text
      }
      current.running = false
      current.progress = null
      emit(current)

      if (notify) {
        finishToasts(title, result)
      }

      if (current.listeners.size === 0) {
        jobs.delete(storyId)
      }
    } catch (err) {
      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return
      current.running = false
      current.progress = null
      emit(current)
      if (notify && !controller.signal.aborted) {
        toast.error(
          err instanceof Error
            ? err.message
            : `Could not scan “${title}”.`,
        )
      }
      if (current.listeners.size === 0) {
        jobs.delete(storyId)
      }
    }
  })()
}
