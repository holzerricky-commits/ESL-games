/** Parse {"index": n} from model text; index must be in [0, count). */
export function parseVisionPickIndex(text: string, count: number): number | null {
  if (count <= 0) return null
  const trimmed = text.trim()
  const withoutFence = trimmed.startsWith('```')
    ? trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    : trimmed
  const first = withoutFence.indexOf('{')
  const last = withoutFence.lastIndexOf('}')
  const candidate = first >= 0 && last > first ? withoutFence.slice(first, last + 1) : withoutFence
  try {
    const parsed = JSON.parse(candidate) as { index?: unknown }
    const n = typeof parsed.index === 'number' ? parsed.index : Number(parsed.index)
    if (!Number.isInteger(n) || n < 0 || n >= count) return null
    return n
  } catch {
    return null
  }
}
