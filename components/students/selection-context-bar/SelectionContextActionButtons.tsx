'use client'

import { Copy, Trash2 } from 'lucide-react'
import {
  SELECTION_CONTEXT_BAR_ACTION_BTN,
  SELECTION_CONTEXT_BAR_DELETE_BTN,
} from '@/components/students/selection-context-bar/selection-context-bar-styles'

export function SelectionContextActionButtons({
  onDuplicate,
  onDelete,
  duplicateLabel = 'Duplicate selection',
  deleteLabel = 'Delete selection',
}: {
  onDuplicate: () => void
  onDelete: () => void
  duplicateLabel?: string
  deleteLabel?: string
}) {
  return (
    <>
      <button
        type="button"
        className={SELECTION_CONTEXT_BAR_ACTION_BTN}
        aria-label={duplicateLabel}
        title="Duplicate"
        onClick={onDuplicate}
      >
        <Copy className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
      <button
        type="button"
        className={SELECTION_CONTEXT_BAR_DELETE_BTN}
        aria-label={deleteLabel}
        title="Delete"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
      </button>
    </>
  )
}
