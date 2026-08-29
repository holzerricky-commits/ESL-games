# Outline wizard — phased improvements

Stable product intent: teachers bring their own book PDF; outline setup must work across book shapes (not only Journeys/Wonders recipes).

## Storyline (5)

1. **Auto TOC detect** — propose contents page range + confirm  
2. **Page alignment** — one teacher sync point (printed ↔ PDF); no bulk auto-ghost  
3. **Adaptive outline from front matter** — generic extract + batch merge + lesson polish; series recipes as fallback  
4. **Sample unit peek** — deepen tree from one unit’s inner pattern  
5. **Polish** — after real uploads only  

## Add Book sheet UX (before alignment Phase 2)

### Phase A — Sheet shell

- [x] Centered Add Book Dialog (drop / Choose PDF); blurred backdrop  
- [x] Remove inline bottom upload panel from library  

### Phase B — Upload progress

- [x] Sheet expands; XHR upload progress bar; keep sheet open with bookId  

### Phase C — TOC detect → outline

- [x] “Looking for contents…” progress after upload  
- [x] Land in embedded outline wizard (TOC step) in the same sheet  

### Phase D — Soft chrome unify

- [x] Soft step panels + pill stepper; Edit outline opens same sheet at outline stage  

**Test:** + → sheet → drop PDF → upload bar → contents bar → outline TOC → continue; no card under the shelf.

## Build checklist

### Phase 1a — Auto TOC propose + confirm

- [x] Score early pages for contents / scope likeness (selectable text)
- [x] Propose contiguous PDF range; stop early after TOC block when body starts
- [x] Structure wizard: auto-scan on open (TOC step), message + From/To fill, Find again / Use suggestion
- [x] Manual From/To always available (scans with no text)

### Phase 1b — Stronger multi-page front packs

- [x] Prefer Contents + Scope + Skills as one pack when present (look-ahead after Contents)
- [x] Score Scope grids (`A:`/`B:`, UNIT/THEME/READING) and Academic Skills higher
- [x] Softer early-stop (2 low pages) + force peek after Contents
- [x] Regression tests for Reading Explorer–style Contents → Scope → Skills

### Phase 2a / 2b — Alignment

- [x] ~~Auto-suggest offset from folio scan~~ — **retired** (unsafe weak matches; see parking lot)  
- [x] One sync point: teacher confirms “this PDF page = printed N” (cap 20 not-counted)  
- [x] Checkpoint jumps after sync; advanced lists under details; skip if already match  

### Phase 3a–3c — Adaptive extract

- [x] **3a** Generic extract profile default for non-Journeys/Wonders; series recipes as fallback  
- [x] **3b** Merge multi-page / multi-batch extract by unit number + dedupe lessons; drop empty Contents shells  
- [x] **3c** Lesson nesting polish: drop empty chunks, merge dupe lessons, retitle flat generic wrappers  

### Phase 4a / 4b — Unit peek

- [ ] Peek Unit 1 → pattern; apply to all readings  

---

Last updated: 2026-08-10 — Phase 3c lesson nesting polish.
