import { describe, expect, it } from 'vitest'
import {
  scoreTextRelevance,
  STATIC_IMAGE_MIN_ACCEPT_SCORE,
} from '@/lib/quiz-image-relevance'

describe('scoreTextRelevance classroom stock', () => {
  it('scores a literal apple stock hit above the accept floor', () => {
    const score = scoreTextRelevance(
      'apple',
      'apple fruit food isolated white background',
      'photo',
    )
    expect(score).toBeGreaterThanOrEqual(STATIC_IMAGE_MIN_ACCEPT_SCORE)
  })

  it('penalizes camera gear when the word is not about cameras', () => {
    const cameraJunk = scoreTextRelevance(
      'happy',
      'camera dslr photography lens tripod stock photo',
      'photo',
    )
    const real = scoreTextRelevance('happy', 'happy smile face portrait', 'photo')
    expect(cameraJunk).toBeLessThan(STATIC_IMAGE_MIN_ACCEPT_SCORE)
    expect(cameraJunk).toBeLessThan(real)
  })

  it('allows camera tags when the vocab word is camera', () => {
    const score = scoreTextRelevance(
      'camera',
      'camera dslr photography isolated white background',
      'photo',
    )
    expect(score).toBeGreaterThanOrEqual(STATIC_IMAGE_MIN_ACCEPT_SCORE)
  })

  it('penalizes flower stock when the word is unrelated', () => {
    const flowerJunk = scoreTextRelevance(
      'bicycle',
      'flower bloom petal bouquet rose garden',
      'photo',
    )
    expect(flowerJunk).toBeLessThan(STATIC_IMAGE_MIN_ACCEPT_SCORE)
  })

  it('keeps flower hits for the word flower', () => {
    const score = scoreTextRelevance(
      'flower',
      'flower bloom petal isolated white background',
      'photo',
    )
    expect(score).toBeGreaterThanOrEqual(STATIC_IMAGE_MIN_ACCEPT_SCORE)
  })
})
