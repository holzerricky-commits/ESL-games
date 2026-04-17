import { Badge } from '@/components/ui/badge'
import type { StudentProfileView } from '@/lib/students/types'

interface StudentAvatarTabProps {
  student: StudentProfileView
}

const ACCESSORY_PLACEHOLDERS = [
  { id: 'hat-1', emoji: '🎩', name: 'Classic Hat', price: 90, unlocked: true },
  { id: 'glasses-1', emoji: '🕶️', name: 'Cool Shades', price: 130, unlocked: false },
  { id: 'toy-1', emoji: '🧸', name: 'Buddy Toy', price: 80, unlocked: true },
  { id: 'crown-1', emoji: '👑', name: 'Star Crown', price: 220, unlocked: false },
  { id: 'headphones-1', emoji: '🎧', name: 'Beat Headset', price: 160, unlocked: false },
  { id: 'wand-1', emoji: '🪄', name: 'Magic Wand', price: 140, unlocked: true },
]

export function StudentAvatarTab({ student }: StudentAvatarTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">Avatar Preview</p>
          <Badge variant="outline">Builder: coming soon</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{student.avatarSummary}</p>
        <div className="mt-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          {/* Placeholder art until avatar builder is implemented */}
          <img
            src="/Avatar example.png"
            alt="Placeholder avatar scene preview while avatar builder is in development."
            className="h-[22rem] w-full object-cover object-center md:h-[25rem] xl:h-[30rem]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accessory lineup</p>
          <p className="text-[11px] text-muted-foreground">Placeholder items</p>
        </div>
        <div className="mt-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-max gap-3 pr-2">
            {ACCESSORY_PLACEHOLDERS.map((item) => (
              <article key={item.id} className="w-[7.5rem] shrink-0" aria-label={`${item.name}, costs ${item.price} coins`}>
                <div
                  className={`relative overflow-hidden rounded-xl border bg-[var(--surface-2)] ${
                    item.unlocked ? 'border-[var(--brand-green)]/45' : 'border-[var(--border)]'
                  }`}
                >
                  <div className={`flex h-28 items-center justify-center ${item.unlocked ? '' : 'grayscale brightness-[0.75]'}`}>
                    <span className="text-5xl" aria-hidden>
                      {item.emoji}
                    </span>
                  </div>
                  <div className="absolute right-1.5 top-1.5 rounded-md bg-[var(--surface-4)]/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
                    {item.price}
                  </div>
                </div>
                <p className="mt-1.5 line-clamp-1 text-xs font-medium text-foreground">{item.name}</p>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-3">
          <Badge variant="outline">Shop: coming soon</Badge>
        </div>
      </div>
    </div>
  )
}
