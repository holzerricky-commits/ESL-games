'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as DivMouseEvent,
  type PointerEvent,
  type PointerEvent as SvgPointerEvent,
} from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { getQuizzes } from '@/lib/storage'
import { getQuizCardCoverUrl } from '@/lib/helpers'
import { getFirstQuizQuestionPreview, getTotalQuestionCountAcrossTiers } from '@/lib/quiz-difficulty'
import {
  getStudentAssignedQuizIds,
  getStudentMapNodeLayout,
  getStudentMapPathSegments,
  getStudentMapPathStartPoint,
  getStudentMapPathStartSegmentRaw,
  syncStudentMapPathEndpoints,
  syncStudentMapPathStartSegment,
  updateStudentChallengeAssignments,
  updateStudentMapNodeLayout,
  updateStudentMapPathSegments,
  updateStudentMapPathStartSegment,
  type StudentMapNodeLayout,
  type StudentMapPathSegments,
} from '@/lib/students/selectors'
import type { Quiz } from '@/lib/types'
import type { StudentProfileView } from '@/lib/students/types'
import { CHALLENGE_MAP_FOREST_BG } from '@/lib/students/challenge-map-assets'
import { ForestTree1Leaves } from '@/components/students/challenge-map/forest-tree1-leaves'
import {
  ChallengeMapPathSvg,
  type PathSegmentForSvg,
} from '@/components/students/challenge-map/challenge-map-path-svg'
import {
  MAP_PATH_ANCHORS,
  computeCanvasMetrics,
  nodeIndexToCanvasPoint,
  resolveMapPathStartSegment,
  sanitizeMapPathSegments,
  type MapPathPoint,
} from '@/lib/students/challenge-map-layout'

const SLOT_COUNT = 24
const INTRO_SEG_ID = '__intro__'

const forestBgTiledStyle = {
  backgroundImage: `url("${CHALLENGE_MAP_FOREST_BG}")`,
  backgroundSize: '100% auto' as const,
  backgroundPosition: 'top center' as const,
  backgroundRepeat: 'repeat-y' as const,
}

function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; mx: number; my: number; t: number } {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLen2 = abx * abx + aby * aby
  const t = abLen2 <= 1e-9 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2))
  const mx = ax + abx * t
  const my = ay + aby * t
  const dist = Math.hypot(px - mx, py - my)
  return { dist, mx, my, t }
}

interface TeacherChallengePathTabProps {
  student: StudentProfileView
  onUpdated: () => void
}

function AssignedQuizCard({
  quiz,
  index,
  onRemove,
}: {
  quiz: Quiz
  index: number
  onRemove: () => void
}) {
  const first = getFirstQuizQuestionPreview(quiz)
  const coverUrl = getQuizCardCoverUrl({
    quizId: quiz.id,
    quizName: quiz.name,
    coverImageMode: quiz.coverImageMode,
    manualCoverImageUrl: quiz.coverImageUrl,
    fallbackImageUrl: first?.imageUrl,
    imageSearchQuery: first?.imageSearchQuery,
    imageStyle: first?.imageStyle,
  })

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] transition-all hover:border-[var(--brand-blue)]/50">
      <div className="relative aspect-[16/9] overflow-hidden border-b border-[var(--border)] bg-[var(--surface-3)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic quiz covers */}
        <img src={coverUrl} alt="" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[var(--surface-1)]/70 via-transparent to-transparent" />
        <Badge className="absolute left-3 top-3 bg-[var(--surface-4)]/95 font-mono text-xs text-foreground" variant="outline">
          {index + 1}
        </Badge>
        <Badge
          className="absolute right-3 top-3 shrink-0 border-[var(--brand-blue)] bg-[var(--surface-4)]/90 text-xs font-mono text-[var(--brand-blue-bright)]"
          variant="outline"
        >
          {getTotalQuestionCountAcrossTiers(quiz)} Q
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-lg font-bold leading-tight text-foreground">{quiz.name}</h3>
        {quiz.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
        ) : null}
        <div className="mt-auto flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 border-[var(--border)] text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        </div>
      </div>
    </div>
  )
}

function EmptyNextSlotCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-dashed border-[var(--brand-blue)]/40 bg-[var(--surface-2)] text-left transition-all hover:border-[var(--brand-blue)] hover:bg-[var(--surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-blue)]"
    >
      <div className="relative flex aspect-[16/9] items-center justify-center border-b border-[var(--border)] bg-[var(--surface-1)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-blue)]/15 text-[var(--brand-blue)]">
          <Plus className="h-7 w-7" strokeWidth={2} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-lg font-bold text-foreground">Add challenge</p>
        <p className="text-sm text-muted-foreground">Choose a quiz from your Timed Challenge library.</p>
      </div>
    </button>
  )
}

export function TeacherChallengePathTab({ student, onUpdated }: TeacherChallengePathTabProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState(0)
  const [layoutDraft, setLayoutDraft] = useState<StudentMapNodeLayout | null>(null)
  const [pathDraft, setPathDraft] = useState<StudentMapPathSegments | null>(null)
  /** undefined = not edited; null = clear saved intro route on save */
  const [startSegmentDraft, setStartSegmentDraft] = useState<MapPathPoint[] | null | undefined>(undefined)
  const [editorWidth, setEditorWidth] = useState(0)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const dragQuizIdRef = useRef<string | null>(null)
  const pathDragRef = useRef<
    | { kind: 'waypoint'; fromQuizId: string; pointIndex: number; pointerId: number }
    | { kind: 'intro-waypoint'; pointIndex: number; pointerId: number }
    | null
  >(null)
  const effectiveIntroPointsRef = useRef<MapPathPoint[]>([])

  const assignedIds = useMemo(
    () => getStudentAssignedQuizIds(student.id) ?? [],
    [student.id, student.challengeItems, version],
  )
  const quizzes = useMemo(() => getQuizzes(), [version, student.id])

  const quizById = useMemo(() => new Map(quizzes.map((q) => [q.id, q])), [quizzes])

  const assignedQuizzes = useMemo(
    () => assignedIds.map((id) => quizById.get(id)).filter(Boolean) as Quiz[],
    [assignedIds, quizById],
  )

  const availableForPicker = useMemo(() => {
    const used = new Set(assignedIds)
    const q = query.trim().toLowerCase()
    return quizzes
      .filter((quiz) => !used.has(quiz.id))
      .filter((quiz) => !q || quiz.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [quizzes, assignedIds, query])

  const bump = useCallback(() => {
    setVersion((v) => v + 1)
    onUpdated()
  }, [onUpdated])

  const persist = useCallback(
    (nextIds: string[]) => {
      const result = updateStudentChallengeAssignments(student.id, nextIds)
      if (result.ok) {
        bump()
        setPickerOpen(false)
        setQuery('')
      }
    },
    [student.id, bump],
  )

  const handlePickQuiz = (quizId: string) => {
    persist([...assignedIds, quizId])
  }

  const handleRemoveAt = (index: number) => {
    persist(assignedIds.filter((_, i) => i !== index))
  }

  const canAddMore = assignedIds.length < SLOT_COUNT
  const savedLayout = useMemo(() => getStudentMapNodeLayout(student.id), [student.id, version])
  const savedPath = useMemo(() => getStudentMapPathSegments(student.id), [student.id, version])
  const savedIntroRaw = useMemo(() => getStudentMapPathStartSegmentRaw(student.id), [student.id, version])
  const savedLegacyStart = useMemo(() => getStudentMapPathStartPoint(student.id), [student.id, version])
  const effectiveLayout = layoutDraft ?? savedLayout

  const defaultLayout = useMemo(() => {
    const next: StudentMapNodeLayout = {}
    assignedIds.forEach((quizId, index) => {
      next[quizId] = MAP_PATH_ANCHORS[index % MAP_PATH_ANCHORS.length]
    })
    return next
  }, [assignedIds])

  const editorMetrics = useMemo(
    () => computeCanvasMetrics(editorWidth > 0 ? editorWidth : 800, assignedIds.length, false),
    [editorWidth, assignedIds.length],
  )
  const canvasHeightPx = editorMetrics.canvasHeight

  const effectivePath = useMemo(
    () =>
      sanitizeMapPathSegments(pathDraft ?? savedPath, assignedIds, effectiveLayout, 'zigzag', editorWidth || 800, false),
    [pathDraft, savedPath, assignedIds, effectiveLayout, editorWidth],
  )

  const firstQuestCanvasPoint = useMemo(() => {
    if (assignedIds.length === 0) return null
    return nodeIndexToCanvasPoint(0, assignedIds.length, assignedIds[0], effectiveLayout, 'zigzag', editorMetrics)
  }, [assignedIds, effectiveLayout, editorMetrics])

  const effectiveIntroPoints = useMemo((): MapPathPoint[] => {
    if (!firstQuestCanvasPoint) return []
    if (startSegmentDraft !== undefined) {
      if (startSegmentDraft === null) {
        return resolveMapPathStartSegment(undefined, undefined, firstQuestCanvasPoint)
      }
      return resolveMapPathStartSegment({ points: startSegmentDraft }, undefined, firstQuestCanvasPoint)
    }
    return resolveMapPathStartSegment(
      savedIntroRaw ?? undefined,
      savedIntroRaw ? undefined : savedLegacyStart,
      firstQuestCanvasPoint,
    )
  }, [firstQuestCanvasPoint, savedIntroRaw, savedLegacyStart, startSegmentDraft])

  useEffect(() => {
    effectiveIntroPointsRef.current = effectiveIntroPoints
  }, [effectiveIntroPoints])

  const effectiveStartPoint = effectiveIntroPoints[0] ?? null

  const introSegmentsForSvg: PathSegmentForSvg[] = useMemo(() => {
    if (effectiveIntroPoints.length < 2) return []
    return [
      {
        fromQuizId: INTRO_SEG_ID,
        points: effectiveIntroPoints,
        strokeDasharray: '8 6',
        strokeClassName: 'stroke-[#f59e0b]/85',
      },
    ]
  }, [effectiveIntroPoints])

  const pathSegmentsForSvg: PathSegmentForSvg[] = useMemo(() => {
    const out: PathSegmentForSvg[] = []
    for (let i = 0; i < assignedIds.length - 1; i += 1) {
      const fromId = assignedIds[i]
      const pts = effectivePath[fromId]?.points
      if (pts && pts.length >= 2) out.push({ fromQuizId: fromId, points: pts })
    }
    return out
  }, [assignedIds, effectivePath])

  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setEditorWidth(el.clientWidth))
    ro.observe(el)
    setEditorWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [assignedIds.length])

  const handleLayoutPointerDown = (quizId: string, event: PointerEvent<HTMLButtonElement>) => {
    dragQuizIdRef.current = quizId
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleLayoutPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pathDrag = pathDragRef.current
    const editor = editorRef.current
    if (pathDrag && editor && pathDrag.pointerId === event.pointerId) {
      const rect = editor.getBoundingClientRect()
      const xPct = ((event.clientX - rect.left) / rect.width) * 100
      const yCanvasPct = ((event.clientY - rect.top) / rect.height) * 100
      if (pathDrag.kind === 'intro-waypoint') {
        const clamped: MapPathPoint = {
          xPct: Math.max(0, Math.min(100, xPct)),
          yCanvasPct: Math.max(0, Math.min(100, yCanvasPct)),
        }
        const idx = pathDrag.pointIndex
        setStartSegmentDraft((prev) => {
          const base = prev ?? [...effectiveIntroPointsRef.current]
          if (idx < 0 || idx >= base.length || idx === base.length - 1) return prev
          const nextPts = [...base]
          nextPts[idx] = clamped
          return nextPts
        })
        return
      }
      const clamped: MapPathPoint = {
        xPct: Math.max(0, Math.min(100, xPct)),
        yCanvasPct: Math.max(0, Math.min(100, yCanvasPct)),
      }
      setPathDraft((prev) => {
        const base = { ...(prev ?? savedPath) }
        const seg = base[pathDrag.fromQuizId]
        if (!seg?.points?.length) return prev
        const nextPts = [...seg.points]
        nextPts[pathDrag.pointIndex] = clamped
        return { ...base, [pathDrag.fromQuizId]: { points: nextPts } }
      })
      return
    }

    const quizId = dragQuizIdRef.current
    if (!quizId || !editor) return
    const rect = editor.getBoundingClientRect()
    const xPct = ((event.clientX - rect.left) / rect.width) * 100
    const yCanvasPct = ((event.clientY - rect.top) / rect.height) * 100
    const index = assignedIds.indexOf(quizId)
    if (index < 0) return
    const nodesPerTile = MAP_PATH_ANCHORS.length
    const tileIndex = Math.floor(index / nodesPerTile)
    const topPx = (yCanvasPct / 100) * canvasHeightPx - tileIndex * editorMetrics.tileHeight
    const localY = (topPx / editorMetrics.tileHeight) * 100
    setLayoutDraft((prev) => {
      const base = prev ?? savedLayout
      return {
        ...base,
        [quizId]: {
          xPct: Math.max(4, Math.min(96, xPct)),
          yPct: Math.max(4, Math.min(96, localY)),
        },
      }
    })
  }

  const handleLayoutPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    if (editor?.hasPointerCapture?.(event.pointerId)) {
      editor.releasePointerCapture(event.pointerId)
    }
    const pathDrag = pathDragRef.current
    if (pathDrag && pathDrag.pointerId === event.pointerId) {
      pathDragRef.current = null
    }
    dragQuizIdRef.current = null
  }

  const handleWaypointPointerDown = (fromQuizId: string, pointIndex: number, event: SvgPointerEvent<SVGCircleElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const editor = editorRef.current
    if (editor) editor.setPointerCapture(event.pointerId)
    if (fromQuizId === INTRO_SEG_ID) {
      pathDragRef.current = { kind: 'intro-waypoint', pointIndex, pointerId: event.pointerId }
    } else {
      pathDragRef.current = { kind: 'waypoint', fromQuizId, pointIndex, pointerId: event.pointerId }
    }
  }

  const handleStartPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const editor = editorRef.current
    if (editor) editor.setPointerCapture(event.pointerId)
    pathDragRef.current = { kind: 'intro-waypoint', pointIndex: 0, pointerId: event.pointerId }
  }

  const handleEditorDoubleClick = (event: DivMouseEvent<HTMLDivElement>) => {
    const editor = editorRef.current
    if (!editor) return
    if ((event.target as HTMLElement).closest('button,a,input,textarea,select,[role="button"]')) return
    const rect = editor.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * 100
    const py = ((event.clientY - rect.top) / rect.height) * 100

    const introPts = effectiveIntroPointsRef.current
    const threshold = 8
    let bestDist = threshold
    type InsertPick =
      | { kind: 'intro'; insertAt: number; point: MapPathPoint }
      | { kind: 'quiz'; fromQuizId: string; insertAt: number; point: MapPathPoint }
    let best: InsertPick | null = null

    if (assignedIds.length >= 1 && introPts.length >= 2) {
      for (let i = 0; i < introPts.length - 1; i += 1) {
        const a = introPts[i]
        const b = introPts[i + 1]
        const { dist, mx, my } = distancePointToSegment(px, py, a.xPct, a.yCanvasPct, b.xPct, b.yCanvasPct)
        if (dist < bestDist) {
          bestDist = dist
          best = { kind: 'intro', insertAt: i + 1, point: { xPct: mx, yCanvasPct: my } }
        }
      }
    }

    if (assignedIds.length >= 2) {
      for (const seg of pathSegmentsForSvg) {
        const pts = seg.points
        for (let i = 0; i < pts.length - 1; i += 1) {
          const a = pts[i]
          const b = pts[i + 1]
          const { dist, mx, my } = distancePointToSegment(px, py, a.xPct, a.yCanvasPct, b.xPct, b.yCanvasPct)
          if (dist < bestDist) {
            bestDist = dist
            best = {
              kind: 'quiz',
              fromQuizId: seg.fromQuizId,
              insertAt: i + 1,
              point: { xPct: mx, yCanvasPct: my },
            }
          }
        }
      }
    }

    if (!best) return

    if (best.kind === 'intro') {
      setStartSegmentDraft((prev) => {
        const base = prev ?? [...introPts]
        const nextPts = [...base.slice(0, best.insertAt), best.point, ...base.slice(best.insertAt)]
        return nextPts
      })
      return
    }

    setPathDraft((prev) => {
      const base = { ...(prev ?? savedPath) }
      const cur = base[best.fromQuizId]?.points ?? effectivePath[best.fromQuizId]?.points
      if (!cur || cur.length < 2) return prev
      const nextPts = [...cur.slice(0, best.insertAt), best.point, ...cur.slice(best.insertAt)]
      return { ...base, [best.fromQuizId]: { points: nextPts } }
    })
  }

  const handleResetLayout = () => {
    setLayoutDraft(defaultLayout)
  }

  const handleSaveLayout = () => {
    const result = updateStudentMapNodeLayout(student.id, effectiveLayout)
    if (!result.ok) return
    const w = editorRef.current?.clientWidth ?? 800
    syncStudentMapPathEndpoints(student.id, w, false)
    syncStudentMapPathStartSegment(student.id, w, false)
    setLayoutDraft(null)
    bump()
  }

  const handleSavePath = () => {
    const w = editorRef.current?.clientWidth ?? 800
    const result = updateStudentMapPathSegments(student.id, pathDraft ?? savedPath, w, false)
    if (!result.ok) return
    if (startSegmentDraft !== undefined) {
      const startRes = updateStudentMapPathStartSegment(
        student.id,
        startSegmentDraft === null ? null : startSegmentDraft,
        w,
        false,
      )
      if (!startRes.ok) return
    }
    setPathDraft(null)
    setStartSegmentDraft(undefined)
    bump()
  }

  const handleResetPath = () => {
    setPathDraft({})
  }

  const handleResetEntryPoint = () => {
    setStartSegmentDraft(null)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Challenge path</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing is on this path until you add it. Use <strong>Add challenge</strong> to pick the next quiz from your
          library (up to {SLOT_COUNT} in order). Students use the separate profile view to play.
        </p>
      </div>

      {quizzes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] p-8 text-center text-sm text-muted-foreground">
          No quizzes in your library yet. Create quizzes under <strong>Games → Timed Challenge</strong> first.
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assignedQuizzes.map((quiz, i) => (
            <AssignedQuizCard
              key={`${quiz.id}-${i}`}
              quiz={quiz}
              index={i}
              onRemove={() => handleRemoveAt(i)}
            />
          ))}
          {canAddMore ? (
            <EmptyNextSlotCard key="add" onClick={() => setPickerOpen(true)} />
          ) : null}
        </div>
      )}

      {assignedQuizzes.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Map node placement</h3>
              <p className="text-xs text-muted-foreground">Drag markers to align nodes with the road, then save.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-[var(--border)]" onClick={handleResetLayout}>
                Reset default
              </Button>
              <Button type="button" onClick={handleSaveLayout}>
                Save placement
              </Button>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-foreground">Walking route</h3>
              <p className="text-xs text-muted-foreground">
                Drag points to bend paths. Double-click a line (orange or teal) to add a bend. Drag the <strong>Start</strong>{' '}
                pill or orange dots to shape the route to quest 1 (students never see these markers). Save when done.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="border-[var(--border)]" onClick={handleResetEntryPoint}>
                Reset entry point
              </Button>
              <Button type="button" variant="outline" className="border-[var(--border)]" onClick={handleResetPath}>
                Reset path
              </Button>
              <Button type="button" variant="outline" className="border-[var(--border)]" onClick={handleSavePath}>
                Save path
              </Button>
            </div>
          </div>
          <div
            ref={editorRef}
            className="relative w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]"
            style={{ height: canvasHeightPx }}
            onPointerMove={handleLayoutPointerMove}
            onPointerUp={handleLayoutPointerUp}
            onPointerCancel={handleLayoutPointerUp}
            onDoubleClick={handleEditorDoubleClick}
          >
            <div className="absolute inset-0" style={forestBgTiledStyle} />
            <ForestTree1Leaves layout="tiled" />
            {introSegmentsForSvg.length > 0 ? (
              <ChallengeMapPathSvg
                canvasHeightPx={canvasHeightPx}
                segments={introSegmentsForSvg}
                strokeLayerClassName="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                handlesLayerClassName="pointer-events-none absolute inset-0 z-[5] h-full w-full"
                interactive
                waypointFilter={(fromQuizId, pointIndex, count) =>
                  fromQuizId !== INTRO_SEG_ID || (pointIndex > 0 && pointIndex < count - 1)
                }
                waypointCircleClassName="pointer-events-auto cursor-grab fill-[#fffbeb] stroke-[#f59e0b] stroke-[1.5]"
                onWaypointPointerDown={handleWaypointPointerDown}
              />
            ) : null}
            {assignedIds.length >= 2 && pathSegmentsForSvg.length > 0 ? (
              <ChallengeMapPathSvg
                canvasHeightPx={canvasHeightPx}
                segments={pathSegmentsForSvg}
                strokeLayerClassName="pointer-events-none absolute inset-0 z-[3] h-full w-full"
                handlesLayerClassName="pointer-events-none absolute inset-0 z-[4] h-full w-full"
                interactive
                onWaypointPointerDown={handleWaypointPointerDown}
              />
            ) : null}
            {effectiveStartPoint && assignedIds.length >= 1 ? (
              <button
                type="button"
                className="absolute z-[11] flex min-w-[4.5rem] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center gap-0.5 rounded-full border-2 border-dashed border-[#f59e0b] bg-[#422006]/90 px-2.5 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#fef3c7] shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
                style={{ left: `${effectiveStartPoint.xPct}%`, top: `${effectiveStartPoint.yCanvasPct}%` }}
                onPointerDown={handleStartPointerDown}
                aria-label="Drag where the walk begins before the first quest"
              >
                Start
              </button>
            ) : null}
            {assignedQuizzes.map((quiz, index) => {
              const point = effectiveLayout[quiz.id] ?? defaultLayout[quiz.id] ?? MAP_PATH_ANCHORS[index % MAP_PATH_ANCHORS.length]
              const nodesPerTile = MAP_PATH_ANCHORS.length
              const tileHeight = editorMetrics.tileHeight
              const tileIndex = Math.floor(index / nodesPerTile)
              const topPx = tileIndex * tileHeight + (point.yPct / 100) * tileHeight
              const topPct = canvasHeightPx > 0 ? (topPx / canvasHeightPx) * 100 : point.yPct
              return (
                <button
                  key={quiz.id}
                  type="button"
                  className="absolute z-[10] -translate-x-1/2 -translate-y-1/2 flex h-[5.75rem] w-[5.75rem] items-center justify-center rounded-full border-4 border-[#2ca9b8] bg-gradient-to-b from-[#fff0c6] to-[#f3bb5e] text-[1.75rem] font-black leading-none text-[#5a350c] shadow-[0_0_0_6px_rgba(44,169,184,0.45),0_14px_24px_rgba(17,59,66,0.42)]"
                  style={{ left: `${point.xPct}%`, top: `${topPct}%` }}
                  onPointerDown={(event) => handleLayoutPointerDown(quiz.id, event)}
                  aria-label={`Drag position for ${quiz.name}`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The student map uses these saved positions and the walking route for the assigned quizzes.
          </p>
        </section>
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg gap-0 border-[var(--border)] bg-[var(--surface-1)] p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-[var(--border)] px-6 py-4 text-left">
            <DialogTitle>Choose a quiz</DialogTitle>
            <DialogDescription>
              Premade challenges from your Timed Challenge library. Quizzes already on this path are hidden.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pt-4">
            <Input
              placeholder="Search by name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="border-[var(--border)] bg-[var(--surface-2)]"
            />
          </div>
          <ScrollArea className="h-[min(60vh,420px)] px-3 py-2">
            <ul className="space-y-1 pr-3 pb-4">
              {availableForPicker.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {quizzes.length === assignedIds.length
                    ? 'All quizzes are already on this path.'
                    : 'No quizzes match your search.'}
                </li>
              ) : (
                availableForPicker.map((quiz) => {
                  const first = getFirstQuizQuestionPreview(quiz)
                  const thumb = getQuizCardCoverUrl({
                    quizId: quiz.id,
                    quizName: quiz.name,
                    coverImageMode: quiz.coverImageMode,
                    manualCoverImageUrl: quiz.coverImageUrl,
                    fallbackImageUrl: first?.imageUrl,
                    imageSearchQuery: first?.imageSearchQuery,
                    imageStyle: first?.imageStyle,
                  })
                  return (
                    <li key={quiz.id}>
                      <button
                        type="button"
                        onClick={() => handlePickQuiz(quiz.id)}
                        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--border)] hover:bg-[var(--surface-2)]"
                      >
                        <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-3)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={thumb} alt="" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground">{quiz.name}</p>
                          <p className="text-xs text-muted-foreground">{getTotalQuestionCountAcrossTiers(quiz)} questions</p>
                        </div>
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  )
}
