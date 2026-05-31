import { useCallback, useEffect, useRef } from 'react'
import type { ClipboardEvent, MutableRefObject } from 'react'
import { getContentEditablePlainText } from '@/lib/writing-assist/caret-text'

type LessonPaperSaveState = 'idle' | 'typing' | 'saving' | 'saved' | 'error'

interface UseLessonPaperEditorInteractionsArgs {
  isLessonPaperOpen: boolean
  lessonPaperEditorRef: MutableRefObject<HTMLDivElement | null>
  lessonPaperLastInputAtRef: MutableRefObject<number>
  lessonPaperHtmlRef: MutableRefObject<string>
  lessonPaperHasPendingChangesRef: MutableRefObject<boolean>
  setLessonPaperEditVersion: (updater: (v: number) => number) => void
  setLessonPaperSaveState: (updater: (prev: LessonPaperSaveState) => LessonPaperSaveState) => void
  scheduleLessonPaperEditSync: () => void
  onNotebookIntent?: (trigger: 'typing' | 'paste') => void
}

export function useLessonPaperEditorInteractions(args: UseLessonPaperEditorInteractionsArgs) {
  const typingIntentFiredRef = useRef(false)

  useEffect(() => {
    if (!args.isLessonPaperOpen) typingIntentFiredRef.current = false
  }, [args.isLessonPaperOpen])

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
    args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'typing'))
  }, [args])

  const onLessonPaperInput = useCallback(() => {
    const editor = args.lessonPaperEditorRef.current
    if (!editor) return
    args.lessonPaperLastInputAtRef.current = Date.now()
    args.lessonPaperHtmlRef.current = editor.innerHTML
    args.lessonPaperHasPendingChangesRef.current = true
    args.scheduleLessonPaperEditSync()
    args.setLessonPaperSaveState((prev) => (prev === 'saving' ? prev : 'typing'))
    if (!typingIntentFiredRef.current && args.onNotebookIntent) {
      const text = getContentEditablePlainText(editor)
      if (text.trim()) {
        typingIntentFiredRef.current = true
        args.onNotebookIntent('typing')
      }
    }
  }, [args])

  const onLessonPaperPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      const clipboard = e.clipboardData
      if (!clipboard) return
      const imageItem = Array.from(clipboard.items).find((item) => item.type.startsWith('image/'))
      if (imageItem) {
        e.preventDefault()
        const file = imageItem.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = () => {
          const src = typeof reader.result === 'string' ? reader.result : ''
          if (!src) return
          document.execCommand(
            'insertHTML',
            false,
            `<p><img src="${src}" alt="Pasted lesson image" style="max-width:100%;height:auto;" /></p>`,
          )
          args.onNotebookIntent?.('paste')
          onLessonPaperInput()
        }
        reader.readAsDataURL(file)
        return
      }
      const text = clipboard.getData('text/plain')
      if (!text) return
      e.preventDefault()
      document.execCommand('insertText', false, text)
      args.onNotebookIntent?.('paste')
      onLessonPaperInput()
    },
    [args, onLessonPaperInput],
  )

  useEffect(() => {
    if (!args.isLessonPaperOpen) return
    const rafId = window.requestAnimationFrame(() => {
      focusLessonPaperEditor(false)
    })
    return () => window.cancelAnimationFrame(rafId)
  }, [args.isLessonPaperOpen, focusLessonPaperEditor])

  return {
    applyLessonPaperCommand,
    onLessonPaperInput,
    onLessonPaperPaste,
    focusLessonPaperEditor,
  }
}
