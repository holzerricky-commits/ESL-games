'use client'

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
const FLOATING_SIDE_TOOLBAR_BUTTON_INTERACTION =
  'floating-side-toolbar__btn group relative flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent outline-none transition-[box-shadow,transform,color] duration-200 ease-out will-change-transform active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35'

/** Icon buttons inside the floating side toolbar — transparent until hover/active. */
export const FLOATING_SIDE_TOOLBAR_BUTTON = cn(
  FLOATING_SIDE_TOOLBAR_BUTTON_INTERACTION,
  'rounded-full',
)

/** Active slot depression + tracking-node hooks (see globals.css). */
export const FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE = 'floating-side-toolbar__btn--active'

export const FLOATING_SIDE_TOOLBAR_ICON = 'shrink-0 stroke-[2] text-[#a1a1aa]'

interface FloatingSideToolbarProps {
  children: ReactNode
  className?: string
  /** Visually hide while keeping layout slot (capture mode, etc.). */
  hidden?: boolean
  /** Pin to viewport; set false when a parent handles placement. */
  fixed?: boolean
  maxHeight?: string
  /** Pill (annotation rail) vs full-height edge strip (workspace left bar). */
  shape?: 'pill' | 'fullHeight'
  /** Which viewport edge when `fixed` is true. */
  edge?: 'left' | 'right'
  'aria-label'?: string
}

/** Premium matte slate-teal pillar — fixed on the book workspace edge. */
export const FloatingSideToolbar = forwardRef<HTMLDivElement, FloatingSideToolbarProps>(
  function FloatingSideToolbar(
    {
      children,
      className,
      hidden = false,
      fixed = true,
      maxHeight = 'calc(100vh - 120px)',
      shape = 'pill',
      edge = 'right',
      'aria-label': ariaLabel = 'Book tools',
    },
    ref,
  ) {
    const isFullHeight = shape === 'fullHeight'
    return (
      <div
        className={cn(
          'floating-side-toolbar pointer-events-auto isolate shrink-0 overflow-hidden',
          isFullHeight ? 'floating-side-toolbar--full-height' : 'rounded-[9999px]',
          edge === 'left' && 'floating-side-toolbar--edge-left',
          fixed &&
            (isFullHeight
              ? cn(
                  'fixed top-0 z-[28] h-screen',
                  edge === 'left' ? 'left-0' : 'right-0',
                )
              : cn(
                  'fixed top-1/2 z-[28] -translate-y-1/2 transform-gpu',
                  edge === 'left' ? 'left-0' : 'right-0',
                )),
          hidden && 'invisible opacity-0',
          className,
        )}
        style={isFullHeight ? undefined : { maxHeight }}
        role="toolbar"
        aria-label={ariaLabel}
      >
        <div
          ref={ref}
          className={cn(
            'floating-side-toolbar__scroll flex max-h-[inherit] flex-col items-center overflow-x-visible',
            isFullHeight
              ? 'h-full overflow-y-hidden [scrollbar-width:none]'
              : 'overflow-y-auto [scrollbar-width:thin]',
          )}
        >
          {children}
        </div>
      </div>
    )
  },
)

interface FloatingSideToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: LucideIcon
  active?: boolean
  children?: ReactNode
}

export const FloatingSideToolbarButton = forwardRef<HTMLButtonElement, FloatingSideToolbarButtonProps>(
  function FloatingSideToolbarButton(
    { icon: Icon, active = false, className, children, type = 'button', ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(FLOATING_SIDE_TOOLBAR_BUTTON, active && FLOATING_SIDE_TOOLBAR_BUTTON_ACTIVE, className)}
        {...props}
      >
        {Icon ? <Icon className={FLOATING_SIDE_TOOLBAR_ICON} aria-hidden /> : null}
        {children}
      </button>
    )
  },
)

export function FloatingSideToolbarDivider({ className }: { className?: string }) {
  return <span className={cn('floating-side-toolbar__divider h-px shrink-0', className)} aria-hidden />
}
