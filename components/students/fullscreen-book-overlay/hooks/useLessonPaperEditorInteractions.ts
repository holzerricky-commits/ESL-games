import { useCallback, useEffect } from 'react'
import type { ClipboardEvent, MutableRefObject, SetStateAction } from 'react'

type OverlayImage = { id: string; src: string; xNorm: number; yNorm: number; widthNorm: number }
type LessonPaperMode = 'type' | 'draw' | 'select'
type LessonPaperSaveState = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

interface UseLessonPaperEditorInteractionsArgs {
  lessonPaperMode: LessonPaperMode
  isLessonPaperOpen: boolean
  lessonPaperSectionId: string | null
  lessonPaperEditorRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperOverlayHostRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperOverlayDragRef: MutableRefObject<{
    id: string
    startX: number
    startY: number
    initialXNorm: number
    initialYNorm: number
  } | null>
  lessonPaperLastInputAtRef: MutableRefObject<number>
  lessonPaperHtmlRef: MutableRefObject<string>
  lessonPaperHasPendingChangesRef: MutableRefObject<boolean>
  setLessonPaperOverlayImages: (updater: SetStateAction<OverlayImage[]>) => void
  setLessonPaperEditVersion: (updater: (v: number) => number) => void
  setLessonPaperSaveState: (updater: (prev: LessonPaperSaveState) => LessonPaperSaveState) => void
  scheduleLessonPaperEditorFocus: (placeCaretAtEnd?: boolean) => void
  scheduleLessonPaperEditSync: () => void
  setLessonPaperMode: (mode: LessonPaperMode) => void
}

export function useLessonPaperEditorInteractions(args: UseLessonPaperEditorInteractionsArgs) {
  const focusLessonPaperEditor = useCallback((placeCaretAtEnd = false) => {
    const editor = args.lessonPaperEditorRef.current
    if (!editor) return
    editor.focus()
    if (!placeCaretAtEnd) return
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }, [args.lessonPaperEditorRef])

  const applyLessonPaperCommand = useCallback((command: 'bold' | 'insertUnorderedList' | 'formatBlock') => {
    const editor = args.lessonPaperEditorRef.current
    if (!editor) return
    editor.focus()
    if (command === 'formatBlock') {
      document.execCommand(command, false, 'h3')
    } else {
      document.execCommand(command)
    }
    args.lessonPaperHtmlRef.current = editor.innerHTML
    args.lessonPaperHasPendingChangesRef.current = true
    args.scheduleLessonPaperEditSync()
    args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'idle'))
  }, [args])

  const onLessonPaperInput = useCallback(() => {
    const editor = args.lessonPaperEditorRef.current
    if (!editor) return
    args.lessonPaperLastInputAtRef.current = Date.now()
    args.lessonPaperHtmlRef.current = editor.innerHTML
    args.lessonPaperHasPendingChangesRef.current = true
    args.scheduleLessonPaperEditSync()
    args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'idle'))
  }, [args])

  const onLessonPaperPaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const clipboard = e.clipboardData
    if (!clipboard) return
    const imageItem = Array.from(clipboard.items).find((item) => item.type.startsWith('image/'))
    if (args.lessonPaperMode === 'select' && imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : ''
        if (!src) return
        args.setLessonPaperOverlayImages((prev) => [
          ...prev,
          {
            id: `overlay-img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            src,
            xNorm: 0.08,
            yNorm: 0.1 + Math.min(0.7, prev.length * 0.06),
            widthNorm: 0.34,
          },
        ])
        args.lessonPaperHasPendingChangesRef.current = true
        args.setLessonPaperEditVersion((v) => v + 1)
        args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'idle'))
      }
      reader.readAsDataURL(file)
      return
    }
    if (imageItem) {
      e.preventDefault()
      const file = imageItem.getAsFile()
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        const src = typeof reader.result === 'string' ? reader.result : ''
        if (!src) return
        document.execCommand('insertHTML', false, `<p><img src="${src}" alt="Pasted lesson image" style="max-width:100%;height:auto;" /></p>`)
        onLessonPaperInput()
      }
      reader.readAsDataURL(file)
      return
    }
    const text = clipboard.getData('text/plain')
    if (!text) return
    e.preventDefault()
    document.execCommand('insertText', false, text)
    onLessonPaperInput()
  }, [args, onLessonPaperInput])

  useEffect(() => {
    if (args.lessonPaperMode !== 'select') return
    const onMove = (ev: PointerEvent) => {
      const drag = args.lessonPaperOverlayDragRef.current
      if (!drag) return
      const host = args.lessonPaperOverlayHostRef.current
      if (!host) return
      const rect = host.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const dxNorm = (ev.clientX - drag.startX) / rect.width
      const dyNorm = (ev.clientY - drag.startY) / rect.height
      args.setLessonPaperOverlayImages((prev) =>
        prev.map((img) =>
          img.id !== drag.id
            ? img
            : {
                ...img,
                xNorm: Math.max(0, Math.min(0.95, drag.initialXNorm + dxNorm)),
                yNorm: Math.max(0, Math.min(0.98, drag.initialYNorm + dyNorm)),
              },
        ),
      )
    }
    const onUp = () => {
      if (!args.lessonPaperOverlayDragRef.current) return
      args.lessonPaperOverlayDragRef.current = null
      args.lessonPaperHasPendingChangesRef.current = true
      args.setLessonPaperEditVersion((v) => v + 1)
      args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'idle'))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [args])

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    if (args.lessonPaperMode !== 'type') return
    const rafId = window.requestAnimationFrame(() => {
      focusLessonPaperEditor(true)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [args.isLessonPaperOpen, args.lessonPaperMode, args.lessonPaperSectionId, focusLessonPaperEditor])

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    args.setLessonPaperMode('type')
  }, [args.isLessonPaperOpen, args.setLessonPaperMode])

  return {
    applyLessonPaperCommand,
    onLessonPaperInput,
    onLessonPaperPaste,
    focusLessonPaperEditor,
  }
}
