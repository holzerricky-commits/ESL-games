import { describe, expect, it, vi } from 'vitest'
import { getVaultDrag, requestVaultFlyIn, setVaultDrag, subscribeVaultDrag, subscribeVaultFlyIn } from './vault-drag'

describe('vault drag store', () => {
  it('notifies on set and clear, and stops after unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeVaultDrag(listener)
    const state = { word: 'seastar', x: 10, y: 20, overVault: false }
    setVaultDrag(state)
    expect(getVaultDrag()).toBe(state)
    setVaultDrag(state)
    expect(listener).toHaveBeenCalledTimes(1)
    setVaultDrag(null)
    expect(getVaultDrag()).toBeNull()
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    setVaultDrag(state)
    expect(listener).toHaveBeenCalledTimes(2)
    setVaultDrag(null)
  })

  it('sends fly-ins with increasing ids', () => {
    const flights: number[] = []
    const unsubscribe = subscribeVaultFlyIn((flight) => {
      expect(flight.word).toBe('shell')
      flights.push(flight.id)
    })
    requestVaultFlyIn({ word: 'shell', from: { x: 1, y: 2 } })
    requestVaultFlyIn({ word: 'shell', from: { x: 3, y: 4 } })
    unsubscribe()
    requestVaultFlyIn({ word: 'shell', from: { x: 5, y: 6 } })
    expect(flights).toHaveLength(2)
    expect(flights[1]!).toBeGreaterThan(flights[0]!)
  })
})
