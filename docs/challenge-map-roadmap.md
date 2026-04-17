# Challenge map roadmap (full map + overview snapshot)

This document defines the step-by-step plan to build a gamified challenge map with:

- **Full interactive map** in the `Challenges` tab
- **Compact functional snapshot** in the `Overview` tab

The goal is to improve motivation while keeping next actions clear and fast.

---

## Product goals

- Students instantly understand: **where they are**, **what is next**, and **what is locked**.
- Overview stays lightweight and action-oriented.
- Challenges tab provides deep progression context without clutter.
- Both views share one visual/state system to avoid drift.

---

## Success criteria

- Student identifies next challenge within 2-3 seconds.
- Overview snapshot remains quick to scan and never feels heavy.
- Full map supports longer paths without readability breakdown.
- Existing launch/review behavior remains stable.

---

## Phase 1 — UX and behavior specification

**Outcome:** all interaction and state rules are locked before coding.

- [ ] Define node states and exact semantics:
  - `completed`
  - `current`
  - `locked`
- [ ] Define action rules per state:
  - completed -> review allowed
  - current -> start allowed
  - locked -> no launch action
- [ ] Define overview snapshot scope:
  - recommended window: previous completed, current, next 1-2 locked
- [ ] Define map labels and lock messaging copy.
- [ ] Define state color and icon language to be reused in both views.

---

## Phase 2 — Shared data model and adapter

**Outcome:** one source of truth powers full and mini map views.

- [ ] Add a UI-level node model (derived, no backend migration required now):
  - `id`
  - `status`
  - `stepNumber`
  - `title`
  - `reward`
  - `launchHref`
  - `unlockHint`
  - layout metadata (`lane`, `x`, `y`, or equivalent)
- [ ] Build adapter from current challenge data to map nodes.
- [ ] Ensure node ordering stays deterministic and stable across renders.
- [ ] Add minimal tests/helpers for transformation logic where practical.

---

## Phase 3 — Reusable map primitives

**Outcome:** shared rendering pieces exist before full/mini integration.

- [ ] Build map primitives/components:
  - `ChallengeMapCanvas` (path and connectors)
  - `ChallengeMapNode`
  - `ChallengeMapRewardBadge`
  - `ChallengeMapStateBadge`
- [ ] Implement visual treatment per state (completed/current/locked).
- [ ] Keep CTA placement and reward placement consistent.
- [ ] Ensure primitives are theme-safe and token-consistent.

---

## Phase 4 — Full map in Challenges tab

**Outcome:** `Challenges` tab becomes the primary progression surface.

- [ ] Integrate full map renderer into the Challenges tab.
- [ ] Support interactions:
  - current node -> Start challenge
  - completed node -> Review
  - locked node -> show lock reason only
- [ ] Auto-position view near current node on load (if applicable).
- [ ] Preserve existing launch routes and challenge logic unchanged.
- [ ] Validate empty/path-complete/no-current states.

---

## Phase 5 — Mini snapshot in Overview tab

**Outcome:** overview shows a quick functional map preview.

- [ ] Add compact snapshot component using same map primitives.
- [ ] Restrict snapshot to a small node window around current progress.
- [ ] Keep snapshot mostly read-only (no deep interactions).
- [ ] Add one clear CTA: `Open full challenge map`.
- [ ] Ensure mini map visual language exactly matches full map.

---

## Phase 6 — Accessibility, performance, responsive

**Outcome:** production-ready quality across devices and inputs.

- [ ] Keyboard focus order follows progression order.
- [ ] Add aria labels for node status, step, reward, and action.
- [ ] Validate contrast for all states and overlays.
- [ ] Optimize render cost for longer paths (memoization/selective rendering).
- [ ] Validate mobile and desktop layouts for full and mini views.

---

## Phase 7 — QA and rollout

**Outcome:** safe launch with measurable feedback.

- [ ] Run QA cases:
  - no assigned challenges
  - first unlocked challenge
  - mid-path
  - all completed
  - long path stress case
- [ ] Release behind feature flag (recommended).
- [ ] Capture feedback from teachers/students in first week.
- [ ] Track metrics:
  - time to next challenge start
  - challenge starts per session
  - opens from overview mini map to full map

---

## Suggested PR plan

- [ ] **PR1:** shared node model + adapter + map primitives
- [ ] **PR2:** full challenge map in Challenges tab
- [ ] **PR3:** overview mini snapshot + CTA bridge
- [ ] **PR4:** accessibility/performance polish + QA fixes

---

## Scope guardrails

Keep this version focused:

- **In scope**
  - full map + mini snapshot
  - state clarity and next-action UX
  - consistent rewards/lock visuals
- **Out of scope (for now)**
  - avatar builder integration
  - new backend schema/migrations
  - advanced animation system

---

## Execution notes

- Build **full map first**, then derive mini snapshot from shared primitives.
- Avoid duplicating map logic between tabs.
- Treat overview as a quick launcher, not a second full map.
