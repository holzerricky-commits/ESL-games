'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Loader2, Save, Trash2, ArrowUp, ArrowDown, Settings2, Link2, Upload, ChevronUp, ChevronDown, Plus, RefreshCw, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import type { Quiz, QuizQuestion } from '@/lib/types'
import { getReliableImageUrl } from '@/lib/helpers'
import { getCuratedImageSearchOverride } from '@/lib/quiz-image-queries'
import { quizUiStyleFromStoredOrParam } from '@/lib/quiz-image-style'
import { saveQuiz } from '@/lib/storage'
import { getSuggestionFetchCount } from '@/lib/suggestion-constants'

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const STYLES = ['Photo', 'Cartoon / Illustration', '3D render'] as const
type StyleType = typeof STYLES[number]
type Difficulty = 'Easy' | 'Medium' | 'Hard'

interface SelectedVocabWord {
  word: string
  difficulty: Difficulty
  isPriority: boolean
}

interface SuggestionResponse {
  easy: string[]
  medium: string[]
  hard: string[]
}

interface SuggestionApiResponse {
  suggestions?: SuggestionResponse
  throttled?: boolean
  timedOut?: boolean
  /** True when list came from server cache/throttle without a fresh Gemini call. */
  fromCache?: boolean
}

function hasStrongCoverage(
  suggestions: SuggestionResponse | undefined,
  requiredPerDifficulty: number
): boolean {
  if (!suggestions) return false
  return (
    (suggestions.easy?.length ?? 0) >= requiredPerDifficulty &&
    (suggestions.medium?.length ?? 0) >= requiredPerDifficulty &&
    (suggestions.hard?.length ?? 0) >= requiredPerDifficulty
  )
}

function getDefaultPassThreshold(count: number) {
  return Math.ceil(count * 0.8)
}

