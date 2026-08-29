'use client'

import type { MutableRefObject } from 'react'
import { ImageIcon } from 'lucide-react'
import type { BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ClassToolDrawerShell } from '@/components/students/fullscreen-book-overlay/sections/ClassToolDrawerShell'
import { BoardImageSearchPanel } from '@/components/students/lesson-board/BoardImageSearchPanel'
import { useBoardImageSearchInsert } from '@/components/students/lesson-board/use-board-image-search-insert'

type PictureSearchToolPanelProps = {
  open: boolean
  onClose: () => void
  studentId: string
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  /** Lesson board is open and not minimized — enables Add to board / flashcards. */
  boardVisible: boolean
  /** Start tap-to-place on the book (or visible board). */
  onPlacePicture?: (src: string, alt: string) => void
}

/**
 * Class-tool drawer for picture search (left strip).
 * Place on the book by default; Add to board only while the board is showing.
 */
export function PictureSearchToolPanel({
  open,
  onClose,
  studentId,
  wbAnnRef,
  boardVisible,
  onPlacePicture,
}: PictureSearchToolPanelProps) {
  const onInsertImage = useBoardImageSearchInsert({ studentId, wbAnnRef })

  return (
    <ClassToolDrawerShell
      open={open}
      onClose={onClose}
      title="Pictures"
      icon={ImageIcon}
      ariaLabel="Find pictures for the book or lesson board"
    >
      <BoardImageSearchPanel
        variant="drawer"
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        onInsertImage={onInsertImage}
        canAddToBoard={boardVisible}
        onPlacePicture={
          onPlacePicture
            ? ({ fullUrl, word }) => {
                onPlacePicture(fullUrl, word || 'Picture')
              }
            : undefined
        }
      />
    </ClassToolDrawerShell>
  )
}
