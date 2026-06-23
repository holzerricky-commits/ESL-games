import {
  tryRevertLastCorrection,
  type LastCorrection,
  type TokenBeforeCaret,
  type WritingAssistTriggerChar,
} from '@/lib/writing-assist/autocorrect'
import { runTriggerAutocorrect } from '@/lib/writing-assist/trigger-pipeline'
import type { CorrectionResult } from '@/lib/writing-assist/spell-engine'

export type TextareaCaretState = {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function getTextareaCaretState(el: HTMLTextAreaElement): TextareaCaretState {
  return {
    value: el.value,
    selectionStart: el.selectionStart,
    selectionEnd: el.selectionEnd,
  }
}

export function setTextareaValueAndCaret(
  el: HTMLTextAreaElement,
  value: string,
  caret: number,
): void {
  el.value = value
  el.setSelectionRange(caret, caret)
}

export function getContentEditablePlainText(root: HTMLElement): string {
  return root.innerText.replace(/\r\n/g, '\n')
}

/** Approximate caret offset in plain text for contentEditable. */
export function getContentEditableCaretOffset(root: HTMLElement): number {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return 0
  const range = sel.getRangeAt(0)
  if (!root.contains(range.startContainer)) return 0
  const pre = range.cloneRange()
  pre.selectNodeContents(root)
  pre.setEnd(range.startContainer, range.startOffset)
  return pre.toString().length
}

export function setContentEditableCaretOffset(root: HTMLElement, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let remaining = offset
  let node: Node | null = walker.nextNode()
  while (node) {
    const len = node.textContent?.length ?? 0
    if (remaining <= len) {
      const range = document.createRange()
      range.setStart(node, remaining)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      return
    }
    remaining -= len
    node = walker.nextNode()
  }
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function replaceContentEditableRange(
  root: HTMLElement,
  start: number,
  end: number,
  insert: string,
): number {
  const full = getContentEditablePlainText(root)
  const next = full.slice(0, start) + insert + full.slice(end)
  root.innerText = next
  const caret = start + insert.length
  setContentEditableCaretOffset(root, caret)
  return caret
}

export function handleTextareaTriggerAutocorrect(
  state: TextareaCaretState,
  suggest: (word: string) => CorrectionResult | null,
  trigger: WritingAssistTriggerChar,
): { state: TextareaCaretState; last: LastCorrection | null } | null {
  if (state.selectionStart !== state.selectionEnd) return null
  const caret = state.selectionStart
  const result = runTriggerAutocorrect(state.value, caret, trigger, suggest)
  return {
    state: {
      value: result.text,
      selectionStart: result.caret,
      selectionEnd: result.caret,
    },
    last: result.last,
  }
}

/** @deprecated Use {@link handleTextareaTriggerAutocorrect} with trigger `' '`. */
export function handleTextareaSpaceAutocorrect(
  state: TextareaCaretState,
  suggest: (word: string) => CorrectionResult | null,
): { state: TextareaCaretState; last: LastCorrection | null } | null {
  return handleTextareaTriggerAutocorrect(state, suggest, ' ')
}

export function handleTextareaBackspaceUndo(
  state: TextareaCaretState,
  last: LastCorrection | null,
): { state: TextareaCaretState; last: LastCorrection | null } | null {
  if (state.selectionStart !== state.selectionEnd) return null
  const reverted = tryRevertLastCorrection(state.value, state.selectionStart, last)
  if (!reverted) return null
  return {
    state: {
      value: reverted.text,
      selectionStart: reverted.caret,
      selectionEnd: reverted.caret,
    },
    last: null,
  }
}

export function handleContentEditableTriggerAutocorrect(
  root: HTMLElement,
  suggest: (word: string) => CorrectionResult | null,
  trigger: WritingAssistTriggerChar,
): { last: LastCorrection | null } {
  const fullText = getContentEditablePlainText(root)
  const caret = getContentEditableCaretOffset(root)
  const result = runTriggerAutocorrect(fullText, caret, trigger, suggest)
  root.innerText = result.text
  setContentEditableCaretOffset(root, result.caret)
  return { last: result.last }
}

/** @deprecated Use {@link handleContentEditableTriggerAutocorrect} with trigger `' '`. */
export function handleContentEditableSpaceAutocorrect(
  root: HTMLElement,
  suggest: (word: string) => CorrectionResult | null,
): { last: LastCorrection | null } {
  return handleContentEditableTriggerAutocorrect(root, suggest, ' ')
}

export function handleContentEditableBackspaceUndo(
  root: HTMLElement,
  last: LastCorrection | null,
): boolean {
  if (!last) return false
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return false
  const range = sel.getRangeAt(0)
  if (!range.collapsed || !root.contains(range.startContainer)) return false

  const fullText = getContentEditablePlainText(root)
  const caret = getContentEditableCaretOffset(root)
  const reverted = tryRevertLastCorrection(fullText, caret, last)
  if (!reverted?.reverted) return false

  root.innerText = reverted.text
  setContentEditableCaretOffset(root, reverted.caret)
  return true
}

export type { LastCorrection, TokenBeforeCaret }
