'use client'

import type { ReactNode } from 'react'
import type { WritableStickerVariant } from '@/lib/books/annotation-command-types'
import { TOOLBAR_ICON_CLASS } from '@/components/students/annotation-toolbar-icon'

const iconCls = TOOLBAR_ICON_CLASS
const stroke = 'currentColor'

export function writableStickerIcon(variant: WritableStickerVariant): ReactNode {
  if (variant === 'note') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
        <rect x="3" y="2" width="12" height="14" rx="1.5" fill="#fef3c7" stroke={stroke} strokeWidth="0.8" opacity="0.95" />
        <rect x="3" y="2" width="12" height="4" rx="1.5" fill="#fde68a" stroke="none" />
      </svg>
    )
  }
  if (variant === 'caption') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
        <rect x="2" y="5" width="14" height="7" rx="1.5" fill="#1e293b" stroke="none" />
        <path d="M5 8.5 H13" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    )
  }
  if (variant === 'speech') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
        <rect x="3" y="3" width="12" height="8" fill="#ffffff" stroke={stroke} strokeWidth="0.9" />
        <path
          d="M5 11 L5 15 L9 11 Z"
          fill="#ffffff"
          stroke={stroke}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
      <ellipse cx="10" cy="7" rx="6.5" ry="4.5" fill="#ffffff" stroke={stroke} strokeWidth="0.9" />
      <circle cx="5.5" cy="10" r="1.1" fill="#ffffff" stroke={stroke} strokeWidth="0.65" />
      <circle cx="3.5" cy="12.5" r="0.8" fill="#ffffff" stroke={stroke} strokeWidth="0.55" />
      <circle cx="2" cy="14.5" r="0.55" fill="#ffffff" stroke={stroke} strokeWidth="0.45" />
    </svg>
  )
}
