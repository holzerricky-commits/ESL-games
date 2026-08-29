import { Flame } from 'lucide-react'
import type { ClassroomHomeLastTime } from '@/lib/students/classroom-home-continuity'

export function ClassroomHomeStreakChip({
  count,
  encourage,
}: {
  count: number
  encourage?: boolean
}) {
  return (
    <div className="book-launch-streak">
      <p className="book-launch-streak__chip">
        <Flame className="h-3.5 w-3.5" aria-hidden />
        {count} in a row
      </p>
      {encourage ? <p className="book-launch-streak__hint">Keep your streak going!</p> : null}
    </div>
  )
}

export function ClassroomHomeLastTime({ lastTime }: { lastTime: ClassroomHomeLastTime }) {
  return (
    <section className="book-launch-last" aria-label="Last time">
      <p className="book-launch-last__kicker">Last time</p>
      {lastTime.recap ? <p className="book-launch-last__recap">{lastTime.recap}</p> : null}
      {lastTime.reviewWords.length > 0 ? (
        <p className="book-launch-last__words">
          <span>Review</span>
          {lastTime.reviewWords.join(', ')}
        </p>
      ) : null}
    </section>
  )
}
