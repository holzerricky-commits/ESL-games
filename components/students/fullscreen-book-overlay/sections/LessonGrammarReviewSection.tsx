'use client'

import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Check, CircleAlert, Loader2, Pencil, Sparkles, Trash2 } from 'lucide-react'
import {
  grammarSentenceWords,
  grammarTargetRange,
  grammarTargetText,
  parseGrammarDistractors,
  toggleGrammarTargetWord,
  type LessonGrammarItem,
  type LessonGrammarItemPatch,
} from '@/lib/lesson-grammar/types'
import { cn } from '@/lib/utils'
import { VAULT_CARD_FRONT, VAULT_PART_PILL } from './lesson-vault-card-style'
import { REVIEW_HEADER_BTN, REVIEW_PRIMARY_BTN } from './lesson-vault-review-parts'

type LessonGrammarReviewSectionProps = {
  items: LessonGrammarItem[]
  rule: string
  /** Grammar notes from the lesson plan, offered as one-click rules. */
  hints: string[]
  onSetRule: (text: string) => void
  onUpdateItem: (itemId: string, patch: LessonGrammarItemPatch) => boolean
  onDeleteItem: (itemId: string) => boolean
  onGenerate: () => void
  generating: boolean
}

/** "Generate from this page": AI reads the open page(s) and drafts sentences for this lesson. */
export function GenerateGrammarButton({
  onGenerate,
  generating,
  primary = false,
}: {
  onGenerate: () => void
  generating: boolean
  primary?: boolean
}) {
  return (
    <button
      type="button"
      className={cn(primary ? REVIEW_PRIMARY_BTN : REVIEW_HEADER_BTN, 'disabled:cursor-wait disabled:opacity-60')}
      onClick={onGenerate}
      disabled={generating}
      title="AI reads the open page and drafts a grammar point with practice sentences"
    >
      {generating ? (
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <Sparkles className="h-4 w-4" aria-hidden />
      )}
      {generating ? 'Reading the page…' : 'Generate from this page'}
    </button>
  )
}

const FIELD =
  'w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-sky-400/60 focus:ring-1 focus:ring-sky-400/40 disabled:opacity-40'

const MARKED = 'bg-sky-400/25 text-sky-100'

