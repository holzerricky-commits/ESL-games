'use client'



import { useState, type CSSProperties } from 'react'

import type { TextGlossAnchor } from '@/lib/books/annotation-command-types'

import { buildGlossTextSegments, pruneInvalidTextGlosses } from '@/lib/books/text-gloss'

import {

  resolveTextGlossChrome,

  TEXT_GLOSS_PAGE_SURFACE,

  type TextGlossChrome,

} from '@/lib/books/text-gloss-chrome'

import { useWritableTextGlossReview } from '@/components/students/fullscreen-book-overlay/writable-text-gloss-review-context'

import { cn } from '@/lib/utils'



const GLOSS_BUTTON = cn(
  'pointer-events-auto absolute left-1/2 bottom-full z-[2]',
  'inline-flex w-max max-w-none flex-row flex-nowrap items-center',
  'whitespace-nowrap overflow-visible leading-snug font-medium',
  'cursor-pointer rounded-sm px-0.5',
)



function GlossChipButton({

  gloss,

  annotationId,

  glossFontSizePx,

  glossChrome,

  className,

}: {

  gloss: TextGlossAnchor

  annotationId: string

  glossFontSizePx: number

  glossChrome: TextGlossChrome

  className?: string

}) {

  const openGlossReview = useWritableTextGlossReview()

  const [hovered, setHovered] = useState(false)



  return (

    <button

      type="button"

      style={{

        fontSize: glossFontSizePx,

        lineHeight: 1.2,

        width: 'max-content',

        maxWidth: 'none',

        whiteSpace: 'nowrap',

        writingMode: 'horizontal-tb',

        transform: 'translate(-50%, 42%)',

        backgroundColor: hovered ? glossChrome.hoverBackgroundColor : glossChrome.backgroundColor,

        color: glossChrome.color,

        boxShadow: glossChrome.boxShadow,

      }}

      className={cn(GLOSS_BUTTON, className)}

      data-text-gloss-id={gloss.id}

      aria-label={`${gloss.chinese}${gloss.pinyin ? `, ${gloss.pinyin}` : ''}. Tap to open translation.`}

      onPointerDown={(event) => event.stopPropagation()}

      onMouseEnter={() => setHovered(true)}

      onMouseLeave={() => setHovered(false)}

      onClick={(event) => {

        event.stopPropagation()

        const rect = event.currentTarget.getBoundingClientRect()

        openGlossReview?.({

          annotationId,

          start: gloss.start,

          end: gloss.end,

          source: gloss.source,

          chinese: gloss.chinese,

          pinyin: gloss.pinyin,

          anchorRect: rect,

        })

      }}

    >

      {gloss.chinese}

    </button>

  )

}



export function TextGlossSpans({

  text,

  glosses,

  annotationId,

  glossFontSizePx = 11,

  glossChrome = resolveTextGlossChrome(TEXT_GLOSS_PAGE_SURFACE),

  className,

}: {

  text: string

  glosses?: readonly TextGlossAnchor[]

  annotationId: string

  /** Pixel size for the Chinese gloss (smaller than the label body). */

  glossFontSizePx?: number

  glossChrome?: TextGlossChrome

  className?: string

}) {

  const segments = buildGlossTextSegments(text, glosses)

  if (segments.length === 1 && !segments[0]?.gloss) {

    return <>{text}</>

  }



  return (

    <>

      {segments.map((segment, index) => {

        if (!segment.gloss) {

          return <span key={`plain-${index}`}>{segment.text}</span>

        }

        const gloss = segment.gloss

        return (

          <span

            key={`gloss-${gloss.id}-${index}`}

            className="relative inline-block overflow-visible align-baseline"

          >

            <span>{segment.text}</span>

            <GlossChipButton

              gloss={gloss}

              annotationId={annotationId}

              glossFontSizePx={glossFontSizePx}

              glossChrome={glossChrome}

              className={className}

            />

          </span>

        )

      })}

    </>

  )

}



/** Invisible typography mirror while editing — only gloss chips stay visible. */

export function TextGlossEditOverlay({

  text,

  glosses,

  annotationId,

  glossFontSizePx = 11,

  glossChrome = resolveTextGlossChrome(TEXT_GLOSS_PAGE_SURFACE),

  inkStyle,

  block = false,

}: {

  text: string

  glosses?: readonly TextGlossAnchor[]

  annotationId: string

  glossFontSizePx?: number

  glossChrome?: TextGlossChrome

  inkStyle: CSSProperties

  block?: boolean

}) {

  const validGlosses = glosses?.length ? pruneInvalidTextGlosses(text, glosses) : []

  if (!validGlosses.length) return null



  return (

    <div

      className="pointer-events-none absolute left-0 top-0 z-[2] overflow-visible text-transparent"

      aria-hidden

    >

      <span

        style={{

          ...inkStyle,

          overflow: 'visible',

          overflowX: 'visible',

          overflowY: 'visible',

          display: block ? 'block' : undefined,

        }}

        className="overflow-visible"

      >

        <TextGlossSpans

          text={text}

          glosses={validGlosses}

          annotationId={annotationId}

          glossFontSizePx={glossFontSizePx}

          glossChrome={glossChrome}

        />

      </span>

    </div>

  )

}


