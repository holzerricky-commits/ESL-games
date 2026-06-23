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
  if (variant === 'speech') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
        <rect x="2" y="2.5" width="14" height="8" rx="3" fill="#ffffff" stroke={stroke} strokeWidth="1.2" />
        <path d="M7 10.5 V13.5 L10 10.5 Z" fill="#ffffff" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    )
  }
  if (variant === 'thought') {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
        <ellipse cx="9" cy="7" rx="6.5" ry="4.2" fill="#ffffff" stroke={stroke} strokeWidth="1.2" strokeDasharray="2.5 1.5" />
        <circle cx="6.5" cy="13.5" r="1.4" fill="#ffffff" stroke={stroke} strokeWidth="1" />
        <circle cx="9.5" cy="15" r="0.9" fill="#ffffff" stroke={stroke} strokeWidth="1" />
      </svg>
    )
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className={iconCls}>
      <rect x="2" y="5" width="14" height="7" rx="1.5" fill="#1e293b" stroke="none" />
      <path d="M5 8.5 H13" stroke="#f8fafc" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}