function formatQuizTitle(input: string): string {
  const smallWords = new Set(['a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'of', 'to', 'in', 'on', 'at', 'by'])
  const cleaned = input.trim().replace(/\s+/g, ' ')
  if (!cleaned) return ''
  const words = cleaned.split(' ')
  return words
    .map((word, idx) => {
      const lower = word.toLowerCase()
      const isEdge = idx === 0 || idx === words.length - 1
      if (!isEdge && smallWords.has(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

function hasMeaningfulSuggestionInput(quizName: string, specialNotes: string) {
  return quizName.trim().length > 3 || specialNotes.trim().length > 5
}

function difficultyToApiBucket(d: Difficulty): 'easy' | 'medium' | 'hard' {
  if (d === 'Easy') return 'easy'
  if (d === 'Medium') return 'medium'
  return 'hard'
}

/** Remove first `questionCount` visible (non-dismissed, non-selected) words from pool order — reveals buffer. */
function stripVisibleFromPool(
  pool: string[],
  difficulty: Difficulty,
  dismissed: Record<Difficulty, Set<string>>,
  selectedVocabWords: SelectedVocabWord[],
  questionCount: number
): string[] {
  const selectedSet = new Set(selectedVocabWords.map((x) => x.word))
  const d = dismissed[difficulty]
  const filtered = pool.filter((w) => {
    const x = w.trim().toLowerCase()
    return !d.has(x) && !selectedSet.has(x)
  })
  const visible = filtered.slice(0, questionCount)
  const visibleSet = new Set(visible.map((w) => w.trim().toLowerCase()))
  return pool.filter((w) => !visibleSet.has(w.trim().toLowerCase()))
}

function normalizeMediaType(question: QuizQuestion): 'static' | 'gif' {
  if (question.mediaType === 'gif' || question.mediaType === 'static') return question.mediaType
  // Backward compatibility for previously saved quizzes that used `isGif`.
  const legacyIsGif = (question as QuizQuestion & { isGif?: boolean }).isGif
  return legacyIsGif ? 'gif' : 'static'
}

interface QuestionReviewCardProps {
  question: QuizQuestion
  index: number
  total: number
  onChange: (q: QuizQuestion) => void
  onRemove: (id: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  globalStyle: StyleType
  globalMediaType: 'static' | 'gif'
}

function QuestionReviewCard({ 
  question, 
  index, 
  total, 
  onChange, 
  onRemove, 
  onMoveUp, 
  onMoveDown,
  globalStyle,
  globalMediaType
}: QuestionReviewCardProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [customUrl, setCustomUrl] = useState(question.customImageUrl || '')
  const [showCustomize, setShowCustomize] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [imgKey, setImgKey] = useState(0)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [sameImageWarning, setSameImageWarning] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const urlInputRef = useRef<HTMLInputElement>(null)
  const lastResolvedSrcRef = useRef('')
  const beforeLoadResolvedSrcRef = useRef('')
  const pendingCompareRef = useRef(false)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use custom settings if set, otherwise use global
  const effectiveStyle = question.imageStyle || globalStyle
  const effectiveMediaType = question.mediaType ?? globalMediaType
  const displayUrl = customUrl || question.imageUrl
  const prevResolvedForApi = question.resolvedPreviewUrl || lastResolvedSrcRef.current || undefined

  /** New stock image using Photo style and clearing custom URL (fallback when style change fails). */
  const applyPhotoFallback = () => {
    setSameImageWarning(false)
    setImgError(false)
    setShowUrlInput(false)
    const newUrl = getReliableImageUrl(
      question.vocabularyWord,
      generateId(),
      effectiveMediaType,
      question.imageSearchQuery,
      'Photo',
      prevResolvedForApi
    )
    onChange({
      ...question,
      imageStyle: 'Photo',
      imageUrl: newUrl,
      customImageUrl: undefined,
      resolvedPreviewUrl: undefined,
    })
    setCustomUrl('')
  }

  // Any change to the displayed image URL (global style, regenerate, etc.) → loading + new key
  useEffect(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current)
      loadTimeoutRef.current = null
    }
    setImageLoading(true)
    setImgError(false)
    setSameImageWarning(false)
    beforeLoadResolvedSrcRef.current = lastResolvedSrcRef.current
    pendingCompareRef.current = Boolean(lastResolvedSrcRef.current)
    setImgKey((k) => k + 1)
    loadTimeoutRef.current = setTimeout(() => {
      loadTimeoutRef.current = null
      setImageLoading((still) => {
        if (still) setImgError(true)
        return false
      })
    }, 25000)
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current)
        loadTimeoutRef.current = null
      }
    }
  }, [displayUrl])

  const handleCustomUrlChange = (url: string) => {
    setCustomUrl(url)
    setImgError(false)
    // Play mode reads `imageUrl`; keep both in sync when using a custom link or data URL.
    onChange({ ...question, customImageUrl: url, imageUrl: url, resolvedPreviewUrl: undefined })
  }

  const handleStyleChange = (newStyle: StyleType) => {
    if (!question.customImageUrl) {
      const newUrl = getReliableImageUrl(
        question.vocabularyWord,
        generateId(),
        effectiveMediaType,
        question.imageSearchQuery,
        newStyle,
        prevResolvedForApi
      )
      onChange({
        ...question,
        imageStyle: newStyle,
        imageUrl: newUrl,
        resolvedPreviewUrl: undefined,
      })
    } else {
      onChange({ ...question, imageStyle: newStyle })
    }
  }

  const handleMediaTypeChange = (mediaType: 'static' | 'gif') => {
    const newUrl = getReliableImageUrl(
      question.vocabularyWord,
      generateId(),
      mediaType,
      question.imageSearchQuery,
      effectiveStyle,
      prevResolvedForApi
    )
    onChange({
      ...question,
      mediaType,
      imageUrl: newUrl,
      customImageUrl: undefined,
      resolvedPreviewUrl: undefined,
    })
    setCustomUrl('')
  }

  const refreshImage = () => {
    const newUrl = getReliableImageUrl(
      question.vocabularyWord,
      generateId(),
      effectiveMediaType,
      question.imageSearchQuery,
      effectiveStyle,
      prevResolvedForApi
    )
    onChange({
      ...question,
      imageUrl: newUrl,
      customImageUrl: undefined,
      resolvedPreviewUrl: undefined,
    })
    setCustomUrl('')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        handleCustomUrlChange(dataUrl)
        setShowUrlInput(false)
      }
      reader.readAsDataURL(file)
    }
  }

  useEffect(() => {
    setCustomUrl(question.customImageUrl || '')
  }, [question.customImageUrl])

  useEffect(() => {
    if (!showUrlInput) return
    const t = setTimeout(() => {
      urlInputRef.current?.focus()
      urlInputRef.current?.select()
    }, 0)
    return () => clearTimeout(t)
  }, [showUrlInput])

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      const next = text.trim()
      if (!next) return
      setCustomUrl(next)
      urlInputRef.current?.focus()
    } catch {
      // Clipboard API can be blocked; users can still paste via keyboard/context menu.
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-3 animate-slide-up">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Reorder arrows */}
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0}
              className="p-1 rounded hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1}
              className="p-1 rounded hover:bg-[var(--surface-3)] disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowDown size={14} />
            </button>
          </div>
          <span className="text-xs font-mono font-bold text-[var(--brand-blue)]">Q{index + 1}</span>
          <Badge variant="outline" className="bg-[var(--brand-blue)]/10 text-[var(--brand-blue-bright)] border-[var(--brand-blue)]/30 text-xs">
            {question.vocabularyWord}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowCustomize(!showCustomize)}
            className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
              showCustomize 
                ? 'bg-[var(--brand-blue)] text-white' 
                : 'text-muted-foreground hover:text-foreground hover:bg-[var(--surface-3)]'
            }`}
          >
            <Settings2 size={14} />
            <span className="hidden sm:inline">Customize</span>
          </button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7 text-[var(--brand-red)] hover:bg-[var(--brand-red)]/10" 
            onClick={() => onRemove(question.id)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Question text */}
      <Textarea
        value={question.questionText}
        onChange={(e) => onChange({ ...question, questionText: e.target.value })}
        className="resize-none bg-[var(--surface-3)] border-[var(--border)] text-foreground min-h-[60px] text-sm"
        placeholder="Question text..."
      />

      {/* Collapsible customize section */}
      {showCustomize && (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-[var(--surface-3)] border border-[var(--border)]">
          {/* Style selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Image Style (overrides global)</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStyleChange(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    effectiveStyle === s
                      ? 'bg-[var(--brand-blue)] text-white'
                      : 'bg-[var(--surface-2)] border border-[var(--border)] text-foreground hover:border-[var(--brand-blue)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* GIF Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground">Type:</label>
            <button
              type="button"
              onClick={() => handleMediaTypeChange('static')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                effectiveMediaType === 'static'
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'bg-[var(--surface-2)] border border-[var(--border)] text-foreground'
              }`}
            >
              Static
            </button>
            <button
              type="button"
              onClick={() => handleMediaTypeChange('gif')}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                effectiveMediaType === 'gif'
                  ? 'bg-[var(--brand-blue)] text-white'
                  : 'bg-[var(--surface-2)] border border-[var(--border)] text-foreground'
              }`}
            >
              GIF
            </button>
          </div>
        </div>
      )}

      {/* Image preview */}
      <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-[var(--surface-3)] aspect-[16/9]">
        <button
          type="button"
          onClick={refreshImage}
          disabled={imageLoading}
          title="Regenerate image from vocabulary word"
          aria-label="Regenerate image"
          className="absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-lg bg-black/55 px-2.5 py-1.5 text-xs font-medium text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-black/70 disabled:pointer-events-none disabled:opacity-40"
        >
          <RefreshCw size={14} className="shrink-0" />
          <span className="hidden sm:inline">Regenerate</span>
        </button>
        {imageLoading && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/35 backdrop-blur-sm"
            aria-busy="true"
            aria-label="Loading image"
          >
            <Loader2 size={28} className="animate-spin text-white drop-shadow-md" />
            <span className="text-xs font-medium text-white/95 drop-shadow">Loading image…</span>
          </div>
        )}
        {!imgError ? (
          <img
            key={imgKey}
            src={displayUrl}
            alt={question.vocabularyWord}
            className={`w-full h-full object-cover transition-[filter,opacity,transform] duration-300 ${
              imageLoading ? 'scale-[1.02] blur-md opacity-60' : 'blur-0 opacity-100 scale-100'
            }`}
            onLoad={(e) => {
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current)
                loadTimeoutRef.current = null
              }
              const resolved = e.currentTarget.currentSrc
              if (pendingCompareRef.current) {
                pendingCompareRef.current = false
                const prev = beforeLoadResolvedSrcRef.current
                if (prev && resolved === prev) {
                  setSameImageWarning(true)
                }
              }
              lastResolvedSrcRef.current = resolved
              onChange({ ...question, resolvedPreviewUrl: resolved })
              setImageLoading(false)
              setImgError(false)
            }}
            onError={() => {
              if (loadTimeoutRef.current) {
                clearTimeout(loadTimeoutRef.current)
                loadTimeoutRef.current = null
              }
              pendingCompareRef.current = false
              setImageLoading(false)
              setImgError(true)
            }}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground text-sm">
            <span>Couldn&apos;t load this image.</span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={refreshImage}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-[var(--surface-3)]"
              >
                <RefreshCw size={14} />
                Try again
              </button>
              <button
                type="button"
                onClick={applyPhotoFallback}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-blue)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-blue-bright)]"
              >
                Use Photo style
              </button>
            </div>
          </div>
        )}

        {/* Bottom left: Link icon — always available (even while loading) so you can paste a custom URL */}
        <div className="absolute bottom-2 left-2 z-20">
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="Paste image URL"
          >
            <Link2 size={16} />
          </button>
        </div>

        {/* Bottom right: Upload icon */}
        <div className="absolute bottom-2 right-2 z-20">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-lg bg-black/50 text-white hover:bg-black/70 transition-colors"
            title="Upload image"
          >
            <Upload size={16} />
          </button>
        </div>

        {/* URL input overlay (when link icon is clicked) */}
        {showUrlInput && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-xl backdrop-blur-sm p-4 z-30">
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <Input
                autoFocus
                ref={urlInputRef}
                type="text"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                onPaste={(e) => {
                  const txt = e.clipboardData.getData('text')
                  if (txt) setCustomUrl(txt.trim())
                }}
                placeholder="Paste image or GIF URL (https://…)"
                className="bg-[var(--surface-1)] border-[var(--border)] text-foreground text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customUrl.trim()) {
                    handleCustomUrlChange(customUrl.trim())
                    setShowUrlInput(false)
                  } else if (e.key === 'Escape') {
                    setShowUrlInput(false)
                  }
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void pasteFromClipboard()
                  }}
                  className="px-3 py-1.5 bg-[var(--surface-3)] border border-[var(--border)] text-foreground rounded-lg text-xs font-medium hover:bg-[var(--surface-2)] transition-colors"
                >
                  Paste
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (customUrl.trim()) {
                      handleCustomUrlChange(customUrl.trim())
                      setShowUrlInput(false)
                    }
                  }}
                  className="flex-1 px-3 py-1.5 bg-[var(--brand-blue)] text-white rounded-lg text-xs font-medium hover:bg-[var(--brand-blue-bright)] transition-colors"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className="flex-1 px-3 py-1.5 bg-[var(--surface-3)] border border-[var(--border)] text-foreground rounded-lg text-xs font-medium hover:bg-[var(--surface-2)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

        {sameImageWarning && !imgError && !imageLoading && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100/95">
            <p className="font-medium">This style didn&apos;t change the image (same result as before).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={refreshImage}
                className="rounded-md border border-amber-700/30 bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-[var(--surface-3)]"
              >
                Try another
              </button>
              <button
                type="button"
                onClick={applyPhotoFallback}
                className="rounded-md bg-[var(--brand-blue)] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[var(--brand-blue-bright)]"
              >
                Use Photo style
              </button>
              <button
                type="button"
                onClick={() => setSameImageWarning(false)}
                className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface CreateQuizModalProps {
  editingQuiz?: Quiz | null
  onClose: () => void
  onSaved: (quiz: Quiz) => void
}

export function CreateQuizModal({ editingQuiz, onClose, onSaved }: CreateQuizModalProps) {
  const [step, setStep] = useState<'form' | 'review'>(editingQuiz ? 'review' : 'form')
  const [quizName, setQuizName] = useState(editingQuiz?.name ?? '')
  const [coverImageMode, setCoverImageMode] = useState<'auto' | 'manual'>(editingQuiz?.coverImageMode ?? 'auto')
  const [coverImageUrl, setCoverImageUrl] = useState(editingQuiz?.coverImageUrl ?? '')
  const [specialNotes, setSpecialNotes] = useState(editingQuiz?.description ?? '')
  const [appliedSpecialNotes, setAppliedSpecialNotes] = useState(editingQuiz?.description ?? '')
  const [notesDirty, setNotesDirty] = useState(false)
  const [notesApplyTick, setNotesApplyTick] = useState(0)
  const [suggestionStatus, setSuggestionStatus] = useState('')
  const [questionCount, setQuestionCount] = useState(
    editingQuiz?.challengeQuestionCount ?? Math.max(3, Math.min(12, editingQuiz?.questions.length ?? 6))
  )
  const [passThresholdTouched, setPassThresholdTouched] = useState(Boolean(editingQuiz))
  const [passThresholdInput, setPassThresholdInput] = useState(
    String(editingQuiz?.passThreshold ?? getDefaultPassThreshold(6))
  )
  const [manualWordInput, setManualWordInput] = useState('')
  const [selectedVocabWords, setSelectedVocabWords] = useState<SelectedVocabWord[]>(
    editingQuiz
      ? editingQuiz.questions.map((q) => ({
          word: q.vocabularyWord,
          difficulty: 'Medium' as Difficulty,
          isPriority: Boolean(q.isPriority),
        }))
      : []
  )
  const [difficultySuggestionPools, setDifficultySuggestionPools] = useState<Record<Difficulty, string[]>>({
    Easy: [],
    Medium: [],
    Hard: [],
  })
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Record<Difficulty, Set<string>>>({
    Easy: new Set<string>(),
    Medium: new Set<string>(),
    Hard: new Set<string>(),
  })
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [regeneratingBucket, setRegeneratingBucket] = useState<Difficulty | null>(null)
  /** Last load was memory/disk cache — Regenerate should call Gemini for a full new bucket, not rotate buffer. */
  const [suggestionsFromCache, setSuggestionsFromCache] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    (editingQuiz?.questions ?? []).map((q) => ({
      ...q,
      mediaType: normalizeMediaType(q),
      imageStyle: quizUiStyleFromStoredOrParam(q.imageStyle),
    }))
  )
  const [generating, setGenerating] = useState(false)
  const selectedVocabRef = useRef(selectedVocabWords)
  selectedVocabRef.current = selectedVocabWords
  const dismissedRef = useRef(dismissedSuggestions)
  dismissedRef.current = dismissedSuggestions
  const refillAttemptsRef = useRef(0)
  const loadingSuggestionsRef = useRef(false)
  loadingSuggestionsRef.current = loadingSuggestions

  // Global settings for Review screen
  const [globalStyle, setGlobalStyle] = useState<StyleType>(() => {
    const qs = editingQuiz?.questions ?? []
    if (qs.length === 0) return 'Photo'
    return quizUiStyleFromStoredOrParam(qs[0].imageStyle)
  })
  const [globalMediaType, setGlobalMediaType] = useState<'static' | 'gif'>(
    () => ((editingQuiz?.questions ?? []).some((q) => normalizeMediaType(q) === 'gif') ? 'gif' : 'static')
  )

  const applyNotesToSuggestions = () => {
    setAppliedSpecialNotes(specialNotes)
    setNotesDirty(false)
    setNotesApplyTick((x) => x + 1)
  }

  const applySuggestionResponse = (data: SuggestionApiResponse) => {
    const suggestions: SuggestionResponse | undefined = data?.suggestions
    if (!suggestions) return
    const isEmpty =
      (!suggestions.easy || suggestions.easy.length === 0) &&
      (!suggestions.medium || suggestions.medium.length === 0) &&
      (!suggestions.hard || suggestions.hard.length === 0)
    if (isEmpty && (data.throttled || data.timedOut)) return
    if (!isEmpty && (data.timedOut || data.throttled) && !hasStrongCoverage(suggestions, questionCount)) {
      setSuggestionStatus('Partially updated (AI response was limited).')
    } else {
      setSuggestionStatus('')
    }
    setDifficultySuggestionPools({
      Easy: Array.isArray(suggestions.easy) ? suggestions.easy : [],
      Medium: Array.isArray(suggestions.medium) ? suggestions.medium : [],
      Hard: Array.isArray(suggestions.hard) ? suggestions.hard : [],
    })
    setSuggestionsFromCache(!!data.fromCache || !!data.throttled)
  }

  const regenerateSuggestionRow = async (difficulty: Difficulty) => {
    if (!hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) || quizName.trim().length < 4) return
    setRegeneratingBucket(difficulty)
    setSuggestionStatus('')
    try {
      const selected = selectedVocabRef.current.map((w) => w.word)
      const d = dismissedSuggestions
      const exclude = {
        easy: Array.from(new Set([...d.Easy, ...selected])),
        medium: Array.from(new Set([...d.Medium, ...selected])),
        hard: Array.from(new Set([...d.Hard, ...selected])),
      }

      if (suggestionsFromCache) {
        const res = await fetch('/api/vocabulary-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizName,
            specialNotes: appliedSpecialNotes,
            numPerDifficulty: questionCount,
            exclude,
            regenerateBucket: difficultyToApiBucket(difficulty),
            currentSuggestions: {
              easy: difficultySuggestionPools.Easy,
              medium: difficultySuggestionPools.Medium,
              hard: difficultySuggestionPools.Hard,
            },
          }),
        })
        if (!res.ok) return
        const data: SuggestionApiResponse = await res.json()
        applySuggestionResponse(data)
        setSuggestionsFromCache(false)
        return
      }

      const pool = difficultySuggestionPools[difficulty]
      const newPool = stripVisibleFromPool(pool, difficulty, dismissedSuggestions, selectedVocabWords, questionCount)
      const targetSize = getSuggestionFetchCount(questionCount)
      const need = Math.max(0, targetSize - newPool.length)

      const currentSuggestions = {
        easy: difficulty === 'Easy' ? newPool : difficultySuggestionPools.Easy,
        medium: difficulty === 'Medium' ? newPool : difficultySuggestionPools.Medium,
        hard: difficulty === 'Hard' ? newPool : difficultySuggestionPools.Hard,
      }

      if (need === 0) {
        setDifficultySuggestionPools({
          Easy: currentSuggestions.easy,
          Medium: currentSuggestions.medium,
          Hard: currentSuggestions.hard,
        })
        setSuggestionsFromCache(false)
        return
      }

      const res = await fetch('/api/vocabulary-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizName,
          specialNotes: appliedSpecialNotes,
          numPerDifficulty: questionCount,
          exclude,
          topUpBucket: difficultyToApiBucket(difficulty),
          needCount: need,
          currentSuggestions,
        }),
      })
      if (!res.ok) return
      const data: SuggestionApiResponse = await res.json()
      applySuggestionResponse(data)
      setSuggestionsFromCache(false)
    } catch {
      /* keep existing pools */
    } finally {
      setRegeneratingBucket(null)
    }
  }

  // Debounced Gemini suggestions (server-side via API route)
  useEffect(() => {
    if (!hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes)) {
      setDifficultySuggestionPools({ Easy: [], Medium: [], Hard: [] })
      setDismissedSuggestions({ Easy: new Set(), Medium: new Set(), Hard: new Set() })
      setSuggestionStatus('')
      setSuggestionsFromCache(false)
      setLoadingSuggestions(false)
      return
    }

    refillAttemptsRef.current = 0

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true)
      try {
        const selected = selectedVocabRef.current.map((w) => w.word)
        const d = dismissedRef.current
        const exclude = {
          easy: Array.from(new Set([...d.Easy, ...selected])),
          medium: Array.from(new Set([...d.Medium, ...selected])),
          hard: Array.from(new Set([...d.Hard, ...selected])),
        }

        const res = await fetch('/api/vocabulary-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizName,
            specialNotes: appliedSpecialNotes,
            numPerDifficulty: questionCount,
            exclude,
          }),
          signal: controller.signal,
        })

        if (!res.ok) return
        const data: SuggestionApiResponse = await res.json()
        applySuggestionResponse(data)
      } catch {
        // keep last good suggestions on transient network/API errors
      } finally {
        setLoadingSuggestions(false)
      }
    }, 280)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // Dismiss (X) uses a local buffer + separate refill effect; topic/slider/count reset dismissed above.
    // selectedVocabWords omitted from deps; selections merged via selectedVocabRef at fire time.
  }, [quizName, appliedSpecialNotes, questionCount, notesApplyTick])

  // Refill when dismissed/selected exhaust the buffered pool for any row (no instant chips left).
  useEffect(() => {
    if (!hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) || quizName.trim().length < 4) return

    const poolsEmpty =
      difficultySuggestionPools.Easy.length === 0 &&
      difficultySuggestionPools.Medium.length === 0 &&
      difficultySuggestionPools.Hard.length === 0
    if (poolsEmpty || loadingSuggestionsRef.current) return

    const selected = new Set(selectedVocabRef.current.map((w) => w.word))
    const need = questionCount

    const anyRowShort = (['Easy', 'Medium', 'Hard'] as Difficulty[]).some((diff) => {
      const pool = difficultySuggestionPools[diff]
      const dismissed = dismissedSuggestions[diff]
      const available = pool.filter((w) => {
        const x = w.trim().toLowerCase()
        return !dismissed.has(x) && !selected.has(x)
      }).length
      return available < need
    })

    if (!anyRowShort) {
      refillAttemptsRef.current = 0
      return
    }

    if (refillAttemptsRef.current >= 3) return
    refillAttemptsRef.current += 1

    const controller = new AbortController()
    void (async () => {
      setLoadingSuggestions(true)
      try {
        const sel = selectedVocabRef.current.map((w) => w.word)
        const exclude = {
          easy: Array.from(new Set([...dismissedSuggestions.Easy, ...sel])),
          medium: Array.from(new Set([...dismissedSuggestions.Medium, ...sel])),
          hard: Array.from(new Set([...dismissedSuggestions.Hard, ...sel])),
        }

        const res = await fetch('/api/vocabulary-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            quizName,
            specialNotes: appliedSpecialNotes,
            numPerDifficulty: questionCount,
            exclude,
          }),
          signal: controller.signal,
        })

        if (!res.ok) return
        const data: SuggestionApiResponse = await res.json()
        applySuggestionResponse(data)
      } catch {
        /* aborted or network */
      } finally {
        setLoadingSuggestions(false)
      }
    })()

    return () => {
      controller.abort()
    }
  }, [dismissedSuggestions, difficultySuggestionPools, questionCount, quizName, appliedSpecialNotes, selectedVocabWords])

  useEffect(() => {
    if (passThresholdTouched) return
    setPassThresholdInput(String(getDefaultPassThreshold(questionCount)))
  }, [questionCount, passThresholdTouched])

  const maxChallengeLength = Math.max(1, Math.min(questionCount, Math.max(questions.length, questionCount)))
  const maxPassThreshold = maxChallengeLength
  const normalizedPassThreshold = (() => {
    const numeric = Number.parseInt(passThresholdInput, 10)
    if (Number.isNaN(numeric)) return 0
    return Math.max(0, Math.min(maxPassThreshold, numeric))
  })()

  const addWord = (word: string, difficulty: Difficulty) => {
    const w = word.trim().toLowerCase()
    if (w && !selectedVocabWords.some((x) => x.word === w)) {
      setSelectedVocabWords((prev) => [...prev, { word: w, difficulty, isPriority: false }])
    }
  }

  const addAllForDifficulty = (difficulty: Difficulty) => {
    // Match visible row only: first questionCount non-dismissed, non-selected words (extra buffer words stay in pool).
    const source = difficultySuggestionPools[difficulty]
    const dismissed = dismissedSuggestions[difficulty]
    const alreadySelected = new Set(selectedVocabWords.map((x) => x.word))
    if (source.length === 0) return
    const candidates = source
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w && !dismissed.has(w) && !alreadySelected.has(w))
      .slice(0, questionCount)
    if (candidates.length === 0) return
    setSelectedVocabWords((prev) => {
      const existing = new Set(prev.map((x) => x.word))
      const additions = candidates
        .filter((w) => !existing.has(w))
        .map((word) => ({ word, difficulty, isPriority: false }))
      return [...prev, ...additions]
    })
  }

  const removeWord = (word: string) => {
    setSelectedVocabWords((prev) => prev.filter((w) => w.word !== word))
  }

  const clearAllWords = () => {
    setSelectedVocabWords([])
  }

  const togglePriorityWord = (word: string) => {
    setSelectedVocabWords((prev) =>
      prev.map((item) => (item.word === word ? { ...item, isPriority: !item.isPriority } : item))
    )
  }

  const addManualWord = () => {
    const value = manualWordInput.trim().toLowerCase()
    if (!value) return
    addWord(value, 'Medium')
    setManualWordInput('')
  }

  const dismissSuggestion = (difficulty: Difficulty, word: string) => {
    const normalized = word.trim().toLowerCase()
    setDismissedSuggestions((prev) => {
      const nextSet = new Set(prev[difficulty])
      nextSet.add(normalized)
      return { ...prev, [difficulty]: nextSet }
    })
  }

  const canGenerateQuiz = selectedVocabWords.length > 0 && selectedVocabWords.length >= questionCount

  const generateQuestions = () => {
    if (selectedVocabWords.length === 0) {
      alert('Add at least one vocabulary word first.')
      return
    }
    if (selectedVocabWords.length < questionCount) {
      const need = questionCount - selectedVocabWords.length
      alert(
        `You need ${need} more word${need === 1 ? '' : 's'} (or lower Number of Questions from ${questionCount}).`
      )
      return
    }
    setGenerating(true)
    void (async () => {
      try {
        const wordsForQuestions = [...selectedVocabWords]

        const wordList = [...new Set(wordsForQuestions.map((i) => i.word.trim().toLowerCase()))]
        let phraseMap: Record<string, string> = {}
        try {
          const res = await fetch('/api/image-search-phrase', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ words: wordList }),
          })
          if (res.ok) {
            const data = (await res.json()) as { phrases?: Record<string, string> }
            phraseMap = data.phrases ?? {}
          }
        } catch {
          /* fall back to default stock queries */
        }

        const newQuestions: QuizQuestion[] = wordsForQuestions.map((item) => {
          const wNorm = item.word.trim().toLowerCase()
          const llmPhrase = phraseMap[wNorm]?.trim()
          const imageSearchQuery = getCuratedImageSearchOverride(wNorm)
            ? undefined
            : llmPhrase && llmPhrase.length >= 3
              ? llmPhrase
              : undefined
          return {
            id: generateId(),
            vocabularyWord: item.word,
            questionText: `What is this? (${item.word})`,
            isPriority: item.isPriority,
            imageSearchQuery,
            imageUrl: getReliableImageUrl(
              item.word,
              generateId(),
              globalMediaType,
              imageSearchQuery,
              globalStyle
            ),
            mediaType: globalMediaType,
            imageStyle: globalStyle,
          }
        })
        setQuestions(newQuestions)
        setStep('review')
      } finally {
        setGenerating(false)
      }
    })()
  }

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= questions.length) return
    const newQuestions = [...questions]
    const [moved] = newQuestions.splice(fromIndex, 1)
    newQuestions.splice(toIndex, 0, moved)
    setQuestions(newQuestions)
  }

  const applyGlobalStyle = (style: StyleType) => {
    setGlobalStyle(style)
    setQuestions((prev) =>
      prev.map((q) =>
        q.customImageUrl
          ? { ...q, imageStyle: style }
          : {
              ...q,
              imageStyle: style,
              imageUrl: getReliableImageUrl(
                q.vocabularyWord,
                generateId(),
                normalizeMediaType(q),
                q.imageSearchQuery,
                style,
                q.resolvedPreviewUrl
              ),
              resolvedPreviewUrl: undefined,
            }
      )
    )
  }

  const applyGlobalMediaType = (mediaType: 'static' | 'gif') => {
    setGlobalMediaType(mediaType)
    // Apply to all questions that don't have custom settings
    setQuestions((prev) =>
      prev.map((q) =>
        q.customImageUrl
          ? { ...q }
          : {
              ...q,
              mediaType,
              imageUrl: getReliableImageUrl(
                q.vocabularyWord,
                generateId(),
                mediaType,
                q.imageSearchQuery,
                q.imageStyle ?? globalStyle,
                q.resolvedPreviewUrl
              ),
              resolvedPreviewUrl: undefined,
            }
      )
    )
  }

  const handleSave = () => {
    const normalizedQuizName = formatQuizTitle(quizName)
    if (!normalizedQuizName) {
      alert('Please enter a quiz name.')
      return
    }
    if (questions.length === 0) {
      alert('Add at least one question.')
      return
    }
    const quiz: Quiz = {
      id: editingQuiz?.id ?? generateId(),
      name: normalizedQuizName,
      description: specialNotes.trim(),
      questions: questions.map(({ resolvedPreviewUrl: _rp, ...rest }) => rest),
      coverImageMode,
      coverImageUrl: coverImageMode === 'manual' ? coverImageUrl.trim() || undefined : undefined,
      challengeQuestionCount: maxChallengeLength,
      passThreshold: normalizedPassThreshold,
      createdAt: editingQuiz?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    saveQuiz(quiz)
    onSaved(quiz)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 py-8">
      <div className="relative w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--surface-2)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              {editingQuiz ? 'Edit Quiz' : step === 'form' ? 'Create New Quiz' : 'Review Questions'}
            </h2>
            {step === 'review' && (
              <p className="mt-0.5 text-sm text-muted-foreground">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground h-9 w-9">
            <X size={18} />
          </Button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-5 max-h-[70vh] overflow-y-auto">
          {/* Always-visible name + challenge settings */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground">Quiz Name *</label>
              <Input
                value={quizName}
                onChange={(e) => setQuizName(e.target.value)}
                onBlur={() => setQuizName((prev) => formatQuizTitle(prev))}
                placeholder="e.g. Fruits & Vegetables"
                className="bg-[var(--surface-3)] border-[var(--border)] text-foreground"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground">Correct to pass (Challenge)</label>
              <div className="relative">
                <Input
                  type="text"
                  inputMode="numeric"
                  value={passThresholdInput}
                  onChange={(e) => {
                    setPassThresholdTouched(true)
                    const next = e.target.value.replace(/[^\d]/g, '')
                    setPassThresholdInput(next)
                  }}
                  onBlur={() => {
                    setPassThresholdInput(String(normalizedPassThreshold))
                  }}
                  className="bg-[var(--surface-3)] border-[var(--border)] text-foreground pr-11"
                  placeholder="0 = all"
                />
                <div className="absolute inset-y-1 right-1 flex w-8 flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-2)]">
                  <button
                    type="button"
                    onClick={() => {
                      setPassThresholdTouched(true)
                      setPassThresholdInput(String(Math.min(maxPassThreshold, normalizedPassThreshold + 1)))
                    }}
                    className="flex h-1/2 items-center justify-center text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground transition-colors"
                    aria-label="Increase correct-to-pass"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassThresholdTouched(true)
                      setPassThresholdInput(String(Math.max(0, normalizedPassThreshold - 1)))
                    }}
                    className="flex h-1/2 items-center justify-center border-t border-[var(--border)] text-muted-foreground hover:bg-[var(--surface-3)] hover:text-foreground transition-colors"
                    aria-label="Decrease correct-to-pass"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">0 = all must be correct</p>
            </div>
          </div>

          {step === 'form' && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Quiz Cover</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCoverImageMode('auto')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      coverImageMode === 'auto'
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'bg-[var(--surface-2)] border border-[var(--border)] text-foreground'
                    }`}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoverImageMode('manual')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      coverImageMode === 'manual'
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'bg-[var(--surface-2)] border border-[var(--border)] text-foreground'
                    }`}
                  >
                    Manual URL
                  </button>
                </div>
              </div>
              {coverImageMode === 'manual' ? (
                <div className="flex gap-2">
                  <Input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={coverImageUrl}
                    onChange={(e) => setCoverImageUrl(e.target.value)}
                    placeholder="Paste cover image URL (https://...)"
                    className="bg-[var(--surface-2)] border-[var(--border)] text-foreground h-9 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCoverImageMode('auto')}
                    className="border-[var(--border)] text-foreground hover:bg-[var(--surface-2)] h-9 shrink-0"
                  >
                    <RefreshCw size={14} />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Cover will be auto-generated from quiz topic. Switch to Manual URL to set your own image.
                </p>
              )}
            </div>
          )}

          {/* Form step */}
          {step === 'form' && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">Special Notes / Restrictions</label>
                <Textarea
                  value={specialNotes}
                  onChange={(e) => {
                    setSpecialNotes(e.target.value)
                    setNotesDirty(true)
                  }}
                  onBlur={() => {
                    if (notesDirty) applyNotesToSuggestions()
                  }}
                  placeholder="no poultry, focus only on pronunciation, use present tense only..."
                  className="min-h-[100px] resize-none bg-[var(--surface-3)] border-[var(--border)] text-foreground"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Notes only affect suggestions after you apply them.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={notesDirty ? 'default' : 'outline'}
                    onClick={applyNotesToSuggestions}
                    className={notesDirty ? 'bg-[var(--brand-blue)] text-white hover:bg-[var(--brand-blue-bright)]' : 'border-[var(--border)] text-foreground'}
                  >
                    Apply notes
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-foreground">Challenge Length</label>
                  <span className="text-sm font-mono font-bold text-[var(--brand-blue-bright)]">{questionCount}</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  className="w-full accent-[var(--brand-blue)]"
                />
                <p className="text-xs text-muted-foreground">Challenge randomly draws this many words from the pool</p>
              </div>

              {/* Vocabulary Suggestions */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-4 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[var(--brand-yellow)]" />
                  <h3 className="text-sm font-bold text-foreground">Vocabulary Suggestions</h3>
                  {loadingSuggestions && <Loader2 size={14} className="text-[var(--brand-blue)] animate-spin" />}
                </div>
                {!hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) && (
                  <p className="text-xs text-muted-foreground -mt-2">
                    Enter a quiz name (4+ characters) or longer special notes to load AI suggestions. Unrelated filler words are not used.
                  </p>
                )}
                {hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) &&
                  quizName.trim().length < 4 &&
                  appliedSpecialNotes.trim().length > 5 && (
                    <p className="text-xs text-amber-600/90 dark:text-amber-400/90 -mt-2">
                      Quiz name needs at least 4 characters for the model to return topic words. Add a short topic title above.
                    </p>
                  )}
                {suggestionStatus && (
                  <p className="text-xs text-amber-600/90 dark:text-amber-400/90 -mt-2">{suggestionStatus}</p>
                )}

                {(['Easy', 'Medium', 'Hard'] as Difficulty[]).map((difficulty) => {
                  const rowTarget = questionCount
                  const pool = difficultySuggestionPools[difficulty]
                  const selectedSet = new Set(selectedVocabWords.map((x) => x.word))
                  const suggestionHoverClass =
                    difficulty === 'Easy'
                      ? 'hover:border-[var(--brand-green)] hover:text-[var(--brand-green)]'
                      : difficulty === 'Medium'
                        ? 'hover:border-[var(--brand-yellow)] hover:text-[var(--brand-yellow)]'
                        : 'hover:border-[var(--brand-red)] hover:text-[var(--brand-red)]'
                  // Hide selected words so the next buffered suggestions slide into view (same as dismiss).
                  const filteredPool = pool.filter((w) => {
                    const x = w.trim().toLowerCase()
                    return !dismissedSuggestions[difficulty].has(x) && !selectedSet.has(x)
                  })
                  const rowSuggestions = filteredPool.slice(0, rowTarget)
                  const showSuggestionEmpty =
                    hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) &&
                    quizName.trim().length >= 4 &&
                    !loadingSuggestions &&
                    regeneratingBucket !== difficulty &&
                    rowSuggestions.length === 0

                  return (
                    <div key={difficulty} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`inline-block h-2.5 w-2.5 rounded-full ${
                              difficulty === 'Easy'
                                ? 'bg-[var(--brand-green)]'
                                : difficulty === 'Medium'
                                  ? 'bg-[var(--brand-yellow)]'
                                  : 'bg-[var(--brand-red)]'
                            }`}
                          />
                          {difficulty} Vocabulary
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void regenerateSuggestionRow(difficulty)}
                            disabled={
                              !hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) ||
                              quizName.trim().length < 4 ||
                              (regeneratingBucket !== null && regeneratingBucket !== difficulty) ||
                              loadingSuggestions
                            }
                            className="h-8 w-8 p-0 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] disabled:opacity-50"
                            title={`Get new ${difficulty} suggestions from AI`}
                            aria-label={`Regenerate ${difficulty} suggestions`}
                          >
                            {regeneratingBucket === difficulty ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <RefreshCw size={14} />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => addAllForDifficulty(difficulty)}
                            disabled={pool.length === 0}
                            className="h-8 w-8 p-0 border-[var(--border)] text-foreground hover:bg-[var(--surface-3)] disabled:opacity-50"
                            title={`Add all visible ${difficulty} suggestions to pool`}
                            aria-label={`Add all ${difficulty} suggestions`}
                          >
                            <Plus size={14} />
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rowSuggestions.length > 0 && regeneratingBucket !== difficulty ? (
                          rowSuggestions.map((word) => (
                            <button
                              key={`${difficulty}-${word}`}
                              type="button"
                              onClick={() => addWord(word, difficulty)}
                              className={`group rounded-lg border px-2.5 py-1 text-xs transition-all border-[var(--border)] bg-[var(--surface-3)] text-muted-foreground pr-7 relative ${suggestionHoverClass}`}
                            >
                              + {word}
                              <span
                                onClick={(e) => {
                                  e.stopPropagation()
                                  dismissSuggestion(difficulty, word)
                                }}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-[var(--brand-red)] transition-opacity"
                                role="button"
                                aria-label={`Remove suggestion ${word}`}
                              >
                                <X size={10} />
                              </span>
                            </button>
                          ))
                        ) : !hasMeaningfulSuggestionInput(quizName, appliedSpecialNotes) ? (
                          <p className="text-xs text-muted-foreground italic">Suggestions appear here when the topic is clear enough.</p>
                        ) : showSuggestionEmpty ? (
                          <p className="text-xs text-muted-foreground italic">
                            No suggestions yet. Check your connection, API key, or try again in a moment.
                          </p>
                        ) : loadingSuggestions || regeneratingBucket === difficulty ? (
                          <p className="text-xs text-muted-foreground italic">Thinking...</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            Waiting for a valid quiz name (4+ characters) to load suggestions.
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Practice Word Pool */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-3)] p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    Practice Word Pool ({selectedVocabWords.length})
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={clearAllWords}
                    disabled={selectedVocabWords.length === 0}
                    className="border-[var(--border)] text-muted-foreground hover:text-[var(--brand-red)] hover:bg-[var(--surface-2)] disabled:opacity-50 gap-1"
                  >
                    <Trash2 size={13} />
                    Clear all
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={manualWordInput}
                    onChange={(e) => setManualWordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addManualWord()
                      }
                    }}
                    placeholder="Type any custom pool word..."
                    className="bg-[var(--surface-2)] border-[var(--border)] text-foreground h-9 text-sm"
                  />
                  <Button
                    type="button"
                    onClick={addManualWord}
                    size="sm"
                    className="bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white h-9 gap-1 shrink-0"
                  >
                    <Plus size={14} />
                    Add
                  </Button>
                </div>

                {selectedVocabWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedVocabWords.map((item) => (
                      <Badge
                        key={item.word}
                        variant="outline"
                        className={`pr-1.5 gap-1 text-xs ${
                          item.difficulty === 'Easy'
                            ? 'border-[var(--brand-green)]/50 bg-[var(--brand-green)]/20 text-[var(--brand-green-bright)]'
                            : item.difficulty === 'Medium'
                              ? 'border-[var(--brand-yellow)]/50 bg-[var(--brand-yellow)]/20 text-[var(--brand-yellow)]'
                              : 'border-[var(--brand-red)]/50 bg-[var(--brand-red)]/20 text-[var(--brand-red)]'
                        }`}
                      >
                        <span>{item.word}</span>
                        <button
                          type="button"
                          onClick={() => togglePriorityWord(item.word)}
                          className={`rounded p-0.5 transition-colors ${
                            item.isPriority ? 'text-[var(--brand-yellow)]' : 'text-muted-foreground hover:text-[var(--brand-yellow)]'
                          }`}
                          title="Prioritize this word in challenge random draw"
                          aria-label={`Toggle priority for ${item.word}`}
                        >
                          <Star size={11} fill={item.isPriority ? 'currentColor' : 'none'} />
                        </button>
                        <button type="button" onClick={() => removeWord(item.word)} className="hover:text-white transition-colors">
                          <X size={11} />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Add words to build the practice pool.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Starred words are more likely to appear in Challenge mode.
                </p>
              </div>

              {selectedVocabWords.length > 0 && selectedVocabWords.length < questionCount && (
                <p className="text-xs text-amber-600/90 dark:text-amber-400/90 text-center -mb-1">
                  {selectedVocabWords.length} / {questionCount} pool words — add {questionCount - selectedVocabWords.length}{' '}
                  more or reduce challenge length.
                </p>
              )}
              <Button
                type="button"
                onClick={generateQuestions}
                disabled={generating || !canGenerateQuiz}
                title={
                  !canGenerateQuiz && selectedVocabWords.length > 0
                    ? 'Pool size must be at least Challenge Length'
                    : undefined
                }
                className="w-full bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-bright)] text-white font-bold py-6 text-base gap-3 shadow-[0_0_24px_rgba(59,130,246,0.3)] disabled:opacity-50"
              >
                {generating ? (
                  <><Loader2 size={18} className="animate-spin" /> Generating Quiz...</>
                ) : (
                  <><Sparkles size={18} /> Build Pool ({selectedVocabWords.length} words)</>
                )}
              </Button>
            </>
          )}

          {/* Review step */}
          {step === 'review' && (
            <div className="flex flex-col gap-4">
              {/* Global controls */}
              <div className="rounded-xl border border-[var(--brand-blue)]/30 bg-[var(--brand-blue)]/5 p-4 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-foreground">Global Image Settings</h3>
                <p className="text-xs text-muted-foreground -mt-1">Apply to all questions. Click &quot;Customize&quot; on individual questions to override.</p>
                
                {/* Global Style */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Style</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STYLES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => applyGlobalStyle(s)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          globalStyle === s
                            ? 'bg-[var(--brand-blue)] text-white'
                            : 'bg-[var(--surface-3)] border border-[var(--border)] text-foreground hover:border-[var(--brand-blue)]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Global GIF toggle */}
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-muted-foreground">Type:</label>
                  <button
                    type="button"
                    onClick={() => applyGlobalMediaType('static')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      globalMediaType === 'static'
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'bg-[var(--surface-3)] border border-[var(--border)] text-foreground'
                    }`}
                  >
                    Static Picture
                  </button>
                  <button
                    type="button"
                    onClick={() => applyGlobalMediaType('gif')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      globalMediaType === 'gif'
                        ? 'bg-[var(--brand-blue)] text-white'
                        : 'bg-[var(--surface-3)] border border-[var(--border)] text-foreground'
                    }`}
                  >
                    GIF
                  </button>
                </div>
              </div>

              {/* Question cards */}
              {questions.map((q, i) => (
                <QuestionReviewCard
                  key={q.id}
                  question={q}
                  index={i}
                  total={questions.length}
                  onChange={(updated) => setQuestions(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onRemove={(id) => setQuestions(prev => prev.filter(x => x.id !== id))}
                  onMoveUp={() => moveQuestion(i, i - 1)}
                  onMoveDown={() => moveQuestion(i, i + 1)}
                  globalStyle={globalStyle}
                  globalMediaType={globalMediaType}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border)] px-6 py-4 gap-3">
          {step === 'review' && !editingQuiz && (
            <Button
              type="button"
              onClick={() => setStep('form')}
              variant="outline"
              className="border-[var(--border)] text-foreground hover:bg-[var(--surface-3)]"
            >
              Back
            </Button>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="border-[var(--border)] text-muted-foreground hover:bg-[var(--surface-3)]"
            >
              Cancel
            </Button>
            {step === 'review' && (
              <Button
                type="button"
                onClick={handleSave}
                className="bg-[var(--brand-green)] hover:bg-[var(--brand-green-bright)] text-[var(--surface-1)] font-bold gap-2 shadow-[0_0_16px_rgba(34,197,94,0.3)]"
              >
                <Save size={15} />
                Save Quiz
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
