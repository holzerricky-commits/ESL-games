import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  effectiveStrokeToolForPointer,
  ensurePenBarrelButtonTracker,
  isAnnotationPointerDownAccepted,
  isPenBarrelEraserActive,
  isPenBarrelHeld,
  isPenTipContactActive,
  PEN_BUTTONS_BARREL_MASK,
  PEN_POINTER_ERASER_BUTTON,
  resetPenBarrelButtonTrackerForTests,
} from './pen-barrel-button'

function penEvent(
  partial: Partial<Pick<PointerEvent, 'pointerType' | 'button' | 'buttons' | 'pointerId'>>,
): Pick<PointerEvent, 'pointerType' | 'button' | 'buttons' | 'pointerId'> {
  return {
    pointerType: 'pen',
    button: 0,
    buttons: 1,
    pointerId: 1,
    ...partial,
  }
}

describe('pen-barrel-button', () => {
  beforeEach(() => {
    resetPenBarrelButtonTrackerForTests()
  })

  it('detects barrel via buttons secondary bit', () => {
    expect(isPenBarrelEraserActive(penEvent({ buttons: 1 | 0x2 }))).toBe(true)
  })

  it('detects barrel via tip + eraser bits (standard Windows)', () => {
    expect(isPenBarrelEraserActive(penEvent({ buttons: 1 | 0x20 }))).toBe(true)
  })

  it('does not treat Samsung tip-only buttons:32 as barrel', () => {
    expect(isPenBarrelEraserActive(penEvent({ button: -1, buttons: 32 }))).toBe(false)
    expect(isPenTipContactActive(penEvent({ buttons: 32 }))).toBe(true)
  })

  it('detects Samsung side-button stroke on pointerdown button 5', () => {
    expect(
      isPenBarrelEraserActive(penEvent({ button: PEN_POINTER_ERASER_BUTTON, buttons: 32 })),
    ).toBe(true)
    expect(
      isAnnotationPointerDownAccepted(penEvent({ button: PEN_POINTER_ERASER_BUTTON, buttons: 32 })),
    ).toBe(true)
    expect(
      effectiveStrokeToolForPointer(
        'pen',
        penEvent({ button: PEN_POINTER_ERASER_BUTTON, buttons: 32 }),
      ),
    ).toBe('eraser-line')
  })

  it('keeps eraser active for pointer moves after Samsung side-button down', () => {
    ensurePenBarrelButtonTracker()
    const handlers = new Map<string, EventListener[]>()
    vi.stubGlobal('window', {
      addEventListener(type: string, listener: EventListener) {
        const list = handlers.get(type) ?? []
        list.push(listener)
        handlers.set(type, list)
      },
    })
    resetPenBarrelButtonTrackerForTests()
    ensurePenBarrelButtonTracker()

    const fire = (type: string, event: Event) => {
      for (const listener of handlers.get(type) ?? []) listener(event)
    }

    fire(
      'pointerdown',
      {
        pointerType: 'pen',
        button: 5,
        buttons: 32,
        pointerId: 9,
      } as PointerEvent,
    )

    expect(
      isPenBarrelEraserActive(penEvent({ pointerId: 9, button: -1, buttons: 32 })),
    ).toBe(true)
    expect(effectiveStrokeToolForPointer('pen', penEvent({ pointerId: 9, button: -1, buttons: 32 }))).toBe(
      'eraser-line',
    )

    fire(
      'pointerup',
      {
        pointerType: 'pen',
        button: 5,
        buttons: 0,
        pointerId: 9,
      } as PointerEvent,
    )

    expect(
      isPenBarrelEraserActive(penEvent({ pointerId: 9, button: -1, buttons: 32 })),
    ).toBe(false)

    vi.unstubAllGlobals()
  })

  it('clears latched eraser when side button releases as tip pointerup with tip still down', () => {
    ensurePenBarrelButtonTracker()
    const handlers = new Map<string, EventListener[]>()
    vi.stubGlobal('window', {
      addEventListener(type: string, listener: EventListener) {
        const list = handlers.get(type) ?? []
        list.push(listener)
        handlers.set(type, list)
      },
    })
    resetPenBarrelButtonTrackerForTests()
    ensurePenBarrelButtonTracker()

    const fire = (type: string, event: Event) => {
      for (const listener of handlers.get(type) ?? []) listener(event)
    }

    fire(
      'pointerdown',
      {
        pointerType: 'pen',
        button: 5,
        buttons: 32,
        pointerId: 9,
      } as PointerEvent,
    )
    expect(isPenBarrelEraserActive(penEvent({ pointerId: 9, button: -1, buttons: 32 }))).toBe(true)

    fire(
      'pointerup',
      {
        pointerType: 'pen',
        button: 0,
        buttons: 32,
        pointerId: 9,
      } as PointerEvent,
    )

    expect(isPenBarrelEraserActive(penEvent({ pointerId: 9, button: -1, buttons: 32 }))).toBe(false)
    expect(effectiveStrokeToolForPointer('pen', penEvent({ pointerId: 9, buttons: 32 }))).toBe('pen')

    vi.unstubAllGlobals()
  })

  it('detects eraser-end button index', () => {
    expect(
      isPenBarrelEraserActive(penEvent({ button: PEN_POINTER_ERASER_BUTTON, buttons: 1 | 0x20 })),
    ).toBe(true)
  })

  it('ignores mouse and plain pen tip', () => {
    expect(isPenBarrelEraserActive(penEvent({ buttons: 1 }))).toBe(false)
    expect(
      isPenBarrelEraserActive({ pointerType: 'mouse', button: 0, buttons: 1, pointerId: 1 }),
    ).toBe(false)
  })

  it('accepts pen tip down including Samsung encoding', () => {
    expect(isAnnotationPointerDownAccepted(penEvent({ button: 0, buttons: 1 }))).toBe(true)
    expect(isAnnotationPointerDownAccepted(penEvent({ button: 0, buttons: 32 }))).toBe(true)
    expect(isAnnotationPointerDownAccepted(penEvent({ button: 0, buttons: 0x2 }))).toBe(false)
    expect(isAnnotationPointerDownAccepted({ pointerType: 'mouse', button: 0, buttons: 1, pointerId: 1 })).toBe(
      true,
    )
    expect(isAnnotationPointerDownAccepted({ pointerType: 'mouse', button: 2, buttons: 2, pointerId: 1 })).toBe(
      false,
    )
  })

  it('maps pen/marker/laser + barrel to eraser-line without changing stored mode', () => {
    expect(effectiveStrokeToolForPointer('pen', penEvent({ buttons: 1 | 0x20 }))).toBe('eraser-line')
    expect(effectiveStrokeToolForPointer('marker', penEvent({ buttons: 1 | 0x2 }))).toBe(
      'eraser-line',
    )
    expect(effectiveStrokeToolForPointer('laser', penEvent({ buttons: 1 | 0x20 }))).toBe(
      'eraser-line',
    )
  })

  it('keeps toolbar stroke tool when barrel is not held', () => {
    expect(effectiveStrokeToolForPointer('pen', penEvent({ buttons: 1 }))).toBe('pen')
    expect(effectiveStrokeToolForPointer('pen', penEvent({ button: -1, buttons: 32 }))).toBe('pen')
    expect(effectiveStrokeToolForPointer('marker', penEvent({ buttons: 1 }))).toBe('marker')
    expect(effectiveStrokeToolForPointer('eraser', penEvent({ buttons: 1 | 0x20 }))).toBe('eraser')
    expect(effectiveStrokeToolForPointer('laser', penEvent({ buttons: 1 }))).toBe(null)
  })

  it('uses global side-button tracker when OS sends separate button events', () => {
    const handlers = new Map<string, EventListener[]>()
    vi.stubGlobal('window', {
      addEventListener(type: string, listener: EventListener) {
        const list = handlers.get(type) ?? []
        list.push(listener)
        handlers.set(type, list)
      },
    })

    resetPenBarrelButtonTrackerForTests()
    ensurePenBarrelButtonTracker()

    const fire = (type: string, event: Event) => {
      for (const listener of handlers.get(type) ?? []) listener(event)
    }

    fire(
      'pointerdown',
      {
        pointerType: 'pen',
        button: 2,
        buttons: 2,
        pointerId: 3,
      } as PointerEvent,
    )
    expect(isPenBarrelHeld()).toBe(true)
    expect(effectiveStrokeToolForPointer('pen', penEvent({ pointerId: 3, buttons: 32 }))).toBe('eraser-line')

    fire(
      'pointerup',
      {
        pointerType: 'pen',
        button: 2,
        buttons: 0,
        pointerId: 3,
      } as PointerEvent,
    )
    expect(isPenBarrelHeld()).toBe(false)
    expect(effectiveStrokeToolForPointer('pen', penEvent({ pointerId: 3, buttons: 32 }))).toBe('pen')

    vi.unstubAllGlobals()
  })

  it('exports a stable barrel bitmask', () => {
    expect(PEN_BUTTONS_BARREL_MASK).toBe(0x22)
  })
})
