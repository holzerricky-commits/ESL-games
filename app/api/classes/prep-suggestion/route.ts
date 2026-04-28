import { NextResponse } from 'next/server'
import { generateClassPrepSuggestion, type ClassPrepSuggestionInput } from '@/lib/gemini'
import type { BookSectionType } from '@/lib/types'

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ClassPrepSuggestionInput>
    const asSectionType = (value: unknown): BookSectionType =>
      value === 'unit' || value === 'lesson' || value === 'part' ? value : 'unit'
    const input: ClassPrepSuggestionInput = {
      studentName: typeof body.studentName === 'string' ? body.studentName : 'Student',
      classTitle: typeof body.classTitle === 'string' ? body.classTitle : 'Class',
      scheduledFor: typeof body.scheduledFor === 'string' ? body.scheduledFor : '',
      classDurationMin: typeof body.classDurationMin === 'number' ? body.classDurationMin : 45,
      plannedVocabulary: asStringArray(body.plannedVocabulary),
      goals: asStringArray(body.goals),
      activities: asStringArray(body.activities),
      selectedSection:
        body.selectedSection && typeof body.selectedSection === 'object'
          ? {
              id: typeof body.selectedSection.id === 'string' ? body.selectedSection.id : '',
              type: asSectionType(body.selectedSection.type),
              bookId: typeof body.selectedSection.bookId === 'string' ? body.selectedSection.bookId : '',
              bookTitle: typeof body.selectedSection.bookTitle === 'string' ? body.selectedSection.bookTitle : '',
              unitId: typeof body.selectedSection.unitId === 'string' ? body.selectedSection.unitId : '',
              unitTitle: typeof body.selectedSection.unitTitle === 'string' ? body.selectedSection.unitTitle : '',
              lessonId: typeof body.selectedSection.lessonId === 'string' ? body.selectedSection.lessonId : undefined,
              lessonTitle:
                typeof body.selectedSection.lessonTitle === 'string' ? body.selectedSection.lessonTitle : undefined,
              partId: typeof body.selectedSection.partId === 'string' ? body.selectedSection.partId : undefined,
              partTitle: typeof body.selectedSection.partTitle === 'string' ? body.selectedSection.partTitle : undefined,
              title: typeof body.selectedSection.title === 'string' ? body.selectedSection.title : '',
            }
          : undefined,
      sectionContext:
        body.sectionContext && typeof body.sectionContext === 'object'
          ? {
              title: typeof body.sectionContext.title === 'string' ? body.sectionContext.title : '',
              type: asSectionType(body.sectionContext.type),
              pathLabel: typeof body.sectionContext.pathLabel === 'string' ? body.sectionContext.pathLabel : '',
              startPageHint:
                typeof body.sectionContext.startPageHint === 'number' ? body.sectionContext.startPageHint : undefined,
              endPageHint: typeof body.sectionContext.endPageHint === 'number' ? body.sectionContext.endPageHint : undefined,
              sectionVocabulary: asStringArray(body.sectionContext.sectionVocabulary),
              checkpointIdeas: asStringArray(body.sectionContext.checkpointIdeas),
              contentSummary:
                typeof body.sectionContext.contentSummary === 'string' ? body.sectionContext.contentSummary : '',
            }
          : undefined,
      studentSnapshot:
        body.studentSnapshot && typeof body.studentSnapshot === 'object'
          ? {
              levelLabel: typeof body.studentSnapshot.levelLabel === 'string' ? body.studentSnapshot.levelLabel : 'Level 1',
              motivation:
                body.studentSnapshot.motivation === 'low' ||
                body.studentSnapshot.motivation === 'medium' ||
                body.studentSnapshot.motivation === 'high'
                  ? body.studentSnapshot.motivation
                  : 'medium',
              firstOrEarlyClasses: !!body.studentSnapshot.firstOrEarlyClasses,
            }
          : { levelLabel: 'Level 1', motivation: 'medium', firstOrEarlyClasses: true },
      recentHistory: Array.isArray(body.recentHistory)
        ? body.recentHistory.map((entry) => ({
            title: typeof entry.title === 'string' ? entry.title : 'Class',
            status: typeof entry.status === 'string' ? entry.status : 'planned',
            scheduledFor: typeof entry.scheduledFor === 'string' ? entry.scheduledFor : '',
            selectedSectionTitle:
              typeof entry.selectedSectionTitle === 'string' ? entry.selectedSectionTitle : undefined,
            introducedWords: asStringArray(entry.introducedWords),
            practicedWords: asStringArray(entry.practicedWords),
            reviewedWords: asStringArray(entry.reviewedWords),
            learnedWords: asStringArray(entry.learnedWords),
            notes: typeof entry.notes === 'string' ? entry.notes : undefined,
          }))
        : [],
    }
    const suggestion = await generateClassPrepSuggestion(input)
    return NextResponse.json({ ok: true, suggestion })
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to generate class prep suggestion.' }, { status: 500 })
  }
}
