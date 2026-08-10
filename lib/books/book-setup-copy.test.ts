import { describe, expect, it } from 'vitest'
import {
  buildBooksPageHref,
  defaultBookSetupTab,
  defaultTabForPrepStage,
  parseBookSetupTab,
  prepStageFromTab,
  resolveBookSetupTab,
} from '@/lib/books/book-setup-copy'

describe('book-setup-copy', () => {
  it('parseBookSetupTab accepts valid tabs', () => {
    expect(parseBookSetupTab('materials')).toBe('materials')
    expect(parseBookSetupTab('stories')).toBe('stories')
    expect(parseBookSetupTab('nope')).toBeNull()
  })

  it('maps legacy check-pages URLs to outline', () => {
    expect(parseBookSetupTab('check-pages')).toBe('outline')
  })

  it('maps stage aliases to tabs', () => {
    expect(parseBookSetupTab('map')).toBe('outline')
    expect(parseBookSetupTab('ready')).toBe('stories')
    expect(parseBookSetupTab('tools')).toBe('materials')
  })

  it('defaultBookSetupTab is Outline until mapped, then Materials', () => {
    expect(defaultBookSetupTab(false)).toBe('outline')
    expect(defaultBookSetupTab(true)).toBe('materials')
  })

  it('resolveBookSetupTab falls back to default', () => {
    expect(resolveBookSetupTab(null, false)).toBe('outline')
    expect(resolveBookSetupTab(null, true)).toBe('materials')
    expect(resolveBookSetupTab('plan', true)).toBe('plan')
  })

  it('prepStageFromTab maps tabs to legacy stages', () => {
    expect(prepStageFromTab('outline')).toBe('map')
    expect(prepStageFromTab('stories')).toBe('ready')
    expect(prepStageFromTab('materials')).toBe('tools')
    expect(prepStageFromTab('advanced')).toBe('tools')
  })

  it('defaultTabForPrepStage keeps tools sub-tab when possible', () => {
    expect(defaultTabForPrepStage('map')).toBe('outline')
    expect(defaultTabForPrepStage('ready')).toBe('stories')
    expect(defaultTabForPrepStage('tools')).toBe('materials')
    expect(defaultTabForPrepStage('tools', 'plan')).toBe('plan')
  })

  it('buildBooksPageHref builds query string', () => {
    expect(buildBooksPageHref({ book: 'wonders', tab: 'outline', student: 's1' })).toBe(
      '/books?book=wonders&tab=outline&student=s1',
    )
    expect(buildBooksPageHref({ book: 'wonders', unit: 'u1', lesson: 'l1', part: 'p1' })).toBe(
      '/books?book=wonders&unit=u1&lesson=l1&part=p1',
    )
  })
})
