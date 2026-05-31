import {
  applyCorrectionToText,
  getTokenBeforeCaret,
  tryRevertLastCorrection,
  type LastCorrection,
  type TokenBeforeCaret,
} from '@/lib/writing-assist/autocorrect'
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

export function handleTextareaSpaceAutocorrect(
  state: TextareaCaretState,
  suggest: (word: string) => CorrectionResult | null,
): { state: TextareaCaretState; last: LastCorrection | null } | null {
  if (state.selectionStart !== state.selectionEnd) return null
  const caret = state.selectionStart
  const token = getTokenBeforeCaret(state.value, caret)
  if (!token) return { state: { ...state, value: state.value + ' ', selectionStart: caret + 1, selectionEnd: caret + 1 }, last: null }
  const correction = suggest(token.token)
  if (!correction) {
    return {
      state: {
        value: state.value.slice(0, caret) + ' ' + state.value.slice(caret),
        selectionStart: caret + 1,
        selectionEnd: caret + 1,
      },
      last: null,
    }
  }
  const applied = applyCorrectionToText(state.value, token, correction, true)
  return {
    state: {
      value: applied.text,
      selectionStart: applied.caret,
      selectionEnd: applied.caret,
    },
    last: applied.last,
  }
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

/** Replace the word ending at the caret when the caret sits in a single text node. */
function replaceWordInTextNodeAtCaret(
  textNode: Text,
  caretOffset: number,
  newWord: string,
  insertSpace: boolean,
): { last: LastCorrection | null; newCaret: number } {
  const text = textNode.textContent ?? ''
  const token = getTokenBeforeCaret(text, caretOffset)
  if (!token) {
    const next = text.slice(0, caretOffset) + ' ' + text.slice(caretOffset)
    textNode.textContent = next
    return { last: null, newCaret: caretOffset + 1 }
  }
  const applied = applyCorrectionToText(text, token, { from: token.token, to: newWord }, insertSpace)
  textNode.textContent = applied.text
  return { last: applied.last, newCaret: applied.caret }
}

function setSelectionInTextNode(textNode: Text, offset: number): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.setStart(textNode, offset)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function handleContentEditableSpaceAutocorrect(
  root: HTMLElement,
  suggest: (word: string) => CorrectionResult | null,
): { last: LastCorrection | null } {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) {
    document.execCommand('insertText', false, ' ')
    return { last: null }
  }
  const range = sel.getRangeAt(0)
  if (!range.collapsed || !root.contains(range.startContainer)) {
    document.execCommand('insertText', false, ' ')
    return { last: null }
  }

  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) {
    document.execCommand('insertText', false, ' ')
    return { last: null }
  }

  const textNode = node as Text
  const caretOffset = range.startOffset
  const text = textNode.textContent ?? ''
  const token = getTokenBeforeCaret(text, caretOffset)
  if (!token) {
    const next = text.slice(0, caretOffset) + ' ' + text.slice(caretOffset)
    textNode.textContent = next
    setSelectionInTextNode(textNode, caretOffset + 1)
    return { last: null }
  }

  const correction = suggest(token.token)
  if (!correction) {
    const next = text.slice(0, caretOffset) + ' ' + text.slice(caretOffset)
    textNode.textContent = next
    setSelectionInTextNode(textNode, caretOffset + 1)
    return { last: null }
  }

  const { last, newCaret } = replaceWordInTextNodeAtCaret(
    textNode,
    caretOffset,
    correction.to,
    true,
  )
  setSelectionInTextNode(textNode, newCaret)
  return { last }
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
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return false

  const textNode = node as Text
  const text = textNode.textContent ?? ''
  const caret = range.startOffset
  const reverted = tryRevertLastCorrection(text, caret, last)
  if (!reverted?.reverted) return false
  textNode.textContent = reverted.text
  setSelectionInTextNode(textNode, reverted.caret)
  return true
}

export type { LastCorrection, TokenBeforeCaret }
