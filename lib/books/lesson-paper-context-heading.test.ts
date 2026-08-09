import { describe, expect, it } from 'vitest'
import { buildLessonPaperContextHeadingHtml, escapeHtml } from '@/lib/books/lesson-paper-context-heading'

describe('escapeHtml', () => {
  it('escapes markup characters', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">`)).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
    )
  })
})

describe('buildLessonPaperContextHeadingHtml', () => {
  it('does not embed raw HTML from a malicious part title', () => {
    const html = buildLessonPaperContextHeadingHtml({
      contextKey: 'part::vocab',
      title: `<img src=x onerror="alert('xss')">`,
      pageSpanKey: 'p12-p13',
      activeClassSessionId: 'session-1',
    })

    expect(html).not.toMatch(/<img\b/i)
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(\'xss\')&quot;&gt;')
    expect(html).toContain('data-notebook-context="part::vocab"')
    expect(html).toContain('data-session-key="session-1"')
    expect(html).toContain('>12-p13</span>')
  })

  it('escapes quote breakouts in context keys and page spans', () => {
    const html = buildLessonPaperContextHeadingHtml({
      contextKey: `part::x" onload="alert(1)`,
      title: 'Safe title',
      pageSpanKey: `p1"><img src=x onerror=alert(1)>`,
      activeClassSessionId: `sess" onclick="alert(1)`,
    })

    expect(html).not.toContain('onload="alert(1)"')
    expect(html).not.toContain('onclick="alert(1)"')
    expect(html).not.toContain('<img')
    expect(html).toContain('data-notebook-context="part::x&quot; onload=&quot;alert(1)"')
    expect(html).toContain('data-page-span="p1&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"')
    expect(html).toContain('data-session-key="sess&quot; onclick=&quot;alert(1)"')
  })

  it('falls back to the page span when the title is blank', () => {
    const html = buildLessonPaperContextHeadingHtml({
      contextKey: 'part::empty',
      title: '   ',
      pageSpanKey: 'p4',
    })
    expect(html).toContain('<h3')
    expect(html).toContain('>p4</h3>')
  })
})
