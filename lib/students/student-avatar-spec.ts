export const STUDENT_AVATAR_DICEBEAR_STYLES = [
  'fun-emoji',
  'lorelei',
  'adventurer',
  'adventurer-neutral',
  'micah',
  'big-smile',
] as const

export const STUDENT_AVATAR_BACKGROUND_COLORS = [
  'fff4e6',
  'ffd5dc',
  'e0f4ff',
  'e8f5e9',
  'f3e8ff',
  'fff9c4',
  'ffe0f0',
  'e8eaf6',
  'fce4ec',
  'e0f2f1',
] as const

export type StudentAvatarDiceBearStyle = (typeof STUDENT_AVATAR_DICEBEAR_STYLES)[number]

export interface StudentAvatarDiceBearSpec {
  style: StudentAvatarDiceBearStyle
  seed: string
  backgroundColor: string
}

export function studentAvatarPublicPath(studentId: string): string {
  return `/student-avatars/${studentId}.png`
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function pickFrom<T>(items: readonly T[], hash: number): T {
  return items[hash % items.length]!
}

/** Stable DiceBear look per student — same id + name always yields the same spec. */
export function buildStudentAvatarDiceBearSpec(studentId: string, name: string): StudentAvatarDiceBearSpec {
  const key = `${studentId}:${name.trim().toLowerCase()}`
  const hash = hashString(key)
  const style = pickFrom(STUDENT_AVATAR_DICEBEAR_STYLES, hash)
  const backgroundColor = pickFrom(STUDENT_AVATAR_BACKGROUND_COLORS, hash >>> 8)
  const seed = `${studentId}-${name.trim().toLowerCase().replace(/\s+/g, '-')}`
  return { style, seed, backgroundColor }
}

export function buildStudentAvatarDiceBearUrl(spec: StudentAvatarDiceBearSpec, size = 256): string {
  const params = new URLSearchParams({
    seed: spec.seed,
    size: String(size),
    backgroundColor: spec.backgroundColor,
  })
  return `https://api.dicebear.com/9.x/${spec.style}/png?${params}`
}
