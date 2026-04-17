# Student overview gamification — step-by-step task plan

This document is a living checklist for redesigning the student overview page so it feels motivating, game-like, and learning-focused.

Use it to track completed work and what comes next.

---

## Product goal (single sentence)

Build a clear motivation loop in the overview:
**Play next challenge -> earn coins -> unlock/spend on avatar -> repeat.**

---

## Success criteria (how we know it works)

- Students can identify their **next challenge** in less than 3 seconds.
- Students can see their **current coins** and what they can unlock next.
- The overview keeps challenge actions primary, while avatar/economy stays visible.
- Mobile layout remains readable and touch-friendly.

---

## Phase 0 — Alignment and UX decisions

**Outcome:** lock key decisions before coding.

- [ ] Confirm final page structure:
  - Left (about 65-70%): challenge path/progression
  - Right (about 30-35%): avatar + coin motivation panel
- [ ] Confirm responsive behavior:
  - Desktop: 2-column layout
  - Tablet/mobile: stacked layout (challenge first, avatar second)
- [ ] Confirm motivation copy tone (encouraging, simple, student-friendly)
- [ ] Confirm whether "shop" is interactive now or "coming soon" with teasers
- [ ] Define minimum accessibility standards (keyboard, contrast, labels)

---

## Phase 1 — Information architecture and component map

**Outcome:** exact sections and responsibilities are clear.

- [ ] Define left column sections:
  - Challenge path header and progress status
  - Current challenge card (primary CTA)
  - Previous and next-locked context cards (secondary)
- [ ] Define right column sections:
  - Full avatar display
  - Current coin balance (compact)
  - "Can unlock now" and "Next unlock" teaser rows
- [ ] Decide where wallet history stays:
  - Keep full transaction table below main overview block
- [ ] Map responsibilities by component (avoid oversized single file)
- [ ] Confirm data inputs needed from `StudentProfileView`

---

## Phase 2 — Data and state prerequisites

**Outcome:** UI has all required data for motivation cues.

- [ ] Verify available fields for:
  - Coin balance
  - Challenge status (completed/unlocked/locked)
  - Avatar summary and current look
- [ ] Add derived values needed in selectors/helpers:
  - Current challenge index
  - Next reward/unlock teaser
  - Affordability state ("can buy now" vs "need X coins")
- [ ] Define fallback behavior for missing data:
  - No challenges assigned
  - No transactions
  - Avatar/shop unavailable
- [ ] Ensure all labels can be generated without hardcoded per-student logic

---

## Phase 3 — Layout implementation

**Outcome:** the overview has a stable, responsive 2-column shell.

- [ ] Add 2-column grid to overview main section
- [ ] Keep challenge content in left panel only
- [ ] Add dedicated right panel container for avatar motivation
- [ ] Maintain bounded content width and existing visual tokens
- [ ] Validate no overflow/collision on common breakpoints

---

## Phase 4 — Challenge path gamification polish (left panel)

**Outcome:** challenge section feels more game-like without losing clarity.

- [ ] Strengthen hierarchy:
  - Highlight "Your turn" state clearly
  - Keep a single primary action button
- [ ] Add progression cues:
  - Step count and completion count
  - Optional mini-progress indicator for path completion
- [ ] Improve locked-state anticipation:
  - Show what unlocks next and why it is locked
- [ ] Add celebratory microcopy for completed items (short, positive)
- [ ] Verify all states:
  - No completed
  - Active current
  - End of path

---

## Phase 5 — Avatar motivation panel (right panel)

**Outcome:** right side creates a clear emotional reward loop.

- [ ] Add full avatar visual card
- [ ] Add compact coin balance badge with icon
- [ ] Add "available now" unlock teaser
- [ ] Add "next target" teaser with coins remaining
- [ ] Add clear link/button to avatar/shop destination
- [ ] Provide meaningful fallback if shop is not live yet

---

## Phase 6 — UX writing and motivation copy

**Outcome:** language feels encouraging, clear, and age-appropriate.

- [ ] Replace neutral labels with action-oriented labels where needed
- [ ] Keep messages short (1 line where possible)
- [ ] Avoid punitive language for locked content
- [ ] Add anticipation language ("2 more coins to unlock...")
- [ ] Ensure consistency across challenge, avatar, and wallet sections

---

## Phase 7 — Accessibility and performance pass