/** Teacher view of the lesson's grammar: the rule plus saved example sentences. */
export function LessonGrammarReviewSection({
  items,
  rule,
  hints,
  onSetRule,
  onUpdateItem,
  onDeleteItem,
  onGenerate,
  generating,
}: LessonGrammarReviewSectionProps) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
      <GrammarRuleCard rule={rule} hints={hints} onSetRule={onSetRule} />
      <section className="flex min-w-0 flex-col gap-3" aria-label="Grammar sentences">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white/60">Sentences</h3>
          {items.length > 0 ? (
            <p className="text-sm text-white/40">
              Click a word to mark the form to practise. Click the word next to it to add it to the mark.
            </p>
          ) : null}
          {items.length > 0 ? (
            <div className="ml-auto">
              <GenerateGrammarButton onGenerate={onGenerate} generating={generating} />
            </div>
          ) : null}
        </div>
        {items.length === 0 ? (
          <div className={cn('flex flex-col items-center gap-3 rounded-2xl border px-6 py-12 text-center', VAULT_CARD_FRONT)}>
            <p className="text-lg font-medium text-white/75">No grammar sentences yet</p>
            <p className="max-w-lg text-sm text-white/50">
              Let AI read the open page and draft practice sentences, or in Select mode select the word to practise
              on the page (for example “went”) and choose Save to grammar.
            </p>
            <GenerateGrammarButton onGenerate={onGenerate} generating={generating} primary />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <GrammarItemCard item={item} onUpdate={onUpdateItem} onDelete={onDeleteItem} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function GrammarRuleCard({
  rule,
  hints,
  onSetRule,
}: {
  rule: string
  hints: string[]
  onSetRule: (text: string) => void
}) {
  const [draft, setDraft] = useState(rule)
  useEffect(() => setDraft(rule), [rule])
  const otherHints = hints.filter((hint) => hint !== rule.trim())

  const commit = (text: string) => {
    if (text.trim() !== rule.trim()) onSetRule(text)
  }

  return (
    <section className={cn('flex flex-col gap-3 rounded-2xl border p-4', VAULT_CARD_FRONT)} aria-label="Grammar point">
      <label htmlFor="lesson-grammar-rule" className="text-sm font-semibold uppercase tracking-wider text-white/60">
        Grammar point
      </label>
      <textarea
        id="lesson-grammar-rule"
        rows={3}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        placeholder="e.g. Past tense: add -ed (walk → walked). Some verbs change: go → went."
        className={cn(FIELD, 'resize-y text-base leading-relaxed')}
      />
      {otherHints.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-white/45">From the lesson plan — click to use</p>
          <ul className="flex flex-wrap gap-1.5">
            {otherHints.map((hint) => (
              <li key={hint}>
                <button
                  type="button"
                  className="cursor-pointer rounded-full bg-white/[0.08] px-3 py-1 text-left text-sm text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={() => {
                    setDraft(hint)
                    commit(hint)
                  }}
                >
                  {hint}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function GrammarItemCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: LessonGrammarItem
  onUpdate: (itemId: string, patch: LessonGrammarItemPatch) => boolean
  onDelete: (itemId: string) => boolean
}) {
  const target = grammarTargetText(item)
  const [editing, setEditing] = useState(false)
  const [sentenceDraft, setSentenceDraft] = useState(item.sentence)
  const savedDistractors = item.distractors.join(', ')
  const [distractorDraft, setDistractorDraft] = useState(savedDistractors)
  useEffect(() => setDistractorDraft(savedDistractors), [savedDistractors])

  const commitDistractors = () => {
    const next = parseGrammarDistractors(distractorDraft, target)
    if (next.join(', ') === savedDistractors) {
      setDistractorDraft(savedDistractors)
      return
    }
    onUpdate(item.id, { distractors: next })
  }

  const saveSentence = () => {
    if (sentenceDraft.trim() && sentenceDraft.trim() !== item.sentence) onUpdate(item.id, { sentence: sentenceDraft })
    setEditing(false)
  }

  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl border p-4', VAULT_CARD_FRONT)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          {editing ? (
            <textarea
              autoFocus
              rows={2}
              value={sentenceDraft}
              onChange={(e) => setSentenceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  saveSentence()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setSentenceDraft(item.sentence)
                  setEditing(false)
                }
              }}
              className={cn(FIELD, 'resize-y text-lg leading-relaxed')}
              aria-label="Sentence"
            />
          ) : (
            <MarkableSentence item={item} onMark={(range) => onUpdate(item.id, { target: range })} />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {editing ? (
            <>
              <button type="button" className={REVIEW_HEADER_BTN} onClick={saveSentence}>
                Save
              </button>
              <button
                type="button"
                className={REVIEW_HEADER_BTN}
                onClick={() => {
                  setSentenceDraft(item.sentence)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={REVIEW_HEADER_BTN}
                onClick={() => {
                  setSentenceDraft(item.sentence)
                  setEditing(true)
                }}
                aria-label="Edit sentence"
                title="Edit sentence"
              >
                <Pencil className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(REVIEW_HEADER_BTN, 'hover:text-rose-200')}
                onClick={() => onDelete(item.id)}
                aria-label="Delete sentence"
                title="Delete sentence"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-[16rem] flex-1 items-center gap-2 text-sm text-white/55">
          <span className="shrink-0">Wrong options</span>
          <input
            type="text"
            value={distractorDraft}
            disabled={!target}
            onChange={(e) => setDistractorDraft(e.target.value)}
            onBlur={commitDistractors}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                e.currentTarget.blur()
              }
            }}
            placeholder={target ? `Other forms instead of “${target}”, separated by commas` : 'Mark a word first'}
            className={FIELD}
          />
        </label>
        <div className="flex items-center gap-2 text-xs">
          <GrammarItemStatus hasTarget={target !== ''} hasDistractors={item.distractors.length > 0} />
          {item.source === 'ai' ? (
            <span
              className="flex items-center gap-1 rounded-full bg-violet-400/15 px-2 py-0.5 font-semibold text-violet-200/90"
              title="Drafted by AI — check it, then edit, mark or delete. Any edit removes this badge."
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              AI
            </span>
          ) : null}
          {item.partTitle ? <span className={VAULT_PART_PILL}>{item.partTitle}</span> : null}
          {item.pdfPage > 0 ? <span className="tabular-nums text-white/40">p. {item.pdfPage}</span> : null}
        </div>
      </div>
    </article>
  )
}

function GrammarItemStatus({ hasTarget, hasDistractors }: { hasTarget: boolean; hasDistractors: boolean }) {
  if (hasTarget && hasDistractors) {
    return (
      <span className="flex items-center gap-1 font-medium text-emerald-300/85">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Ready
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 font-medium text-amber-200/80">
      <CircleAlert className="h-3.5 w-3.5" aria-hidden />
      {hasTarget ? 'Add wrong options' : 'Mark the word to practise'}
    </span>
  )
}

/** Sentence as clickable words; the marked range is highlighted. */
function MarkableSentence({
  item,
  onMark,
}: {
  item: LessonGrammarItem
  onMark: (range: { start: number; end: number } | null) => void
}) {
  const { sentence } = item
  const range = grammarTargetRange(item)
  const words = grammarSentenceWords(sentence)
  const inRange = (start: number, end: number) => range != null && start >= range.start && end <= range.end

  const parts: ReactNode[] = []
  let cursor = 0
  words.forEach((word, index) => {
    if (word.start > cursor) {
      const gap = sentence.slice(cursor, word.start)
      parts.push(
        <span key={`gap-${cursor}`} className={cn(inRange(cursor, word.start) && MARKED)}>
          {gap}
        </span>,
      )
    }
    const marked = inRange(word.start, word.end)
    parts.push(
      <button
        key={`word-${word.start}`}
        type="button"
        aria-pressed={marked}
        onClick={() => onMark(toggleGrammarTargetWord(sentence, range, index))}
        className={cn(
          'cursor-pointer rounded-sm transition-colors duration-100 motion-reduce:transition-none',
          marked ? cn(MARKED, 'font-semibold') : 'hover:bg-white/10',
        )}
      >
        {word.text}
      </button>,
    )
    cursor = word.end
  })
  if (cursor < sentence.length) parts.push(<Fragment key="tail">{sentence.slice(cursor)}</Fragment>)

  return <p className="text-xl leading-relaxed text-white/90">{parts}</p>
}
