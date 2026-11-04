# Class source strip — product decisions (locked)

Last updated: 2026-11-02

**Status:** Agreed direction for **book chips**, pinned **Notebook**, and **Review** as a mode shortcut. Notebook layout, ownership, and chip jobs live in **`NOTEBOOK_PRODUCT.md`**. Implementation phases for the strip itself: **`CLASS_SOURCE_STRIP_PHASED_PLAN.md`**.

**Teacher-facing:** no new named product. Chips on the open class.  
**Code name:** source strip.

**Related:** `NOTEBOOK_PRODUCT.md` (Notebook Pin / Tab / Overlay / Park; student-scoped store), `LESSON_HUB_AND_MULTI_BOOK_PRODUCT.md` (this is the near-term two-book swap; Hub stays later), `CLASSROOM_HOME_PRODUCT.md` (yellow Pick shelf stays for between-block close), `LESSON_BOARD_PRODUCT.md` (page model only), `LESSON_VAULT_PRODUCT.md` / vault phased plan (Review mode).

---

## Why

The left rail already owns **tools**. Mid-class, switching books still means close the overlay → yellow shelf → open the other cover. That is a scene change, not a tab change.

The strip answers **where we are** and **one-tap swap** for materials — and hosts fixed destinations / modes that are not the same kind of thing as a book.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| Job | **Where we are** + **one-tap swap**. Not a second toolbox. |
| Book tabs | Assigned / open **books only** — exclusive document tabs |
| Notebook | **Pinned workspace** on the strip (not a peer book tab). Strip job = **Tab**; **Pin / Park** stay on the **left rail**. See `NOTEBOOK_PRODUCT.md`. |
| Review | **Lesson mode shortcut** on the strip (not a source tab). Vault manages cards and can also open Review. |
| Left rail | Tools stay there (toolbox, translate, vault, pen, settings, …) |
| Book tap | That book **Focus**; last page restored; overlay stays open; exits Review if open |
| Close (X) / Esc | Still the yellow **shelf**. Strip is mid-class; shelf is between blocks |
| Notebook storage | **One notebook per student.** Not per book/unit. No mega-notebook across kids. |
| Book swap → notebook | PDF change **does not** swap the notebook |
| Height | Thin (~36px). Reserve top inset so the spread still fits |
| Clock / End | Same top row, tucked **right** of the chips (not on the strip as a tab) |
| Workshop reader | No strip (place bar already owns the top) |

```text
[ Workshop p.42 ]  [ Literature p.18 ]  |  Notebook          Review 12     24:12  End
         book tabs                     pinned workspace    mode shortcut
```

Book chips sit in a tablist on the **left**. Notebook and Review sit after a divider as fixed controls. Time + End tuck on the **right** of that row so they cannot sit on the chips.

When **Review** is on, book and Notebook controls look **paused** (no selected material); the warm book/notebook session stays under the stage.

---

## Non-goals (this track)

- Lesson Hub carousel or `⌂ Hub` chip
- Focus book + Dock a second book / 50/50 split
- Window manager
- Typed class-log notebook (still dead; live surface is Notebook)
- Tools, streak, recap, or End class **as a strip tab** (End stays in the floating capsule, tucked right)
- Review as a peer book/source tab (it is a mode)

---

## Success

1. Two assigned books: tap the other chip → that PDF at last page; no yellow shelf.
2. Switch back → the first book’s page and ink are still there.
3. Notebook chip takes **Tab** (notebook owns the desk, book stays warm). Left-rail button Pins / Parks. Changing books does not load a different notebook. Notebook does not read as “another book tab.”
4. Review opens practice mode from the strip or Vault; it is not a document tab. Book or Notebook tap exits Review.
5. X / Esc still returns to Pick shelf.
6. One-book student: strip still shows that book + Notebook (+ Review when there is a student); spread is not clipped.
