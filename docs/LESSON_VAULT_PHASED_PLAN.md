# Lesson vault — phased implementation plan

Last updated: 2026-10-07

**Product source of truth:** `LESSON_VAULT_PRODUCT.md`

**How to use this doc:** Implement **one phase at a time**. After each phase, **you test** in the app, fix issues, then start the next.

```text
0 docs → 1 save + reopen → 2 flip card → 3 picture → 3c own picture → 3b review mode + card design → 4 drag into vault → 5 games
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

### Tasks

- [x] Front: word, large on screen share (part label in the corner).
- [x] Click (or Enter / Space) → card turns; back shows the sentence and optional short meaning. Click again → front. Only that card turns.
- [x] Pencil on the back → edit sentence + short meaning; Save / Cancel (Ctrl+Enter saves, Esc cancels). Editing never flips the card.
- [x] Closing the vault turns every card back to the front.

### Acceptance (you test)

- [ ] Flip one card, fix a bad sentence, add a short meaning, flip back; the other cards never turn.
- [ ] Close and reopen the vault: all cards show the word again; the edited sentence is kept.

### Non-goals

- Pictures, drag.

---

## Phase 3 — Put a picture on the card

**Goal:** The front shows the picture with the word.

### Tasks

- [x] Card stores a picture link (saved with the card, in backup/restore).
- [x] Front: picture on top, word below. No picture → **Add picture** box; with a picture → small change button on hover. Neither turns the card.
- [x] **Add picture** opens picture search with the word typed in; **Use for card** puts the picture on that card and goes back to the vault on the same lesson. Closing the search also goes back to the vault.
- [x] A picture placed on the book or board while explaining the word (this book session) is put on the card when the word is saved. A card that already has a picture keeps it.
- [x] A picture that no longer loads shows **Picture unavailable — pick another**.

### Acceptance (you test)

- [ ] Search “seastar” in Pictures and place one on the book; then save “seastar” from the page → the card has that picture.
- [ ] Save a word with no picture; **Add picture** in the vault → pick one → back in the vault on the same lesson, picture on the front.
- [ ] Change a picture; flip that card → sentence and meaning still on the back.

### Non-goals

- Card look and motion (next phase), drag.

---

## Phase 3c — Your own picture

**Goal:** Paste a picture or cut one out of the book page for a card.

### Tasks

- [x] Card picture area offers **Search**, **Paste**, **Cut from page** (empty box, or a bar on hover over a picture). None of them turns the card.
- [x] **Paste** button reads the clipboard; Ctrl+V while pointing at (or focused on) a card pastes there; an image file dropped on the picture area works too. Over the vault, Ctrl+V goes to the vault, not the book.
- [x] **Cut from page:** draw a box on the book → **Use for card** puts that part of the page on the card. Esc cancels. Book shortcuts pause while cutting. The vault stays open.
- [x] Every card picture is one file: `student-work/<studentId>/vault/<cardId>.<ext>`. Changing a picture overwrites it. Search picks (and pictures taken on save) are downloaded into that file; if the download fails, the web link is kept.
- [x] “Saving picture…” shows on the card while it uploads.

**Picture backup:** Settings → **Download JSON** includes every vault picture still used by a card (key `esl_lesson_vault_pictures_v1`, data URLs per student and card). **Restore** writes them back to `student-work/<id>/vault/`, so restored cards keep their pictures. Other `student-work/` files (exports, homework) are still not in the backup.

- [ ] Give two cards pictures → Download JSON → delete those files (or restore on another machine) → Restore → the pictures are back after the reload. An old backup without the key still restores.

### Acceptance (you test)

- [ ] Win+Shift+S a picture, point at a card in the vault, press Ctrl+V → the picture appears and is still there after reloading the app.
- [ ] **Cut from page** on a card, drag around a drawing in the book → the cut-out is on the card, with no select highlight or Save to vault pill in it.
- [ ] Pick a search picture with **Use for card** → a file appears in `student-work/<id>/vault/`; the card still shows the picture offline.
- [ ] Change a picture twice → only one file for that card.

### Non-goals

- Card look and motion (3b), drag (4).

---

## Phase 3b — Review mode and card design

**Goal:** End-of-lesson review is its own place, and cards feel like a flashcard game.

### Tasks

- [x] **Review** mode shortcut after **Notebook** in the class source strip (not a book/source tab), with the word count (students only). **Review N words** in the vault panel opens it too (and closes the panel).
- [x] Review shows the lesson the vault panel was on, else the page’s lesson; previous / next lesson arrows inside Review.
- [x] Hides the book and the page bar. Picking a book tab, the Notebook control, the Review shortcut again, **Back to book** or Esc returns to the same page.
- [x] All cards in a big grid (fills the width) → **Start** or click a card → one big card at a time: Space / click turns it (sentence with the word highlighted), ← → move, progress dots, **Shuffle**. Last card → “N words reviewed!” with confetti, **Again**, **Shuffle**, **All cards**.
- [x] No edit or picture buttons in Review — the side panel stays the place to manage cards.
- [x] Shared card look (depth, gradient front, blue back, part pill) in the panel and Review; cards lift on hover.
- [x] Motion: a newly saved card pops into the open panel; the rail count bumps when it changes. All motion is off with reduced motion.
- [x] Side panel shows **compact rows** (small picture, word, part, hints for no picture / no sentence), newest first. Click a row → it opens in place into the full card (picture with Search / Paste / Cut, sentence + meaning, pencil); one open at a time. The flip lives in Review only.
- [x] Opened card: **Delete** (Undo in the message for a few seconds; the picture file is removed after that), pencil also fixes the **word’s spelling**, **Move to** another lesson of the unit (refused when that lesson already has the word).

### Acceptance (you test)

- [ ] Click **Review** in the strip → the book is hidden, the lesson’s cards fill the screen; **Back to book** → same page.
- [ ] **Start**, go through every card with Space and →; the last one shows the celebration; **Shuffle** gives a new order.
- [ ] Open the vault on an earlier lesson → **Review N words** → Review shows that lesson.
- [ ] Save a word with the vault open → the new card pops in; the rail count bumps.
- [ ] Save 10 words → all rows show without scrolling on a normal laptop screen; the newest is on top.
- [ ] Open a row, delete it, press **Undo** → it is back. Delete again and wait → gone after reload.
- [ ] Fix a word’s spelling with the pencil; move a card to another lesson → it shows there and not here.

**Not in this phase:** games and scoring.

---

## Phase 3d — Automatic pictures ✅

**Goal:** Saving a word gives it a fitting cartoon picture without searching by hand.

### Tasks

- [x] Card fields: picture source (auto / search / own), up to 5 picture choices, auto result (found / not found / hard to picture). Old cards with a picture count as search.
- [x] Save → background queue (2 at a time): reuse this student’s picture for the same word → one server request (`/api/lesson-vault/auto-picture`): the model reads the sentence and gives a keyword (e.g. “ran” → run, river “bank” → riverbank) → **ARASAAC** learner pictograms → **Fluent Emoji** icons → short **Pixabay** cartoon searches → the server downloads the first that works into the vault file. One `[vault auto-picture]` line per word in the dev terminal.
- [x] Credit line in the panel (ARASAAC is CC BY-NC-SA — non-commercial use).
- [x] Saving a blank word again searches again.
- [x] Auto never replaces a picture that was added by hand meanwhile; deleting the card drops the job.
- [x] Panel: rows pulse while finding; the no-picture hint says why. **Find pictures (N)** fills older blank cards.
- [x] Opened card: strip of other pictures (one click swaps); blank cards show the reason and **Try again** (searches the plain word, also for hard-to-picture words).
- [x] No picture-search key → one message, cards stay blank.

### Acceptance (you test)

- [ ] Save “apple” → the row pulses, then shows a cartoon apple within a few seconds.
- [ ] Save “bank” from a river sentence → the picture fits the river, not money.
- [ ] Save “however” → no search; the row says it is hard to picture; **Try again** searches anyway.
- [ ] Open a card with a picture → click another picture in the strip → it swaps.
- [ ] Paste your own picture while the search runs → yours stays.
- [ ] Save the same word in another lesson → it gets the same picture right away.
- [ ] Older blank cards → **Find pictures (N)** → they fill in.

---

## Phase 4 — Drag the word into the vault ✅

- Vault control stays visible with a count. Drag the selected word onto it → same save as the button, with a visible move into the vault.
- A drag that only highlights text and is released on the page does not save.

### Tasks

1. Shared drag state + drop targets + fly-in signal (`lib/lesson-vault/vault-drag.ts`).
2. Select mode: press on the highlighted word (or the Save pill) and move 6 px → you are dragging the word. Release over the vault rail button or the open vault panel → saves; release anywhere else → nothing saved, selection kept. Esc cancels.
3. A chip with the word follows the pointer; it turns blue with “Drop to save” over the vault.
4. After any save from the page (drop or pill click) the word flies into the rail vault button. Off with reduced motion.
5. Rail vault button and vault panel glow while dragging, stronger when the word is over them.

### Acceptance (you test)

- Select “seastar”, drag it onto the vault rail button → chip turns blue, release → word flies in, count bumps, toast.
- Same drag onto the open vault panel → saved, new row pops in.
- Drag and release on the page → nothing saved; the word stays selected.
- Esc mid-drag → chip disappears, nothing saved.
- Click **Save to vault** → still saves, word flies from the pill to the rail.
- Drag-selecting new text (pressing outside the highlight) still selects as before.

### Non-goals

- Dragging words from outside the book (web pages, notebook).
- Dropping onto a specific lesson other than the page’s lesson.

---

## Phase 5 — Games in Review mode

**Goal:** Practise the lesson’s words interactively. Review mode gets **Cards | Games**.

- Built only from what cards store (word, picture, sentence, meaning). A game the cards can’t support is greyed out with the reason (e.g. “Add meanings to 3 cards”).
- Order: **Picture → word** (pick from 3–4) and **Fill the gap** (card sentence with the word blanked) first; then **Memory pairs**, **Spell it** (shuffled letters + picture), **Word ↔ meaning**.
- Teacher clicks on a shared screen (student answers out loud). Light fun: stars, a short celebration, a “practise again” pile at the end.

**Not in this phase:** long-term progress per word, student-side controls.

### Phase 5a — first two games ✅

- [x] Review header: **Cards | Games** switch. Cards works as before.
- [x] Games picker: **Picture → word** and **Fill the gap** tiles with the number of questions. A game needs 3 different words that fit it; otherwise the tile is greyed out with the reason (“Add pictures to 2 more cards”, “Add a sentence with the word to 1 more card”, “Save 2 more words to play”).
- [x] One question at a time, up to 4 word answers (wrong answers come from the lesson’s other words). Click or press 1–4. Wrong → red shake, try again; right → green pop, next question after a moment (or Next / Enter).
- [x] A star for each right-on-the-first-try answer. End: stars out of total, confetti, **Practise again** pile of missed words → **Practise these N**, **Play again**, **Other games**.
- [x] Esc in a game → games picker; Esc in the picker → book. ← → never turn the hidden book.
- [x] Fill the gap blanks the word (and endings like -s, -ed) in the card sentence; shown in green once answered.
- [x] Every game has a cover (`public/lesson-vault/games/<kind>.jpg`, one flat illustrated style): on its tile, as a small chip while playing, and on the finish screen. Phase 5b games show as **Coming soon** tiles until they are built.

### Acceptance (you test)

- [ ] Lesson with 4+ pictured cards → Games → Picture → word → answer all; a wrong answer shakes and the word goes to Practise again; finish shows stars and confetti.
- [ ] **Practise these** plays only the missed words.
- [ ] Fill the gap shows the sentence with a blank; the right answer fills it in.
- [ ] Lesson with fewer than 3 pictures → Picture → word is greyed out with the reason.

### Phase 5b — more games

- [x] **Memory pairs**: up to 6 pictured cards → 12 numbered face-down tiles (picture + word per card). Turn two: a match stays up with a tick, a miss shakes and turns back (or turns back at once when you pick a third). Pairs and turns counter; finish shows 1–3 stars by wasted turns, confetti, Play again.
- [x] **Spell it**: one-word cards (2–12 letters) with a picture or a sentence. Clue = picture (plus the gapped sentence if any), else the gapped sentence. Shuffled letter tiles (never already in order) → slots; click or type letters, click a slot or Backspace to take back. A full wrong word shakes, wrong letters fly back. Hint places the next right letter. Star only with no wrong tries and no hints; otherwise the word goes to Practise again.
- [x] **Word ↔ meaning**: cards with a meaning (distinct meanings), up to 5 per board. Numbered words (with picture or letter tile) on the left, lettered meanings on the right; pick one from each side in any order (keys 1–5 and A–E). A match turns green and labels the meaning with its word; a miss shakes. Star per word matched first try; Practise again builds a board from the missed words (topped up to 3).

### Acceptance (you test)

- [ ] Lesson with 6+ pictured cards → Games → Memory pairs → 12 tiles; matching all shows the finish screen; Play again deals a new set.
- [ ] Students call a number, you click it; two wrong tiles turn back by themselves.
- [ ] Games → Spell it → students call letters, you type them; a wrong word shakes and keeps the right letters; Hint fills the next letter and costs the star.
- [ ] Lesson with 3+ cards that have a meaning → Games → Word ↔ meaning → press "2" then "C"; right pairs lock green, wrong ones shake; finish shows stars and Practise again.
