export interface ClassPrepTimeBlock {
  id: string
  label: string
  minutes: number
  objective: string
  activityType: string
  teacherMoves?: string[]
  studentOutput?: string
  checkForUnderstanding?: string
}

export type ClassPrepOutlineViewMode = 'quick' | 'detailed'

/** Within this many minutes of class length counts as "on target". */
export const PREP_DURATION_TOLERANCE_MIN = 2

export type PrepDurationStatus = 'empty' | 'under' | 'on-target' | 'over'

export function formatPrepMinuteRange(startMin: number, endMin: number): string {
  return `${startMin}–${endMin} min`
}

export function sumPrepBlockMinutes(blocks: ReadonlyArray<Pick<ClassPrepTimeBlock, 'minutes'>>): number {
  return blocks.reduce((sum, block) => sum + Math.max(1, Math.floor(block.minutes) || 1), 0)
}

export function clampClassDurationMin(durationMin: number): number {
  if (!Number.isFinite(durationMin)) return 45
  return Math.max(15, Math.min(240, Math.floor(durationMin)))
}

export function getRemainingPrepMinutes(
  blocks: ReadonlyArray<Pick<ClassPrepTimeBlock, 'minutes'>>,
  durationMin: number,
): number {
  return Math.max(0, clampClassDurationMin(durationMin) - sumPrepBlockMinutes(blocks))
}

export function getPrepDurationStatus(totalMin: number, durationMin: number): PrepDurationStatus {
  if (totalMin <= 0) return 'empty'
  const target = clampClassDurationMin(durationMin)
  const diff = totalMin - target
  if (diff > PREP_DURATION_TOLERANCE_MIN) return 'over'
  if (diff < -PREP_DURATION_TOLERANCE_MIN) return 'under'
  return 'on-target'
}

export function prepDurationStatusLabel(status: PrepDurationStatus): string {
  if (status === 'on-target') return 'On target'
  if (status === 'under') return 'Under'
  if (status === 'over') return 'Over'
  return 'Empty'
}

/** Proportionally resize block minutes so they sum to class duration (each block ≥ 1 min). */
export function normalizePrepBlocksToDuration(
  blocks: ClassPrepTimeBlock[],
  durationMin: number,
): ClassPrepTimeBlock[] {
  if (blocks.length === 0) return blocks
  const target = clampClassDurationMin(durationMin)
  const minPerBlock = 1
  if (target < blocks.length * minPerBlock) {
    return blocks.slice(0, target).map((block) => ({
      ...block,
      minutes: 1,
    }))
  }

  const weights = blocks.map((block) => Math.max(1, Math.floor(block.minutes) || 1))
  const distributed = distributeIntegerMinutes(weights, target, minPerBlock)
  return blocks.map((block, index) => ({
    ...block,
    minutes: distributed[index] ?? minPerBlock,
  }))
}

function distributeIntegerMinutes(weights: number[], target: number, minPerBlock: number): number[] {
  const n = weights.length
  if (n === 0) return []
  const total = weights.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    const base = Math.floor(target / n)
    const remainder = target % n
    return weights.map((_, index) => base + (index < remainder ? 1 : 0))
  }

  const raw = weights.map((weight) => (weight / total) * target)
  const minutes = raw.map((value) => Math.max(minPerBlock, Math.floor(value)))
  let sum = minutes.reduce((acc, value) => acc + value, 0)

  if (sum > target) {
    const order = [...minutes.keys()].sort((a, b) => minutes[b]! - minutes[a]!)
    let guard = 0
    while (sum > target && guard < 10_000) {
      const index = order[guard % order.length]!
      if (minutes[index]! > minPerBlock) {
        minutes[index]!--
        sum--
      }
      guard++
    }
  } else if (sum < target) {
    const order = [...minutes.keys()].sort((a, b) => minutes[b]! - minutes[a]!)
    let guard = 0
    while (sum < target && guard < 10_000) {
      const index = order[guard % order.length]!
      minutes[index]!++
      sum++
      guard++
    }
  }

  return minutes
}

