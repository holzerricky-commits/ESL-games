import { useEffect, useRef, useState } from 'react'
import { isBookOverlayKeyboardTypingTarget } from '@/lib/books/book-overlay-keyboard-guards'

interface UseCtrlTemporarySelectArgs {
  enabled: boolean
  isLessonPaperOpen: boolean
}

/** Hold Control to temporarily use the select tool; release restores the prior tool. */
export function useCtrlTemporarySelect({
  enabled,
  isLessonPaperOpen,
}: UseCtrlTemporarySelectArgs): boolean {
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false
      setActive(false)
      return
    }

    function blocked(): boolean {
      return isBookOverlayKeyboardTypingTarget() && !isLessonPaperOpen
    }

    function activate(): void {
      if (blocked() || activeRef.current) return
      activeRef.current = true
      setActive(true)
    }

    function deactivate(): void {
      if (!activeRef.current) return
      activeRef.current = false
      setActive(false)
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Control') return
      activate()
    }

    function onKeyUp(e: KeyboardEvent): void {
      if (e.key !== 'Control') return
      deactivate()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', deactivate)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', deactivate)
      deactivate()
    }
  }, [enabled, isLessonPaperOpen])

  return active
}
