import { z } from 'zod'
import { getDefaultPromptChecked, getDefaultPromptScript } from '@/lib/lesson-coach/default-prompts'

export const grammarIssueSchema = z.object({
  id: z.string(),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  type: z.string().max(64),
  message: z.string().max(500),
  suggestion: z.string().max(500).optional(),
  explanation: z.string().max(2000).optional(),
  status: z.enum(['hidden', 'highlighted', 'revealed', 'applied']).default('hidden'),
})

export type GrammarIssue = z.infer<typeof grammarIssueSchema>

export const revealUndoSnapshotSchema = z.object({
  sharedText: z.string().max(50_000),
  issues: z.array(grammarIssueSchema),
})

export type RevealUndoSnapshot = z.infer<typeof revealUndoSnapshotSchema>

export const lessonCoachSessionSchema = z.object({
  id: z.string().uuid(),
  updatedAt: z.number(),
  studentId: z.string().max(128).optional(),
  studentName: z.string().max(200).optional(),
  bookId: z.string().max(128).optional(),
  bookTitle: z.string().max(300).optional(),
  unitId: z.string().max(128).optional(),
  unitTitle: z.string().max(300).optional(),
  partId: z.string().max(128).optional(),
  partTitle: z.string().max(300).optional(),
  lessonId: z.string().max(128).optional(),
  lessonTitle: z.string().max(300).optional(),
  dictationMode: z.boolean(),
  activeField: z.preprocess(
    (value) => (value === 'lesson-paper' ? 'lesson-board' : value),
    z.enum(['lesson-board', 'label', 'whiteboard']).nullable(),
  ),
  sharedText: z.string().max(50_000),
  issueCount: z.number().int().min(0),
  revealedCount: z.number().int().min(0),
  issues: z.array(grammarIssueSchema),
  pacingNotes: z.string().max(20_000),
  promptScript: z.array(z.string().max(500)),
  /** Parallel to promptScript — tap-to-mark done on coach phone. */
  promptChecked: z.array(z.boolean()).max(50),
  revealIndex: z.number().int().min(-1),
  /** Snapshots for undo after apply-fix (newest first). */
  textUndoStack: z.array(revealUndoSnapshotSchema).max(8).default([]),
  /** Last ping from overlay (ms); coach uses for connection status. */
  overlayLastSeenAt: z.number().optional(),
  /** Last ping from coach page (ms). */
  coachLastSeenAt: z.number().optional(),
})

export type LessonCoachSession = z.infer<typeof lessonCoachSessionSchema>

export const lessonCoachSessionPatchSchema = lessonCoachSessionSchema
  .partial()
  .omit({ id: true })
  .strict()

export type LessonCoachSessionPatch = z.infer<typeof lessonCoachSessionPatchSchema>

export function sanitizeLessonCoachSession(raw: unknown): LessonCoachSession | null {
  const parsed = lessonCoachSessionSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function createEmptyLessonCoachSession(id: string): LessonCoachSession {
  const now = Date.now()
  const promptScript = getDefaultPromptScript()
  return {
    id,
    updatedAt: now,
    dictationMode: false,
    activeField: null,
    sharedText: '',
    issueCount: 0,
    revealedCount: 0,
    issues: [],
    pacingNotes: '',
    promptScript,
    promptChecked: getDefaultPromptChecked(promptScript.length),
    revealIndex: -1,
    textUndoStack: [],
  }
}
