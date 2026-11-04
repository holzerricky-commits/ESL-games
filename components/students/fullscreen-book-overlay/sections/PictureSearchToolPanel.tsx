'use client'

import { useCallback, type MutableRefObject } from 'react'
import { ImageIcon } from 'lucide-react'
import type { BookPageAnnotationHandle } from '@/components/students/book-page-annotation-layer'
import { ClassToolDrawerShell } from '@/components/students/fullscreen-book-overlay/sections/ClassToolDrawerShell'
import { BoardImageSearchPanel } from '@/components/students/lesson-board/BoardImageSearchPanel'
import { useBoardImageSearchInsert } from '@/components/students/lesson-board/use-board-image-search-insert'
import type { BoardImageInsertRequest } from '@/lib/lesson-board/board-image-insert'

type PictureSearchToolPanelProps = {
  open: boolean
  onClose: () => void
  studentId: string
  wbAnnRef: MutableRefObject<BookPageAnnotationHandle | null>
  /** Lesson board is open and not minimized — enables Add to board / flashcards. */
  boardVisible: boolean
  /** Start tap-to-place on the book (or visible board). */
  onPlacePicture?: (src: string, alt: string) => void
  /** Prefill search when the drawer opens (e.g. from vocab deep dive). */
  initialQuery?: string
  /** Any picture placed or added to the board, with the search word (vault reuses it on save). */
  onPictureChosen?: (word: string, src: string) => void
  /** When set, the picked picture goes on this vault card instead of the book. */
  vaultCardWord?: string | null
  onPickForVaultCard?: (src: string) => void
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
  initialQuery = '',
  onPictureChosen,
  vaultCardWord = null,
  onPickForVaultCard,
}: PictureSearchToolPanelProps) {
  const insertImage = useBoardImageSearchInsert({ studentId, wbAnnRef })
  const onInsertImage = useCallback(
    async (request: BoardImageInsertRequest) => {
      const ok = await insertImage(request)
      if (ok) onPictureChosen?.(request.word, request.fullUrl)
      return ok
    },
    [insertImage, onPictureChosen],
  )

  const pickingForCard = vaultCardWord != null && onPickForVaultCard != null

  return (
    <ClassToolDrawerShell
      open={open}
      onClose={onClose}
      title={pickingForCard ? `Picture for “${vaultCardWord}”` : 'Pictures'}
      icon={ImageIcon}
      ariaLabel={pickingForCard ? 'Find a picture for the vault card' : 'Find pictures for the book or lesson board'}
    >
      <BoardImageSearchPanel
        variant="drawer"
        open={open}
        initialQuery={initialQuery}
        onOpenChange={(next) => {
          if (!next) onClose()
        }}
        onInsertImage={onInsertImage}
        canAddToBoard={pickingForCard ? false : boardVisible}
        placeButtonLabel={pickingForCard ? 'Use for card' : undefined}
        placeHint={pickingForCard ? 'The picture goes on the front of the vault card.' : undefined}
        onPlacePicture={
          pickingForCard
            ? ({ fullUrl }) => onPickForVaultCard(fullUrl)
            : onPlacePicture
              ? ({ fullUrl, word }) => {
                  onPictureChosen?.(word, fullUrl)
                  onPlacePicture(fullUrl, word || 'Picture')
                }
              : undefined
        }
      />
    </ClassToolDrawerShell>
  )
}