export function computePrepBlockRanges(blocks: ClassPrepTimeBlock[]): Array<ClassPrepTimeBlock & { startMin: number; endMin: number }> {
  let currentMin = 0
  return blocks.map((block) => {
    const startMin = currentMin
    const endMin = currentMin + Math.max(1, Math.floor(block.minutes) || 1)
    currentMin = endMin
    return { ...block, startMin, endMin }
  })
}

export function createEmptyPrepBlock(remainingMinutes?: number): ClassPrepTimeBlock {
  const minutes =
    remainingMinutes != null && remainingMinutes > 0
      ? Math.max(1, Math.min(remainingMinutes, 90))
      : 10
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: 'New block',
    minutes,
    objective: '',
    activityType: 'practice',
  }
}

type FallbackBlockTemplate = {
  label: string
  share: number
  objective: string
  activityType: string
  teacherMoves: string[]
  studentOutput: string
  checkForUnderstanding: string
}

const SHORT_CLASS_TEMPLATE: FallbackBlockTemplate[] = [
  {
    label: 'Warm-up review',
    share: 0.2,
    objective: 'Activate previous vocabulary.',
    activityType: 'review',
    teacherMoves: ['Prompt open speaking with 2 easy questions.'],
    studentOutput: '2–3 spoken responses using known words.',
    checkForUnderstanding: 'Can the student answer without heavy prompting?',
  },
  {
    label: 'Main lesson',
    share: 0.6,
    objective: 'Practice the selected section actively.',
    activityType: 'guided-practice',
    teacherMoves: ['Model one item, then guide two examples.'],
    studentOutput: 'Reads and uses key words in short sentences.',
    checkForUnderstanding: 'One quick comprehension check at the midpoint.',
  },
  {
    label: 'Wrap-up',
    share: 0.2,
    objective: 'Check understanding and set the next step.',
    activityType: 'reflection',
    teacherMoves: ['Ask one transfer question and summarize next time.'],
    studentOutput: 'One short recap statement.',
    checkForUnderstanding: 'Exit prompt in one sentence.',
  },
]

const LONG_CLASS_TEMPLATE: FallbackBlockTemplate[] = [
  {
    label: 'Warm-up',
    share: 0.12,
    objective: 'Reactivate previous learning.',
    activityType: 'review',
    teacherMoves: ['Lead free speaking around recent keywords.'],
    studentOutput: 'Short spoken answers with target vocabulary.',
    checkForUnderstanding: 'Quick recall check on 3 prior words.',
  },
  {
    label: 'Main section',
    share: 0.45,
    objective: 'Work through the selected book section.',
    activityType: 'guided-practice',
    teacherMoves: ['Model, then shift to student-led responses.'],
    studentOutput: 'Produces target language in context.',
    checkForUnderstanding: 'Comprehension check after the key chunk.',
  },
  {
    label: 'Guided practice',
    share: 0.25,
    objective: 'Apply skills in a focused task.',
    activityType: 'practice',
    teacherMoves: ['Run a time-boxed task with immediate feedback.'],
    studentOutput: 'Completes the task with minimal help.',
    checkForUnderstanding: 'Correctness check at task end.',
  },
  {
    label: 'Wrap-up',
    share: 0.18,
    objective: 'Assess understanding and set carry-over.',
    activityType: 'reflection',
    teacherMoves: ['Prompt recap and one carry-over task.'],
    studentOutput: 'States one takeaway and one next action.',
    checkForUnderstanding: 'Exit prompt in one sentence.',
  },
]

export function buildDurationAwareFallbackBlocks(durationMin: number): Array<{
  label: string
  minutes: number
  objective: string
  activityType: string
  teacherMoves: string[]
  studentOutput: string
  checkForUnderstanding: string
}> {
  const target = clampClassDurationMin(durationMin)
  const template = target <= 35 ? SHORT_CLASS_TEMPLATE : LONG_CLASS_TEMPLATE
  const rawMinutes = template.map((row) => Math.max(1, Math.round(target * row.share)))
  const distributed = distributeIntegerMinutes(
    rawMinutes,
    target,
    1,
  )
  return template.map((row, index) => ({
    label: row.label,
    minutes: distributed[index] ?? 1,
    objective: row.objective,
    activityType: row.activityType,
    teacherMoves: row.teacherMoves,
    studentOutput: row.studentOutput,
    checkForUnderstanding: row.checkForUnderstanding,
  }))
}

function sanitizeStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const items = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

export function sanitizePrepTimeBlocks(raw: unknown): ClassPrepTimeBlock[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const blocks: ClassPrepTimeBlock[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const label = typeof row.label === 'string' ? row.label.trim() : ''
    const objective = typeof row.objective === 'string' ? row.objective.trim() : ''
    const activityType = typeof row.activityType === 'string' ? row.activityType.trim() : ''
    if (!label && !objective && !activityType) continue
    const minutes =
      typeof row.minutes === 'number' && Number.isFinite(row.minutes)
        ? Math.max(1, Math.min(180, Math.floor(row.minutes)))
        : 10
    const id =
      typeof row.id === 'string' && row.id.trim()
        ? row.id.trim()
        : `block-${blocks.length + 1}-${label.slice(0, 12) || 'item'}`
    blocks.push({
      id,
      label: label || 'Lesson block',
      minutes,
      objective,
      activityType: activityType || 'practice',
      teacherMoves: sanitizeStringArray(row.teacherMoves),
      studentOutput: typeof row.studentOutput === 'string' ? row.studentOutput.trim() || undefined : undefined,
      checkForUnderstanding:
        typeof row.checkForUnderstanding === 'string' ? row.checkForUnderstanding.trim() || undefined : undefined,
    })
  }
  return blocks.length > 0 ? blocks : undefined
}

export function prepBlocksFromAiSuggestion(
  blocks: Array<{
    label: string
    minutes: number
    objective: string
    activityType: string
    teacherMoves?: string[]
    studentOutput?: string
    checkForUnderstanding?: string
  }>,
  classDurationMin?: number,
): ClassPrepTimeBlock[] {
  const mapped = blocks.map((block, index) => ({
    id: `block-ai-${Date.now()}-${index}`,
    label: block.label.trim() || `Block ${index + 1}`,
    minutes: Math.max(1, Math.floor(block.minutes) || 1),
    objective: block.objective.trim(),
    activityType: block.activityType.trim() || 'practice',
    teacherMoves: block.teacherMoves?.map((s) => s.trim()).filter(Boolean),
    studentOutput: block.studentOutput?.trim() || undefined,
    checkForUnderstanding: block.checkForUnderstanding?.trim() || undefined,
  }))
  if (classDurationMin != null && classDurationMin > 0) {
    return normalizePrepBlocksToDuration(mapped, classDurationMin)
  }
  return mapped
}

export function hasLegacyPrepSummaryOnly(session: {
  prepTimeBlocks?: ClassPrepTimeBlock[]
  aiPrepSummary?: string
}): boolean {
  return !(session.prepTimeBlocks?.length ?? 0) && Boolean(session.aiPrepSummary?.trim())
}

export function formatActivityTypeLabel(activityType: string): string {
  return activityType.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type AiTimeBlockShape = {
  label: string
  minutes: number
  objective: string
  activityType: string
  teacherMoves?: string[]
  studentOutput?: string
  checkForUnderstanding?: string
}

/** Resize AI suggestion blocks so their minutes sum to the scheduled class length. */
export function normalizeAiTimeBlocks<T extends AiTimeBlockShape>(blocks: T[], durationMin: number): T[] {
  if (blocks.length === 0 || durationMin <= 0) return blocks
  const normalized = normalizePrepBlocksToDuration(
    blocks.map((block, index) => ({
      id: `ai-${index}`,
      label: block.label,
      minutes: block.minutes,
      objective: block.objective,
      activityType: block.activityType,
      teacherMoves: block.teacherMoves,
      studentOutput: block.studentOutput,
      checkForUnderstanding: block.checkForUnderstanding,
    })),
    durationMin,
  )
  return blocks.map((block, index) => ({
    ...block,
    minutes: normalized[index]?.minutes ?? block.minutes,
  }))
}
