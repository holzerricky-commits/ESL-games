import { describe, expect, it } from 'vitest'
import { parseStopsFromAi } from '@/lib/books/parse-reading-check-ai-stops'

describe('parseStopsFromAi evidence', () => {
  it('stores snippet and highlight on the question', () => {
    const stops = parseStopsFromAi({
      stops: [
        {
          label: 'After the jump',
          displayPage: 16,
          midPageNote: null,
          question: {
            kind: 'true_false',
            prompt: 'Did Tillie jump?',
            correctTrue: true,
            evidenceSnippet: 'Tillie took a deep breath and jumped off the porch.',
            evidenceHighlight: 'jumped off the porch',
          },
        },
        {
          label: 'At school',
          displayPage: 18,
          midPageNote: null,
          question: {
            kind: 'mcq',
            prompt: 'Where is school?',
            choices: ['Town', 'Farm', 'City', 'Park'],
            correctIndex: 0,
            evidenceSnippet: 'School was in town, past the market.',
            evidenceHighlight: 'in town',
          },
        },
      ],
    })
    expect(stops).toHaveLength(2)
    expect(stops[0]?.questions[0]?.evidenceSnippet).toContain('jumped')
    expect(stops[0]?.questions[0]?.evidenceHighlight).toBe('jumped off the porch')
    expect(stops[1]?.questions[0]?.evidenceHighlight).toBe('in town')
  })

  it('drops highlight when it is not in the snippet', () => {
    const stops = parseStopsFromAi({
      stops: [
        {
          label: 'Beat',
          question: {
            kind: 'true_false',
            prompt: 'Q?',
            correctTrue: false,
            evidenceSnippet: 'She walked home slowly.',
            evidenceHighlight: 'flew to the moon',
          },
        },
        {
          label: 'Beat 2',
          question: {
            kind: 'true_false',
            prompt: 'Q2?',
            correctTrue: true,
            evidenceSnippet: 'Then she smiled.',
            evidenceHighlight: 'smiled',
          },
        },
      ],
    })
    expect(stops[0]?.questions[0]?.evidenceSnippet).toBe('She walked home slowly.')
    expect(stops[0]?.questions[0]?.evidenceHighlight).toBeNull()
  })

  it('accepts up to maxStops when configured', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      label: `Beat ${i + 1}`,
      displayPage: 10 + i,
      question: {
        kind: 'true_false' as const,
        prompt: `Question ${i + 1}?`,
        correctTrue: true,
        evidenceSnippet: `Evidence sentence number ${i + 1} for the story.`,
        evidenceHighlight: `number ${i + 1}`,
      },
    }))
    const stops = parseStopsFromAi({ stops: rows }, { maxStops: 12 })
    expect(stops).toHaveLength(8)
  })

  it('keeps multiple stops on the same displayPage', () => {
    const stops = parseStopsFromAi({
      stops: [
        {
          label: 'First beat on page',
          displayPage: 22,
          question: {
            kind: 'true_false',
            prompt: 'Did Tillie go to school?',
            correctTrue: true,
            evidenceSnippet: 'Tillie went off to school every day.',
            evidenceHighlight: 'went off to school',
          },
        },
        {
          label: 'Second beat on page',
          displayPage: 22,
          question: {
            kind: 'true_false',
            prompt: 'Did she have a dog?',
            correctTrue: true,
            evidenceSnippet: 'Tillie lived with her dog, Beans.',
            evidenceHighlight: 'dog, Beans',
          },
        },
        {
          label: 'Next page',
          displayPage: 23,
          question: {
            kind: 'true_false',
            prompt: 'Was Mr. Keene happy?',
            correctTrue: true,
            evidenceSnippet: 'Mr. Keene loved his school.',
            evidenceHighlight: 'loved his school',
          },
        },
      ],
    })
    expect(stops).toHaveLength(3)
    expect(stops[0]?.displayPage).toBe(22)
    expect(stops[1]?.displayPage).toBe(22)
    expect(stops[2]?.displayPage).toBe(23)
  })
})
