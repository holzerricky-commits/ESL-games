'use client'

import { toast } from 'sonner'
import {
  emptyWeeklyScheduleDiskPayload,
  isWeeklyScheduleDiskPayloadEmpty,
  normalizeWeeklyScheduleDiskPayload,
  type WeeklyScheduleDiskPayload,
} from '@/lib/local-data/weekly-schedule-disk-types'

export const WEEKLY_SCHEDULE_CONFIG_KEY = 'esl_weekly_schedule_config'
export const WEEKLY_SLOT_ASSIGNMENTS_KEY = 'esl_weekly_slot_assignments'
export const WEEKLY_SLOT_EXCEPTIONS_KEY = 'esl_weekly_slot_exceptions'

const PERSIST_DEBOUNCE_MS = 300

let diskActive = false
let cache: WeeklyScheduleDiskPayload | null = null
let hydratePromise: Promise<boolean> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let pendingPayload: WeeklyScheduleDiskPayload | null = null

export function isWeeklyScheduleDiskActive(): boolean {
  return diskActive
}

export function getWeeklyScheduleDiskCache(): WeeklyScheduleDiskPayload | null {
  return cache
}

function readBrowserPayload(): WeeklyScheduleDiskPayload {
  if (typeof window === 'undefined') return emptyWeeklyScheduleDiskPayload()
  let config: Record<string, unknown> | null = null
  let assignments: unknown[] = []
  let exceptions: unknown[] = []
  try {
    const configRaw = localStorage.getItem(WEEKLY_SCHEDULE_CONFIG_KEY)
    if (configRaw) {
      const parsed = JSON.parse(configRaw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>
      }
    }
  } catch {
    /* ignore */
  }
  try {
    const assignmentsRaw = localStorage.getItem(WEEKLY_SLOT_ASSIGNMENTS_KEY)
    if (assignmentsRaw) {
      const parsed = JSON.parse(assignmentsRaw) as unknown
      if (Array.isArray(parsed)) assignments = parsed
    }
  } catch {
    /* ignore */
  }
  try {
    const exceptionsRaw = localStorage.getItem(WEEKLY_SLOT_EXCEPTIONS_KEY)
    if (exceptionsRaw) {
      const parsed = JSON.parse(exceptionsRaw) as unknown
      if (Array.isArray(parsed)) exceptions = parsed
    }
  } catch {
    /* ignore */
  }
  return { config, assignments, exceptions }
}

function clearBrowserKeys(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(WEEKLY_SCHEDULE_CONFIG_KEY)
    localStorage.removeItem(WEEKLY_SLOT_ASSIGNMENTS_KEY)
    localStorage.removeItem(WEEKLY_SLOT_EXCEPTIONS_KEY)
  } catch {
    /* ignore */
  }
}

async function persistPayloadToDisk(payload: WeeklyScheduleDiskPayload): Promise<void> {
  const res = await fetch('/api/local-data/weekly-schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Save failed (${res.status})`)
  }
}

function schedulePersist(payload: WeeklyScheduleDiskPayload): void {
  pendingPayload = payload
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const next = pendingPayload
    pendingPayload = null
    if (!next) return
    void persistPayloadToDisk(next).catch((err) => {
      const msg = err instanceof Error ? err.message : 'Could not save weekly schedule to disk.'
      toast.error(msg)
    })
  }, PERSIST_DEBOUNCE_MS)
}

function ensureCache(): WeeklyScheduleDiskPayload {
  if (!cache) cache = emptyWeeklyScheduleDiskPayload()
  return cache
}

export function setWeeklyScheduleConfigOnDiskCache(config: Record<string, unknown>): void {
  const next = { ...ensureCache(), config }
  cache = next
  if (diskActive) schedulePersist(next)
}

export function setWeeklySlotAssignmentsOnDiskCache(assignments: unknown[]): void {
  const next = { ...ensureCache(), assignments }
  cache = next
  if (diskActive) schedulePersist(next)
}

export function setWeeklySlotExceptionsOnDiskCache(exceptions: unknown[]): void {
  const next = { ...ensureCache(), exceptions }
  cache = next
  if (diskActive) schedulePersist(next)
}

export function setWeeklyScheduleDiskCache(
  payload: WeeklyScheduleDiskPayload,
  options?: { persist?: boolean },
): void {
  cache = normalizeWeeklyScheduleDiskPayload(payload)
  if (diskActive && options?.persist !== false) schedulePersist(cache)
}

export function flushWeeklyScheduleToDisk(): void {
  if (!diskActive) return
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
  const payload = pendingPayload ?? cache
  pendingPayload = null
  if (!payload) return
  void persistPayloadToDisk(payload).catch(() => {})
}

export async function hydrateWeeklyScheduleFromDisk(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (diskActive) return true
  if (hydratePromise) return hydratePromise

  hydratePromise = (async () => {
    try {
      const res = await fetch('/api/local-data/weekly-schedule', { cache: 'no-store' })
      if (!res.ok) return false

      const body = (await res.json()) as WeeklyScheduleDiskPayload & { ok?: boolean }
      let payload = normalizeWeeklyScheduleDiskPayload(body)
      const browser = readBrowserPayload()
      let migrated = false

      if (isWeeklyScheduleDiskPayloadEmpty(payload) && !isWeeklyScheduleDiskPayloadEmpty(browser)) {
        payload = browser
        await persistPayloadToDisk(payload)
        clearBrowserKeys()
        migrated = true
      }

      cache = payload
      diskActive = true

      // Drop weekly times for students who no longer exist (or are on break).
      // Dynamic import avoids a circular dependency with selectors.
      void import('@/lib/students/selectors')
        .then((mod) => {
          if (typeof mod.pruneOrphanWeeklySlots === 'function') {
            mod.pruneOrphanWeeklySlots()
          }
        })
        .catch(() => {})

      if (migrated) {
        toast.success('Weekly schedule is now saved on this PC (not only in the browser).')
      }

      return true
    } catch {
      return false
    } finally {
      if (!diskActive) hydratePromise = null
    }
  })()

  return hydratePromise
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => flushWeeklyScheduleToDisk())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushWeeklyScheduleToDisk()
  })
}
