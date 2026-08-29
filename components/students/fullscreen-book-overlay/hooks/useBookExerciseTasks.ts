'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { capturePdfPageNormRectJpeg } from '@/lib/books/capture-page-rect-client'
import {
  BOOK_EXERCISE_KIND_WORD_BANK,
  isBookExerciseMultipleChoice,
  parseBookExerciseKind,
  type BookExerciseKind,
  type BookExerciseTask,
  type PageNormRect,
} from '@/lib/books/book-exercises'

export type UseBookExerciseTasksArgs = {
  bookId: string | null | undefined
  unitId: string | null | undefined
  fileUrl?: string | null
}

export function useBookExerciseTasks({ bookId, unitId, fileUrl }: UseBookExerciseTasksArgs) {
  const [boxDrawActive, setBoxDrawActive] = useState(false)
  const [boxDrawKind, setBoxDrawKind] = useState<BookExerciseKind>(BOOK_EXERCISE_KIND_WORD_BANK)
  const [allTasks, setAllTasks] = useState<BookExerciseTask[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [saving, setSaving] = useState(false)
  const [drafting, setDrafting] = useState(false)

  useEffect(() => {
    setBoxDrawActive(false)
    setSelectedTaskId(null)
  }, [bookId, unitId])

  useEffect(() => {
    if (!bookId) {
      setAllTasks([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/books/exercises?bookId=${encodeURIComponent(bookId)}`)
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          items?: BookExerciseTask[]
        }
        if (cancelled) return
        if (res.ok && body.ok && Array.isArray(body.items)) {
          setAllTasks(body.items)
        } else {
          setAllTasks([])
        }
      } catch {
        if (!cancelled) setAllTasks([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [bookId, revision])

  const tasks = useMemo(() => {
    if (!unitId) return []
    return allTasks.filter((task) => task.unitId === unitId)
  }, [allTasks, unitId])

  const startBoxDraw = useCallback((kind?: BookExerciseKind | string) => {
    if (!bookId || !unitId) {
      toast.error('Open a book unit before boxing a task.')
      return
    }
    if (kind != null) setBoxDrawKind(parseBookExerciseKind(kind))
    setBoxDrawActive(true)
  }, [bookId, unitId])

  const cancelBoxDraw = useCallback(() => {
    setBoxDrawActive(false)
  }, [])

  const placeExerciseBox = useCallback(
    async (pdfPage: number, rect: PageNormRect) => {
      if (!bookId || !unitId) {
        setBoxDrawActive(false)
        return false
      }
      try {
        const res = await fetch('/api/books/exercises', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, unitId, pdfPage, rect, kind: boxDrawKind }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookExerciseTask
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not save that box.')
          return false
        }
        setAllTasks((prev) => [...prev, body.item!])
        setSelectedTaskId(body.item.id)
        setBoxDrawActive(false)
        toast.success(
          isBookExerciseMultipleChoice(body.item)
            ? `${body.item.label} saved — choose-answer (empty).`
            : `${body.item.label} saved — add the word bank.`,
        )
        return true
      } catch {
        toast.error('Could not save that box.')
        return false
      }
    },
    [bookId, unitId, boxDrawKind],
  )

  const removeExerciseTask = useCallback(
    async (taskId: string) => {
      if (!bookId) return false
      const previous = allTasks
      setAllTasks((prev) => prev.filter((task) => task.id !== taskId))
      if (selectedTaskId === taskId) setSelectedTaskId(null)
      try {
        const res = await fetch(
          `/api/books/exercises?bookId=${encodeURIComponent(bookId)}&taskId=${encodeURIComponent(taskId)}`,
          { method: 'DELETE' },
        )
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
        if (!res.ok || !body.ok) {
          setAllTasks(previous)
          toast.error(body.error ?? 'Could not remove that task.')
          return false
        }
        return true
      } catch {
        setAllTasks(previous)
        toast.error('Could not remove that task.')
        return false
      }
    },
    [allTasks, bookId, selectedTaskId],
  )

  const saveExerciseTask = useCallback(
    async (
      taskId: string,
      patch: {
        label?: string
        wordBank?: string[]
        items?: BookExerciseTask['items']
        questions?: BookExerciseTask['questions']
        status?: BookExerciseTask['status']
        pin?: [number, number]
      },
    ) => {
      if (!bookId) return false
      setSaving(true)
      try {
        const res = await fetch('/api/books/exercises', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, taskId, ...patch }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookExerciseTask
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not save the exercise.')
          return false
        }
        setAllTasks((prev) => prev.map((task) => (task.id === taskId ? body.item! : task)))
        if (patch.status === 'approved') toast.success(`${body.item.label} approved.`)
        else if (patch.status === 'draft' && body.item.status === 'draft') toast.success('Saved as draft.')
        else toast.success('Saved.')
        return true
      } catch {
        toast.error('Could not save the exercise.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [bookId],
  )

  const moveExercisePin = useCallback(
    async (taskId: string, pin: [number, number]) => {
      if (!bookId) return false
      setAllTasks((prev) =>
        prev.map((task) => (task.id === taskId ? { ...task, pin } : task)),
      )
      try {
        const res = await fetch('/api/books/exercises', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, taskId, pin }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookExerciseTask
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not move the icon.')
          setRevision((n) => n + 1)
          return false
        }
        setAllTasks((prev) => prev.map((task) => (task.id === taskId ? body.item! : task)))
        return true
      } catch {
        toast.error('Could not move the icon.')
        setRevision((n) => n + 1)
        return false
      }
    },
    [bookId],
  )

  const draftExerciseFromBox = useCallback(
    async (taskId: string) => {
      if (!bookId) return false
      const current = allTasks.find((task) => task.id === taskId)
      if (!current) return false
      const pdfUrl = fileUrl?.trim() ?? ''
      if (!pdfUrl) {
        toast.error('Open a book unit before drafting from the box.')
        return false
      }
      setDrafting(true)
      try {
        const jpegBase64 = await capturePdfPageNormRectJpeg({
          fileUrl: pdfUrl,
          pdfPage: current.pdfPage,
          rect: current.rect,
        })
        const res = await fetch('/api/books/exercises/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookId, taskId, jpegBase64 }),
        })
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          item?: BookExerciseTask
        }
        if (!res.ok || !body.ok || !body.item) {
          toast.error(body.error ?? 'Could not draft from that box.')
          return false
        }
        setAllTasks((prev) => prev.map((task) => (task.id === taskId ? body.item! : task)))
        toast.success(
          isBookExerciseMultipleChoice(body.item)
            ? 'Draft ready — check the questions and choices, then Approve.'
            : 'Draft ready — check the bank and gaps, then Approve.',
        )
        return true
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not draft from that box.')
        return false
      } finally {
        setDrafting(false)
      }
    },
    [allTasks, bookId, fileUrl],
  )

  return {
    boxDrawActive,
    boxDrawKind,
    setBoxDrawKind,
    tasks,
    allTasks,
    loading,
    saving,
    drafting,
    selectedTaskId,
    setSelectedTaskId,
    startBoxDraw,
    cancelBoxDraw,
    placeExerciseBox,
    removeExerciseTask,
    saveExerciseTask,
    moveExercisePin,
    draftExerciseFromBox,
    refreshTasks: () => setRevision((n) => n + 1),
  }
}
