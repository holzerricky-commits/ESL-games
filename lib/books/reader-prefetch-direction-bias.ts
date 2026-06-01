/**
 * R5.1 — last adjacent-turn direction for P0 prefetch (shared between nav hook and controller).
 */

export type ReaderPrefetchDirectionBias = 'forward' | 'backward' | 'neutral'

let directionBias: ReaderPrefetchDirectionBias = 'neutral'

export function getReaderPrefetchDirectionBias(): ReaderPrefetchDirectionBias {
  return directionBias
}

export function setReaderPrefetchDirectionBias(bias: ReaderPrefetchDirectionBias): void {
  directionBias = bias
}

export function resetReaderPrefetchDirectionBias(): void {
  directionBias = 'neutral'
}
