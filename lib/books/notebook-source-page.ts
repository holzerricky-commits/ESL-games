/** Parse `p12` or `p12-14` into the first PDF page number for navigation. */
export function parseNotebookPageSpanKeyToPdfPage(pageSpanKey: string): number | null {
  const trimmed = pageSpanKey.trim().replace(/^p/i, '')
  if (!trimmed) return null
  const start = trimmed.split('-')[0]?.trim()
  const n = Number.parseInt(start ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : null
}

export type NotebookSourceAnchor = {
  id: string
  label: string
  page: number
  kind: 'part' | 'whiteboard_capture'
  category: 'vocabulary' | 'sentences' | 'concepts' | 'diagrams'
  sessionKey: string
  sessionLabel: string
}

export type NotebookSourceFilter = 'all' | NotebookSourceAnchor['category']
export type NotebookSourceAnchorList = { anchors: NotebookSourceAnchor[]; truncated: boolean }
export type NotebookSourceGroup = {
  sessionKey: string
  sessionLabel: string
  anchors: NotebookSourceAnchor[]
}

function classifyAnchorCategory(label: string, kind: NotebookSourceAnchor['kind']): NotebookSourceAnchor['category'] {
  const lower = label.toLowerCase()
  if (kind === 'whiteboard_capture') return 'diagrams'
  if (lower.includes('vocab') || lower.includes('word') || lower.includes('translation')) return 'vocabulary'
  if (lower.includes('sentence') || lower.includes('grammar') || lower.includes('example')) return 'sentences'
  return 'concepts'
}

function sessionLabelFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Current session'
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Extract navigable source anchors from notebook HTML. */
export function listNotebookSourceAnchors(
  html: string,
  options?: { maxAnchors?: number },
): NotebookSourceAnchorList {
  if (!html.trim() || typeof document === 'undefined') return { anchors: [], truncated: false }
  const maxAnchors = Math.max(20, Math.min(2000, options?.maxAnchors ?? 120))
  const root = document.createElement('div')
  root.innerHTML = html
  const anchors: NotebookSourceAnchor[] = []
  let truncated = false

  const partEls = root.querySelectorAll('[data-notebook-marker]')
  for (let index = 0; index < partEls.length; index += 1) {
    if (anchors.length >= maxAnchors) {
      truncated = true
      break
    }
    const el = partEls[index]!
    const pageSpan = el.getAttribute('data-page-span')?.trim()
    const page =
      parseNotebookPageSpanKeyToPdfPage(pageSpan ?? '') ??
      parseNotebookPageSpanKeyToPdfPage(el.querySelector('span')?.textContent?.trim() ?? '')
    if (!page) continue
    const title = el.querySelector('h3')?.textContent?.trim() || `Part ${index + 1}`
    const sessionKey = el.getAttribute('data-session-key')?.trim() || 'current-session'
    anchors.push({
      id: el.getAttribute('data-notebook-marker') ?? `part-${index}`,
      label: title,
      page,
      kind: 'part',
      category: classifyAnchorCategory(title, 'part'),
      sessionKey,
      sessionLabel: sessionKey === 'current-session' ? 'Current session' : 'Session',
    })
  }

  const captureEls = root.querySelectorAll('[data-notebook-entry="whiteboard_capture"]')
  for (let index = 0; index < captureEls.length; index += 1) {
    if (anchors.length >= maxAnchors) {
      truncated = true
      break
    }
    const el = captureEls[index]!
    const wbPage = Number(el.getAttribute('data-whiteboard-page'))
    const pageSpan = el.getAttribute('data-page-span')?.trim()
    const page =
      (Number.isFinite(wbPage) && wbPage >= 1 ? Math.floor(wbPage) : null) ??
      parseNotebookPageSpanKeyToPdfPage(pageSpan ?? '')
    if (!page) continue
    const caption = el.querySelector('figcaption')?.textContent?.trim() || `Whiteboard ${index + 1}`
    const capturedAt = el.getAttribute('data-captured-at')?.trim() ?? ''
    const sessionKey = el.getAttribute('data-session-key')?.trim() || (capturedAt ? capturedAt.slice(0, 10) : 'current-session')
    anchors.push({
      id: `wb-${el.getAttribute('data-captured-at') ?? index}`,
      label: caption,
      page,
      kind: 'whiteboard_capture',
      category: classifyAnchorCategory(caption, 'whiteboard_capture'),
      sessionKey,
      sessionLabel: capturedAt ? sessionLabelFromIso(capturedAt) : sessionKey === 'current-session' ? 'Current session' : 'Session',
    })
  }

  return { anchors, truncated }
}

export function groupNotebookSourceAnchors(anchors: NotebookSourceAnchor[]): NotebookSourceGroup[] {
  const grouped = new Map<string, NotebookSourceGroup>()
  for (const anchor of anchors) {
    const current = grouped.get(anchor.sessionKey)
    if (current) {
      current.anchors.push(anchor)
      continue
    }
    grouped.set(anchor.sessionKey, {
      sessionKey: anchor.sessionKey,
      sessionLabel: anchor.sessionLabel,
      anchors: [anchor],
    })
  }
  return [...grouped.values()]
}
