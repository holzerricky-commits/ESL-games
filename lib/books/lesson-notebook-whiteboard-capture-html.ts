const EMPTY_DOC = '<p><br></p>'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Appends a whiteboard snapshot block to the flowing notebook HTML doc. */
export function appendWhiteboardCaptureToNotebookHtml(
  existingHtml: string,
  input: {
    imageSrc: string
    caption: string
    bookId: string
    unitId?: string
    sessionKey?: string
    pageSpanKey: string
    whiteboardPage: number
    tocPartKey?: string
    storagePath?: string
    capturedAtIso: string
  },
): string {
  const base = existingHtml.trim() || EMPTY_DOC
  const attrs = [
    'data-notebook-entry="whiteboard_capture"',
    `data-book-id="${escapeHtml(input.bookId)}"`,
    input.unitId ? `data-unit-id="${escapeHtml(input.unitId)}"` : '',
    input.sessionKey ? `data-session-key="${escapeHtml(input.sessionKey)}"` : '',
    `data-page-span="${escapeHtml(input.pageSpanKey)}"`,
    `data-whiteboard-page="${input.whiteboardPage}"`,
    input.tocPartKey ? `data-toc-part="${escapeHtml(input.tocPartKey)}"` : '',
    input.storagePath ? `data-storage-path="${escapeHtml(input.storagePath)}"` : '',
    `data-captured-at="${escapeHtml(input.capturedAtIso)}"`,
  ]
    .filter(Boolean)
    .join(' ')

  const block = `<figure ${attrs} class="notebook-wb-capture" style="margin:1.25rem 0;"><img src="${escapeHtml(input.imageSrc)}" alt="${escapeHtml(input.caption)}" style="max-width:100%;height:auto;border-radius:8px;border:1px solid rgba(92,72,48,0.2);" /><figcaption style="margin-top:0.35rem;font-size:0.75rem;font-weight:600;color:#6b553b;">${escapeHtml(input.caption)}</figcaption></figure>`

  if (base === EMPTY_DOC) return `<p><br></p>${block}`
  return `${base}${block}`
}
