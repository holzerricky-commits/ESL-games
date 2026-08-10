import {
  resolvePastedBoardImage,
  type PastedBoardImageResolution,
} from '@/lib/books/clipboard-image'

type BoardImageDragEvent = {
  dataTransfer: DataTransfer | null
  preventDefault: () => void
  stopPropagation: () => void
}

export function isBoardImageDragEvent(
  event: Pick<BoardImageDragEvent, 'dataTransfer'>,
): boolean {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files')
}

export function preventBoardImageDragDefaults(event: BoardImageDragEvent): void {
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

export function resolveDroppedBoardImage(
  dataTransfer: DataTransfer,
): Promise<PastedBoardImageResolution | null> {
  return resolvePastedBoardImage(dataTransfer)
}
