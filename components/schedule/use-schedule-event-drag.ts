'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  PX_PER_MINUTE,
  durationToHeightPx,
  minuteToTopPx,
  snapMinuteFromClick,
  type ScheduleEventBlockLayout,
} from '@/lib/schedule/week-view-layout'
import { normalizeClassDurationMinutes } from '@/lib/schedule/class-duration'
import type { PendingRecurringScheduleChange } from '@/lib/schedule/recurring-change-types'
import { validateSingleOccurrenceReschedule } from '@/lib/students/selectors'
import type { TeacherWeeklyScheduleConfig } from '@/lib/types'

const DRAG_THRESHOLD_PX = 8

export interface ScheduleDragPreview {
  slotId: string | null
  sessionId: string
  studentId: string
  studentName: string
  status: string
  dayIndex: number
  startMinute: number
  durationMinutes: number
  valid: boolean
  error: string | null
  changed: boolean
}

export interface OneOffScheduleReschedule {
  studentId: string
  studentName: string
  sessionId: string
  targetDate: Date
  startMinute: number
  durationMinutes: number
}

interface ActiveDrag {
  slotId: string | null
  sessionId: string
  studentId: string
  studentName: string
  status: string
  pointerOffsetY: number
  originDayIndex: number
  originStartMinute: number
  originDuration: number
  originDayOfWeek: number
}

interface PendingPress {
  pointerId: number
  originX: number
  originY: number
  drag: ActiveDrag
}

interface UseScheduleEventDragOptions {
  weekDays: Date[]
  config: TeacherWeeklyScheduleConfig
  onPendingRecurringChange: (change: PendingRecurringScheduleChange) => void
  onOneOffReschedule: (change: OneOffScheduleReschedule) => void
}

interface BeginDragArgs {
  layout: ScheduleEventBlockLayout
  pointerId: number
  clientX: number
  clientY: number
  blockTopPx: number
}

function sessionOriginFromLayout(
  layout: ScheduleEventBlockLayout,
  weekDays: Date[],
): {
  startMinute: number
  durationMinutes: number
  dayOfWeek: number
} {
  const when = new Date(layout.row.session.scheduledFor)
  const fallbackDay = weekDays[layout.dayIndex]
  const startMinute = Number.isFinite(when.getTime())
    ? when.getHours() * 60 + when.getMinutes()
    : 0
  return {
    startMinute,
    durationMinutes: normalizeClassDurationMinutes(layout.row.session.durationMin, 30),
    dayOfWeek: Number.isFinite(when.getTime())
      ? when.getDay()
      : (fallbackDay?.getDay() ?? 0),
  }
}

