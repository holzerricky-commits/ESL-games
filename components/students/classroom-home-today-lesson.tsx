'use client'

import type { ClassroomHomeGoalLine } from '@/lib/students/classroom-home-goals'

interface ClassroomHomeTodayLessonProps {
  contextLine: string | null
  lines: ClassroomHomeGoalLine[]
}

export function ClassroomHomeTodayLesson({ contextLine, lines }: ClassroomHomeTodayLessonProps) {
  return (
    <section className="book-launch-today" aria-label="Today's lesson">
      <div className="book-launch-today__head">
        <p className="book-launch-today__kicker">Today&apos;s lesson</p>
      </div>

      {contextLine ? <p className="book-launch-today__context">{contextLine}</p> : null}

      {lines.length > 0 ? (
        <ul className="book-launch-today__lines">
          {lines.map((line, index) => {
            const title = line.label?.trim() || line.text
            const detail = line.detail?.trim()
            return (
              <li key={`${line.kind ?? 'part'}:${title}:${index}`}>
                <span className="book-launch-today__kind">{title}</span>
                {detail ? <span className="book-launch-today__detail">{detail}</span> : null}
              </li>
            )
          })}
        </ul>
      ) : contextLine ? null : (
        <p className="book-launch-today__hint">No plan yet.</p>
      )}
    </section>
  )
}
