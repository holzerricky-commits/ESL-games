'use client'

import { useCallback, useEffect, useState } from 'react'

type DocWithWebkit = Document & {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void>
}

type ElWithWebkit = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>
}

type NavigatorWithKeyboard = Navigator & {
  keyboard?: {
    lock?: (keyCodes?: string[]) => Promise<void>
    unlock?: () => void
  }
}

function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null
  const doc = document as DocWithWebkit
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null
}

function isFullscreenApiSupported(): boolean {
  if (typeof document === 'undefined') return false
  const el = document.documentElement as ElWithWebkit
  return Boolean(el.requestFullscreen || el.webkitRequestFullscreen)
}

/** Keep Esc for in-app actions; do not let it leave browser full screen. */
async function lockEscapeFromExitingFullscreen(): Promise<void> {
  try {
    const keyboard = (navigator as NavigatorWithKeyboard).keyboard
    await keyboard?.lock?.(['Escape'])
  } catch {
    // Unsupported / denied — Esc may still exit full screen in that browser
  }
}

function unlockKeyboard(): void {
  try {
    ;(navigator as NavigatorWithKeyboard).keyboard?.unlock?.()
  } catch {
    // ignore
  }
}

/**
 * Real browser full screen (hides tabs / address bar), not app "fullscreen" layout.
 * Keyboard in/out: F only. Esc is locked so it does not leave full screen.
 */
export function useBrowserFullscreen() {
  const [supported, setSupported] = useState(false)
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false)

  useEffect(() => {
    setSupported(isFullscreenApiSupported())
    setIsBrowserFullscreen(getFullscreenElement() != null)

    const sync = () => {
      const active = getFullscreenElement() != null
      setIsBrowserFullscreen(active)
      if (active) void lockEscapeFromExitingFullscreen()
      else unlockKeyboard()
    }
    document.addEventListener('fullscreenchange', sync)
    document.addEventListener('webkitfullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      document.removeEventListener('webkitfullscreenchange', sync)
      unlockKeyboard()
    }
  }, [])

  const enter = useCallback(async () => {
    if (!isFullscreenApiSupported()) return
    const el = document.documentElement as ElWithWebkit
    try {
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' })
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
      }
      await lockEscapeFromExitingFullscreen()
    } catch {
      // User gesture required / browser denied — ignore
    }
  }, [])

  const exit = useCallback(async () => {
    if (!isFullscreenApiSupported()) return
    if (!getFullscreenElement()) return
    const doc = document as DocWithWebkit
    unlockKeyboard()
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      }
    } catch {
      // ignore
    }
  }, [])

  const toggle = useCallback(() => {
    if (getFullscreenElement()) void exit()
    else void enter()
  }, [enter, exit])

  return { supported, isBrowserFullscreen, enter, exit, toggle }
}