export function useScheduleEventDrag({
  weekDays,
  config,
  onPendingRecurringChange,
  onOneOffReschedule,
}: UseScheduleEventDragOptions) {
  const columnsAreaRef = useRef<HTMLDivElement>(null)
  const columnRefs = useRef<Array<HTMLDivElement | null>>([])
  const [preview, setPreview] = useState<ScheduleDragPreview | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const pendingPressRef = useRef<PendingPress | null>(null)
  const activeDragRef = useRef<ActiveDrag | null>(null)
  const activePointerIdRef = useRef<number | null>(null)
  const lastPreviewRef = useRef<ScheduleDragPreview | null>(null)
  const dragMovedRef = useRef(false)
  const suppressClickUntilRef = useRef(0)

  const setColumnRef = useCallback((index: number, node: HTMLDivElement | null) => {
    columnRefs.current[index] = node
  }, [])

  const resolveDayIndex = useCallback((clientX: number, fallback: number) => {
    for (let i = 0; i < columnRefs.current.length; i += 1) {
      const col = columnRefs.current[i]
      if (!col) continue
      const rect = col.getBoundingClientRect()
      if (clientX >= rect.left && clientX <= rect.right) return i
    }
    return fallback
  }, [])

  const computePreview = useCallback(
    (drag: ActiveDrag, clientX: number, clientY: number): ScheduleDragPreview => {
      const dayIndex = resolveDayIndex(clientX, drag.originDayIndex)
      const durationMinutes = drag.originDuration

      const area = columnsAreaRef.current
      const areaTop = area?.getBoundingClientRect().top ?? 0
      const offsetY = clientY - areaTop - drag.pointerOffsetY
      const startMinute = snapMinuteFromClick(
        offsetY,
        PX_PER_MINUTE,
        config.startMinute,
        config.endMinute,
        durationMinutes,
      )

      const targetDate = weekDays[dayIndex] ?? weekDays[drag.originDayIndex] ?? new Date()
      const dayOfWeek = targetDate.getDay()
      const changed =
        dayOfWeek !== drag.originDayOfWeek || startMinute !== drag.originStartMinute

      const validated = validateSingleOccurrenceReschedule(
        drag.studentId,
        drag.sessionId,
        targetDate,
        startMinute,
        durationMinutes,
      )

      return {
        slotId: drag.slotId,
        sessionId: drag.sessionId,
        studentId: drag.studentId,
        studentName: drag.studentName,
        status: drag.status,
        dayIndex,
        startMinute,
        durationMinutes,
        valid: validated.ok,
        error: validated.ok ? null : validated.error,
        changed,
      }
    },
    [config.endMinute, config.startMinute, resolveDayIndex, weekDays],
  )

  const clearTracking = useCallback(() => {
    pendingPressRef.current = null
    activeDragRef.current = null
    activePointerIdRef.current = null
    lastPreviewRef.current = null
    dragMovedRef.current = false
    setPreview(null)
    setIsTracking(false)
  }, [])

  const cancelDrag = useCallback(() => {
    const hadActiveDrag = activeDragRef.current != null
    if (hadActiveDrag) {
      suppressClickUntilRef.current = Date.now() + 400
    }
    clearTracking()
  }, [clearTracking])

  const finishDrag = useCallback(() => {
    const last = lastPreviewRef.current
    const hadActiveDrag = activeDragRef.current != null
    const didMove = dragMovedRef.current

    if (hadActiveDrag) {
      suppressClickUntilRef.current = Date.now() + 400
    }

    clearTracking()

    if (hadActiveDrag && last && didMove) {
      if (last.changed && last.valid) {
        const targetDate = weekDays[last.dayIndex]
        if (targetDate) {
          if (last.slotId) {
            onPendingRecurringChange({
              studentId: last.studentId,
              studentName: last.studentName,
              sessionId: last.sessionId,
              slotId: last.slotId,
              targetDate,
              startMinute: last.startMinute,
              durationMinutes: last.durationMinutes,
              dayOfWeek: targetDate.getDay(),
            })
          } else {
            onOneOffReschedule({
              studentId: last.studentId,
              studentName: last.studentName,
              sessionId: last.sessionId,
              targetDate,
              startMinute: last.startMinute,
              durationMinutes: last.durationMinutes,
            })
          }
        }
      } else if (last.error) {
        toast.error(last.error)
      }
    }
  }, [clearTracking, onOneOffReschedule, onPendingRecurringChange, weekDays])

  const activateDrag = useCallback(
    (pending: PendingPress, clientX: number, clientY: number) => {
      pendingPressRef.current = null
      activeDragRef.current = pending.drag
      activePointerIdRef.current = pending.pointerId
      dragMovedRef.current = true
      suppressClickUntilRef.current = Date.now() + 400

      const initial = computePreview(pending.drag, clientX, clientY)
      lastPreviewRef.current = initial
      setPreview(initial)
    },
    [computePreview],
  )

  useEffect(() => {
    if (!isTracking) return

    function onPointerMove(event: PointerEvent) {
      const pending = pendingPressRef.current
      if (pending && pending.pointerId === event.pointerId) {
        const dx = event.clientX - pending.originX
        const dy = event.clientY - pending.originY
        if (Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX) {
          activateDrag(pending, event.clientX, event.clientY)
        }
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return
      const drag = activeDragRef.current
      if (!drag) return
      dragMovedRef.current = true
      const next = computePreview(drag, event.clientX, event.clientY)
      lastPreviewRef.current = next
      setPreview(next)
    }

    function onPointerUp(event: PointerEvent) {
      const pending = pendingPressRef.current
      if (pending && pending.pointerId === event.pointerId) {
        // Short press — allow the tile click to open edit.
        clearTracking()
        return
      }

      if (activePointerIdRef.current !== event.pointerId) return
      finishDrag()
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }, [isTracking, activateDrag, clearTracking, computePreview, finishDrag])

  useEffect(() => {
    if (!isTracking) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelDrag()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isTracking, cancelDrag])

  const beginDrag = useCallback(
    (args: BeginDragArgs): boolean => {
      if (!canDragScheduleEvent(args.layout)) return false

      const slotId = args.layout.row.session.sourceSlotId?.trim() || null
      const origin = sessionOriginFromLayout(args.layout, weekDays)
      const areaTop = columnsAreaRef.current?.getBoundingClientRect().top ?? 0
      const pointerOffsetY = args.clientY - areaTop - args.blockTopPx

      const drag: ActiveDrag = {
        slotId,
        sessionId: args.layout.row.session.id,
        studentId: args.layout.row.studentId,
        studentName: args.layout.row.studentName,
        status: args.layout.row.session.status,
        pointerOffsetY,
        originDayIndex: args.layout.dayIndex,
        originStartMinute: origin.startMinute,
        originDuration: origin.durationMinutes,
        originDayOfWeek: origin.dayOfWeek,
      }

      pendingPressRef.current = {
        pointerId: args.pointerId,
        originX: args.clientX,
        originY: args.clientY,
        drag,
      }
      activeDragRef.current = null
      activePointerIdRef.current = null
      lastPreviewRef.current = null
      dragMovedRef.current = false
      setPreview(null)
      setIsTracking(true)
      return true
    },
    [weekDays],
  )

  const shouldSuppressClick = useCallback(() => Date.now() < suppressClickUntilRef.current, [])

  const isDragging = preview != null

  return {
    columnsAreaRef,
    setColumnRef,
    preview,
    beginDrag,
    shouldSuppressClick,
    isDragging,
    cancelDrag,
    durationToHeightPx,
    minuteToTopPx,
  }
}

export function canDragScheduleEvent(layout: ScheduleEventBlockLayout): boolean {
  const status = layout.row.session.status
  if (status === 'in_progress' || status === 'completed' || status === 'cancelled') {
    return false
  }
  return true
}
