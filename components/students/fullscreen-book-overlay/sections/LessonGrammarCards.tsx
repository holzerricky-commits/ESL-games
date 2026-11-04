'use client'

import { Check, Puzzle, X } from 'lucide-react'
import { grammarTargetRange, grammarTargetText, type LessonGrammarItem } from '@/lib/lesson-grammar/types'
import { cn } from '@/lib/utils'
import { VAULT_CARD_BACK, VAULT_CARD_FRONT, VAULT_CARD_HOVER, VAULT_PART_PILL } from './lesson-vault-card-style'

export const GRAMMAR_RULE_CARD_ID = '__grammar-rule'

export type GrammarReviewCard =
  | { id: string; kind: 'rule'; text: string }
  | { id: string; kind: 'item'; item: LessonGrammarItem }

const GRAMMAR_RULE_CARD =
  'border-amber-300/25 bg-gradient-to-br from-amber-400/[0.16] via-[#2e2b27] to-orange-500/[0.08] shadow-[0_8px_22px_rgba(0,0,0,0.38)]'

/** Rule card first (when there is a rule), then one card per sentence. */
export function buildGrammarReviewCards(rule: string, items: readonly LessonGrammarItem[]): GrammarReviewCard[] {
  const text = rule.trim()
  const ruleCard: GrammarReviewCard[] = text ? [{ id: GRAMMAR_RULE_CARD_ID, kind: 'rule', text }] : []
  return [...ruleCard, ...items.map((item): GrammarReviewCard => ({ id: item.id, kind: 'item', item }))]
}

/** The sentence with its marked form highlighted. */
export function GrammarSentence({ item, className }: { item: LessonGrammarItem; className?: string }) {
  const range = grammarTargetRange(item)
  if (!range) return <p className={className}>{item.sentence}</p>
  return (
    <p className={className}>
      {item.sentence.slice(0, range.start)}
      <mark className="rounded bg-sky-400/25 px-1 font-semibold text-sky-100">
        {item.sentence.slice(range.start, range.end)}
      </mark>
      {item.sentence.slice(range.end)}
    </p>
  )
}

function RuleLabel() {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-200/80">
      <Puzzle className="h-3.5 w-3.5" aria-hidden />
      Grammar point
    </p>
  )
}

export function GrammarCardGrid({
  cards,
  onOpen,
}: {
  cards: readonly GrammarReviewCard[]
  onOpen: (cardId: string) => void
}) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(18rem,1fr))] gap-4">
      {cards.map((card, i) => (
        <li
          key={card.id}
          className={cn(
            'animate-in fade-in zoom-in-95 fill-mode-backwards duration-500 motion-reduce:animate-none',
            card.kind === 'rule' && 'col-span-full',
          )}
          style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
        >
          <button
            type="button"
            className={cn(
              'relative flex h-full w-full cursor-pointer flex-col gap-3 rounded-2xl border p-5 text-left',
              card.kind === 'rule' ? GRAMMAR_RULE_CARD : VAULT_CARD_FRONT,
              VAULT_CARD_HOVER,
            )}
            onClick={() => onOpen(card.id)}
          >
            {card.kind === 'rule' ? (
              <>
                <RuleLabel />
                <p className="whitespace-pre-line text-2xl font-semibold leading-snug">{card.text}</p>
              </>
            ) : (
              <>
                {card.item.partTitle ? <span className={cn('self-start', VAULT_PART_PILL)}>{card.item.partTitle}</span> : null}
                <GrammarSentence item={card.item} className="text-xl leading-relaxed text-white/90" />
              </>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One big card in the deck. Sentence cards turn over to the rule and the right / wrong forms. */
export function GrammarDeckCard({
  card,
  rule,
  flipped,
  onFlip,
}: {
  card: GrammarReviewCard
  rule: string
  flipped: boolean
  onFlip: () => void
}) {
  if (card.kind === 'rule') {
    return (
      <div
        className={cn(
          'flex w-[min(44rem,100%)] flex-col justify-center gap-5 rounded-3xl border p-10 animate-in fade-in slide-in-from-right-8 duration-300 motion-reduce:animate-none',
          GRAMMAR_RULE_CARD,
        )}
        aria-label={`Grammar point: ${card.text}`}
      >
        <RuleLabel />
        <p className="whitespace-pre-line text-4xl font-bold leading-snug tracking-tight">{card.text}</p>
      </div>
    )
  }

  const { item } = card
  const target = grammarTargetText(item)
  const ruleText = rule.trim()
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? `${item.sentence} — showing the grammar` : `${/[.!?]$/.test(item.sentence) ? item.sentence : `${item.sentence}.`} Space to turn over.`}
      className="w-[min(44rem,100%)] cursor-pointer outline-none [perspective:1600px] animate-in fade-in slide-in-from-right-8 duration-300 motion-reduce:animate-none"
      onClick={onFlip}
    >
      <div
        className={cn(
          'grid transition-transform duration-500 ease-out [transform-style:preserve-3d] motion-reduce:transition-none',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        <div
          className={cn(
            'relative flex min-h-[16rem] flex-col justify-center gap-4 rounded-3xl border p-10 [grid-area:1/1] [backface-visibility:hidden]',
            VAULT_CARD_FRONT,
          )}
          aria-hidden={flipped}
        >
          {item.partTitle ? <span className={cn('absolute right-6 top-6', VAULT_PART_PILL)}>{item.partTitle}</span> : null}
          <GrammarSentence item={item} className="text-center text-4xl font-semibold leading-snug" />
        </div>
        <div
          className={cn(
            'flex min-h-[16rem] flex-col justify-center gap-5 rounded-3xl border p-10 [grid-area:1/1] [backface-visibility:hidden] [transform:rotateY(180deg)]',
            VAULT_CARD_BACK,
          )}
          aria-hidden={!flipped}
        >
          {ruleText ? (
            <div className="flex flex-col gap-2">
              <RuleLabel />
              <p className="whitespace-pre-line text-2xl leading-relaxed">{ruleText}</p>
            </div>
          ) : null}
          {target ? (
            <ul className="flex flex-wrap items-center gap-2" aria-label="Forms">
              <li className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-4 py-1.5 text-2xl font-semibold text-emerald-100">
                <Check className="h-5 w-5" aria-hidden />
                {target}
              </li>
              {item.distractors.map((wrong) => (
                <li
                  key={wrong}
                  className="flex items-center gap-1.5 rounded-full bg-rose-500/15 px-4 py-1.5 text-2xl text-rose-200/75 line-through"
                >
                  <X className="h-5 w-5" aria-hidden />
                  {wrong}
                </li>
              ))}
            </ul>
          ) : null}
          {!ruleText && !target ? (
            <p className="text-lg italic text-white/45">No grammar point yet. Add one under Edit.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
