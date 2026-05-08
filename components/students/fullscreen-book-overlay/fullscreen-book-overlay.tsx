'use client'

import { useFullscreenBookOverlayController } from './hooks/useFullscreenBookOverlayController'
import { FullscreenBookOverlayView } from './fullscreen-book-overlay-view'
import type { FullscreenBookOverlayProps } from './types'

export type { FullscreenBookOverlayProps } from './types'
export type { FullscreenBookOverlayViewModel } from './hooks/useFullscreenBookOverlayController'

export function FullscreenBookOverlay(props: FullscreenBookOverlayProps) {
  const vm = useFullscreenBookOverlayController(props)
  if (!vm.isMounted) return null
  return <FullscreenBookOverlayView vm={vm} onClose={props.onClose} />
}
