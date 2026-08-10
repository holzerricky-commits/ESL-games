import { useEffect, useRef, useState } from 'react'
import { shouldDeferBookOverlayToolShortcuts } from '@/lib/books/book-overlay-keyboard-guards'

interface UseCtrlTemporarySelectArgs {
  enabled: boolean
}

/** Hold Control to temporarily use the select tool; release restores the prior tool. */
export function useCtrlTemporarySelect({ enabled }: UseCtrlTemporarySelectArgs): boolean {
  const [active, setActive] = useState(false)
  const activeRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      activeRef.current = false
      setActive(false)
      return
    }

    function blocked(): boolean {
      return shouldDeferBookOverlayToolShortcuts()
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

    function onBlur(): void {
      deactivate()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
      deactivate()
    }
  }, [enabled])

  return active
}
