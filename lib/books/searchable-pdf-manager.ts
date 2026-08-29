import { toast } from 'sonner'
import {
  runSearchablePdfForStory,
  type SearchablePdfProgress,
} from '@/lib/books/searchable-pdf-client'

export type SearchablePdfJobSnapshot = {
  storyId: string
  running: boolean
  progress: SearchablePdfProgress | null
}

type Listener = (snapshot: SearchablePdfJobSnapshot) => void

type Job = {
  storyId: string
  controller: AbortController
  running: boolean
  progress: SearchablePdfProgress | null
  listeners: Set<Listener>
  generation: number
}

const jobs = new Map<string, Job>()

function snapshotOf(job: Job): SearchablePdfJobSnapshot {
  return {
    storyId: job.storyId,
    running: job.running,
    progress: job.progress,
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
    if (!current.running && current.listeners.size === 0) jobs.delete(id)
  }
}

export function stopSearchablePdfJob(storyId: string): void {
  const job = jobs.get(storyId.trim())
  if (!job?.running) return
  job.controller.abort()
}

export function startSearchablePdfJob(input: {
  storyId: string
  bookId: string
  unitId: string
  lessonId?: string | null
  partId?: string | null
  title?: string
  totalPdfPages?: number | null
}): void {
  const storyId = input.storyId.trim()
  if (!storyId) return

  const prev = jobs.get(storyId)
  if (prev?.running) prev.controller.abort()

  const controller = new AbortController()
  const generation = (prev?.generation ?? 0) + 1
  const listeners = prev?.listeners ?? new Set<Listener>()
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
      message: 'Checking pages…',
    },
    listeners,
    generation,
  }
  jobs.set(storyId, job)
  emit(job)

  void (async () => {
    try {
      const result = await runSearchablePdfForStory({
        ...input,
        storyId,
        signal: controller.signal,
        onProgress: (progress) => {
          const current = jobs.get(storyId)
          if (!current || current.generation !== generation) return
          current.progress = progress
          emit(current)
        },
      })

      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return
      current.running = false
      current.progress = null
      emit(current)

      if (result.ok) {
        if (result.stamped === 0) {
          toast.message('These pages already have selectable text.')
        } else {
          toast.success(
            `Selectable text is ready on ${result.stamped} page${result.stamped === 1 ? '' : 's'}. Drag words on the book to copy or translate.`,
          )
        }
      } else if (result.error !== 'Stopped.') {
        toast.error(result.error)
      }

      if (current.listeners.size === 0) jobs.delete(storyId)
    } catch (err) {
      const current = jobs.get(storyId)
      if (!current || current.generation !== generation) return
      current.running = false
      current.progress = null
      emit(current)
      if (!controller.signal.aborted) {
        toast.error(err instanceof Error ? err.message : 'Could not make pages selectable.')
      }
      if (current.listeners.size === 0) jobs.delete(storyId)
    }
  })()
}
