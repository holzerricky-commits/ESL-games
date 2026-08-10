'use client'

import { useEffect } from 'react'
import type { ScheduleViewMode } from '@/components/schedule/schedule-week-header'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return true
  return target.isContentEditable
}

function isEventBlockFocused(): boolean {
  const active = document.activeElement
  return Boolean(active instanceof HTMLElement && active.closest('[data-schedule-event-block]'))
}

interface UseScheduleKeyboardShortcutsOptions {
  enabled: boolean
  viewMode: ScheduleViewMode
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onViewModeChange: (mode: ScheduleViewMode) => void
}

export function useScheduleKeyboardShortcuts({
  enabled,
  viewMode,
  onToday,
  onPrev,
  onNext,
  onViewModeChange,
}: UseScheduleKeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (isEventBlockFocused()) return

      const key = event.key.toLowerCase()

      if (key === 't') {
        event.preventDefault()
        onToday()
        return
      }
      if (key === 'w') {
        event.preventDefault()
        onViewModeChange('week')
        return
      }
      if (key === 'm') {
        event.preventDefault()
        onViewModeChange('month')
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onPrev()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        onNext()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, viewMode, onToday, onPrev, onNext, onViewModeChange])
}