**Outcome:** polished and usable for all students.

- [ ] Keyboard navigation check for all interactive elements
- [ ] Verify aria labels/landmarks for major sections
- [ ] Ensure color contrast is sufficient for all badge states
- [ ] Confirm images have suitable alt handling (decorative vs informative)
- [ ] Check rendering performance with many transactions/items

---

## Phase 8 — QA checklist

**Outcome:** behavior is stable before release.

- [ ] Student with no assigned challenges
- [ ] Student with first unlocked challenge
- [ ] Student mid-path (completed + current + locked)
- [ ] Student who finished all assigned challenges
- [ ] Student with zero coins and with high coin balance
- [ ] Avatar/shop unavailable state
- [ ] Mobile, tablet, desktop visual validation

---

## Phase 9 — Rollout and iteration

**Outcome:** controlled release with measurable feedback.

- [ ] Release behind a temporary flag (optional but recommended)
- [ ] Gather quick teacher/student feedback in first week
- [ ] Track simple metrics:
  - Time to start next challenge
  - Challenge starts per student session
  - Avatar tab/shop visits from overview
- [ ] Prioritize iteration items based on real usage

---

## Task board (quick status)

Use this mini board to track where work stands:

- **Not started:** Phases 0-9
- **In progress:** _(fill in)_
- **Done:** _(fill in with date)_
- **Blocked:** _(fill in with blocker + owner)_

---

## Notes log

Add dated notes here when scope changes:

- YYYY-MM-DD: _(decision/change)_

---

## Immediate execution plan (next 1-2 PRs)

Use this section to execute quickly without reopening planning discussions.

### PR 1 — Overview two-column shell + motivation panel scaffold

**Goal:** ship the new page structure safely without deep logic changes.

**Scope checklist**

- [ ] Add responsive two-column overview shell:
  - Left: challenge path block
  - Right: avatar motivation panel scaffold
- [ ] Keep wallet history section below the two-column area
- [ ] Add right panel placeholder blocks:
  - Full avatar card
  - Coin balance mini-card
  - Unlock teaser card (static placeholder copy is OK in PR 1)
- [ ] Preserve existing challenge path behavior and CTA flow
- [ ] Verify mobile stacking order (challenge first, avatar second)

**Suggested file touchpoints**

- `components/students/tabs/student-overview-tab.tsx`
- `components/students/student-wallet-section.tsx` (only if spacing/layout adjustments are needed)
- Optional new component files under `components/students/` for right-panel pieces

**Acceptance criteria**

- [ ] Desktop shows clear 2-column layout with bounded width
- [ ] No regressions to current challenge launch links
- [ ] No visual breakage on mobile/tablet
- [ ] Existing no-data states still render correctly

---

### PR 2 — Real gamification content in right panel + challenge micro-polish

**Goal:** make the overview feel motivating with real dynamic cues.

**Scope checklist**

- [ ] Replace placeholder right panel content with dynamic data:
  - Current coin total
  - "Can unlock now" item (or meaningful fallback)
  - "Next unlock in X coins" teaser
- [ ] Add/adjust helper logic for affordability and teaser copy
- [ ] Improve challenge-path motivation copy:
  - Positive completion text
  - Clear "why locked" message
- [ ] Add/adjust CTA to avatar/shop destination from the right panel
- [ ] Keep challenge area as primary action zone

**Suggested file touchpoints**

- `components/students/tabs/student-overview-tab.tsx`
- `components/students/student-wallet-section.tsx` (copy consistency if needed)
- `components/students/tabs/student-avatar-tab.tsx` (link target consistency)
- `lib/students/selectors.ts` (derived display values)
- `lib/students/types.ts` (only if extra view fields are required)

**Acceptance criteria**

- [ ] Student always sees a clear next action in challenge path
- [ ] Student sees coin status and at least one meaningful unlock teaser
- [ ] Empty/unavailable shop states remain encouraging, not dead-end
- [ ] Copy and visual hierarchy feel game-like but still readable

---

### Recommended sequence and effort

- [ ] Do PR 1 first (lower risk layout move)
- [ ] Do PR 2 second (logic + motivation polish)
- [ ] Optional PR 3 for accessibility/perf hardening if needed

**Effort estimate (rough)**

- PR 1: 0.5-1.0 day
- PR 2: 1.0-1.5 days
- PR 3 (optional): 0.5 day

