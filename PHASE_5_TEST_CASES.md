# Phase 5 — Time-Aware Campaign Intelligence

This phase adds calendar-time awareness so the system can say honestly:
**Not started · Behind · On track · Ahead** — instead of guessing.

---

## What changed

| Layer | Change |
|---|---|
| Schema | `campaigns.target_end_date` (explicit deadline). `campaign_post_plans.planned_time` (HH:MM). |
| Engine | `computePacing()` in `src/lib/execution.ts` returns a `Pacing` block with `state`, `expectedByNow`, `actual`, `delta`, `requiredVelocity`. |
| Decision tree | `campaign-next-action` now gates by `pacing_state` *before* execution/optimization branches: `NOT_STARTED → BEHIND → AHEAD → existing branches`. |
| Backend tick | `execution-tick` uses real `target_end_date` instead of inferred 5-posts/week window. |
| UI | New `CampaignPacingStrip` above Next Best Action. Pacing badge inside the action card. |
| Form | `target_end_date` date picker on the campaign edit form. |
| Post card | Displays `planned_time` next to planned date. |

---

## Section A — Pacing engine

### A1. NOT_STARTED — empty plan
**Setup**: Campaign with 0 posts in `campaign_post_plans`.
**Expect**:
- `pacing_state = NOT_STARTED`
- Strip shows: `Expected by today: 0 posts · Actual: 0 · Not started`
- Next action: `blocker · "Generate your campaign plan"`

### A2. NOT_STARTED — plan ready, day 0
**Setup**: 10 posts planned. `target_start_date = today`. `posted = 0`. `elapsedRatio < 0.05`.
**Expect**:
- `pacing_state = NOT_STARTED`
- Next action: `blocker · "Start campaign — publish your first post today"`
- CTA opens Post #1.

### A3. BEHIND — time elapsed, nothing posted
**Setup**: 10 posts planned. Start 7 days ago. End in 21 days. `posted = 0`.
**Expect**:
- `expectedByNow ≈ round(7/28 * 10) = 3` (linear pace)
- `pacing_state = BEHIND`
- Strip: `Expected by today: 3 posts · Actual: 0 · Behind (-3)`
- Next action: `execution · "Catch up 3 posts in next 48h"`
- `priority = high` (or `critical` if days_remaining < 3)

### A4. ON_TRACK — posting matches pace
**Setup**: 10 posts. Start 7 days ago, end in 21 days. `posted = 3`.
**Expect**:
- `expectedByNow = 3`, `actual = 3`, `delta = 0` → `ON_TRACK`
- Strip: green dot, `On track`
- Next action falls through to existing matrix (steady / experiment / optimization).

### A5. AHEAD — buffer earned
**Setup**: 10 posts. Start 7 days ago, end in 21 days. `posted = 6`.
**Expect**:
- `expectedByNow = 3`, `actual = 6`, `delta = +3` → `AHEAD`
- Strip: blue dot, `Ahead (+3 ahead)`
- Next action: `experiment · "You're ahead of pace — use the buffer to test something risky"`

### A6. ON_TRACK boundary — small delta
**Setup**: `expectedByNow = 4`, `actual = 4` → on track.
**Expect**: `delta = 0`, no -/+ label.
Try `actual = 5` (delta +1, > 0.5 tolerance) → `AHEAD`.
Try `actual = 3` (delta -1) → `BEHIND`.

---

## Section B — End-date editing

### B1. Set custom end date
**Setup**: Open existing campaign in StrategyPage form.
**Steps**: Pick a `target_end_date` 60 days from now → Save.
**Expect**:
- DB row updated.
- `execution-tick` next run uses 60-day window.
- Pacing strip recalculates (e.g., `expectedByNow` shrinks because the window is longer).

### B2. Backfill default
**Setup**: Existing campaign created before this migration.
**Expect**:
- `target_end_date = target_start_date + 28 days` was applied automatically.
- Form shows a populated date.

### B3. End-date in past
**Setup**: Set `target_end_date` to yesterday.
**Expect**:
- `daysRemaining = 0`.
- Next tick → `execution_status = completed` (if posted ≥ 80% of plan) or `failed` otherwise.

---

## Section C — Planned time on post

### C1. Time displayed when set
**Setup**: A `campaign_post_plans` row with `planned_date = 2026-05-01` and `planned_time = "10:30"`.
**Expect**: Card row shows `· planned 5/1/2026 @ 10:30`.

### C2. Time omitted when null
**Setup**: `planned_time = null`.
**Expect**: Card shows `· planned 5/1/2026` only.

### C3. Invalid time rejected
**Setup**: Try inserting `planned_time = "25:99"` directly via DB.
**Expect**: CHECK constraint violation. Format must be `HH:MM` (24h).

---

## Section D — Decision tree priority

The first matching branch wins:

```
no plan                         → blocker  "Generate plan"
plan exists, NOT_STARTED        → blocker  "Start campaign — publish first post today"
BEHIND                          → execution "Catch up N posts in next 48h"
clicks > 5, no conv, ≥3 signals → strategy "Fix conversion bottleneck"
on pace + winning hook + buffer → optimization "Apply winner to next post"
≥4 signals + posted≥50% + goal<25% → strategy "Strategy isn't working"
AHEAD                           → experiment "Use buffer to test something risky"
on pace + signal < high         → optimization (medium) or experiment (low)
else                            → steady
```

### D1. Verify time-first ordering
**Setup**: BEHIND scenario + a winning hook detected (≥2 confirming signals).
**Expect**: BEHIND wins → action_type = `execution`. The optimization branch does not fire because catching up is more important than refining when posts aren't going live.

---

## Section E — Visual QA

- Strip: gray (NOT_STARTED), red (BEHIND), green (ON_TRACK), blue (AHEAD).
- Strip is hidden when there's no plan AND no campaign timeline (truly empty).
- Card pacing badge sits in the meta row alongside priority + signal strength chips.
- All colors come from semantic tokens (no hex).
