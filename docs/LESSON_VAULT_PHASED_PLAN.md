# Lesson vault — phased implementation plan

Last updated: 2026-10-07

**Product source of truth:** `LESSON_VAULT_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next.

```text
0 docs → 1 save + reopen → 2 flip card → 3 picture → 4 drag into vault
```

---

## Phase 0 — Documentation ✅

- [x] `LESSON_VAULT_PRODUCT.md`
- [x] `LESSON_VAULT_PHASED_PLAN.md`
- [x] Cross-links in `MILESTONE.md`, `PROJECT_CONTEXT.md`

---

## Phase 1 — Save the word into this lesson

**Goal:** While the book is open with a student, you select a word and it stays in that lesson’s vault.

### Tasks

- [x] Per-student vault store on disk (`data/students/lesson-vault.json`), included in backup/restore.
- [x] Select mode: click or drag on page text → **Save to vault** beside the highlight.
- [x] Card stores word, sentence from the page (or empty), lesson, part label, page.
- [x] Same word in the same lesson updates the sentence (no duplicate card).
- [x] Vault control on the book left rail with count for the page’s lesson.
- [x] Vault panel: lesson title, previous / next lesson, cards, **Show this page’s lesson** when different.
- [x] No student session → toast, nothing saved.

### Acceptance (you test)

- [ ] With a student session, Select mode, on a searchable story page: save three words; reopen the vault; each card has word + sentence + part label.
- [ ] Panel open, turn pages inside the lesson: cards stay.
- [ ] Go one lesson back with the panel closed: count matches that lesson; open it → those cards, not today’s.
- [ ] Save on today’s page while viewing another lesson’s vault: panel switches to today and the new card is there.

### Non-goals

- Flip, pictures, drag, fly-in animation.

---

## Phase 2 — Flip the card

**Goal:** The vault is the end-of-lesson review.

- Front: word, large on screen share. Click → back: one sentence (optional short meaning). Click again → front. Others stay on the front.
- Type or fix the sentence on the back.

**You test:** Flip one card, fix a bad sentence, flip back; others never turn.

---

## Phase 3 — Put a picture on the card

- Empty picture → opens picture search for that word; picked picture stays on the card.
- A picture already chosen while explaining the word is taken on save.

**You test:** One card saved with a picture, one without; add a picture from the vault; flip still shows the sentence.

---

## Phase 4 — Drag the word into the vault

- Vault control stays visible with a count. Drag the selected word onto it → same save as the button, with a visible move into the vault.
- A drag that only highlights text and is released on the page does not save.

**You test:** Drag “seastar” onto the vault and see it land; release on the page → nothing saved; button still works.
