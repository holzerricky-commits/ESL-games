/** On-disk weekly teaching schedule (config + slot assignments + per-date exceptions). */
export type WeeklyScheduleDiskPayload = {
  config: Record<string, unknown> | null
  assignments: unknown[]
  exceptions: unknown[]
}

export function emptyWeeklyScheduleDiskPayload(): WeeklyScheduleDiskPayload {
  return { config: null, assignments: [], exceptions: [] }
}

export function normalizeWeeklyScheduleDiskPayload(raw: unknown): WeeklyScheduleDiskPayload {
  const empty = emptyWeeklyScheduleDiskPayload()
  if (!raw || typeof raw !== 'object') return empty
  const o = raw as Record<string, unknown>
  const config =
    o.config && typeof o.config === 'object' && !Array.isArray(o.config)
      ? (o.config as Record<string, unknown>)
      : null
  const assignments = Array.isArray(o.assignments) ? o.assignments : []
  const exceptions = Array.isArray(o.exceptions) ? o.exceptions : []
  return { config, assignments, exceptions }
}

export function isWeeklyScheduleDiskPayloadEmpty(payload: WeeklyScheduleDiskPayload): boolean {
  return payload.config == null && payload.assignments.length === 0 && payload.exceptions.length === 0
}
