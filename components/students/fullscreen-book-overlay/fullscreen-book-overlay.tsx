'use client'

import { useFullscreenBookOverlayController } from './hooks/useFullscreenBookOverlayController'
import { FullscreenBookOverlayView } from './fullscreen-book-overlay-view'
import type { FullscreenBookOverlayProps } from './types'

export type { FullscreenBookOverlayProps } from './types'
export type { FullscreenBookOverlayViewModel } from './hooks/useFullscreenBookOverlayController'

export function FullscreenBookOverlay(props: FullscreenBookOverlayProps) {
  const vm = useFullscreenBookOverlayController(props)
  // Before first open: render nothing. After first open: keep the view mounted while closed (B1) so state stays warm.
  if (!vm.isMounted && !props.open) return null
  return <FullscreenBookOverlayView vm={vm} onClose={props.onClose} />
}
