export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function fmtScheduleMinute(total: number): string {
  const h24 = Math.floor(total / 60)
  const m = total % 60
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function scheduleMinuteOptions(startMinute: number, endMinute: number): Array<{ value: number; label: string }> {
  const out: Array<{ value: number; label: string }> = []
  for (let minute = startMinute; minute < endMinute; minute += 30) {
    out.push({ value: minute, label: fmtScheduleMinute(minute) })
  }
  return out
}
