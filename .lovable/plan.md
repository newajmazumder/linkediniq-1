

The user wants Time-Aware Campaign Intelligence. Let me check what already exists vs what's missing.

**What exists already** (from schema + code I've read):
- `campaigns.target_start_date`, `started_at`, `completed_at` (no explicit `end_date`)
- `campaign_post_plans.planned_date`, `posted_at`, `missed_at`
- `execution.ts` already computes `daysElapsed`, `daysRemaining`, `velocityActual`, `velocityRequired`, posting %
- `campaign-next-action` already has a `pacing` ratio and on-pace branching

**What's actually missing**:
1. **No `end_date`** — currently inferred as `started_at + ceil(totalPlanned/5)*7 days`. Brittle and invisible to user.
2. **No NOT_STARTED state surfaced** — when 0 posts and 0 elapsed, the engine still says "on track".
3. **No "expected by today" pacing display** — UI shows goal progress but never "expected 3 / actual 1 / behind by 2".
4. **No planned_time** — only `planned_date` (timestamptz, but date-only in practice).
5. **Decision engine doesn't bucket BEHIND/ON_TRACK/AHEAD as primary state** — it derives nuanced action types but never says the simple verdict.

I won't propose v2/v3 (own performance learning, competitor patterns) — user said don't overcomplicate v1.

---

# Plan — Time-Aware Campaign Intelligence (v1)

Make the system honest about *time*: surface NOT_STARTED, show "expected vs actual by today", and let the Next Best Action engine choose by the time × execution × data matrix.

## 1. Schema additions (migration)

Add to `campaigns`:
- `target_end_date timestamptz` — explicit campaign deadline (replaces today's brittle 5-posts/week inference).
- `duration_days int generated` — computed from start/end at read time (or just compute client-side).

Add to `campaign_post_plans`:
- `planned_time text` — e.g. `"10:30"` (24h, optional). `planned_date` continues to hold the date.

Backfill: for existing campaigns, `target_end_date = target_start_date + INTERVAL '28 days'` if null.

## 2. Pacing engine (`src/lib/execution.ts`)

Add a single function:
```text
computePacing(campaign, postPlans, now):
  expectedByNow  = round(daysElapsed / daysTotal * totalPlanned)
  actual         = posted count
  paceDelta      = actual - expectedByNow
  state          = NOT_STARTED | BEHIND | ON_TRACK | AHEAD
  requiredVelocity = postsRemaining / max(daysRemaining,1) * 7   // posts/week
```

Replace the existing `deriveExecutionStatus` "active vs at_risk" logic to use the new state buckets. Keep `at_risk`/`completed`/`failed`/`paused` as they were.

## 3. Decision engine (`supabase/functions/campaign-next-action/index.ts`)

Use the **Time × Execution × Data** matrix as the *first* gate:

```text
NOT_STARTED  → action = blocker      "Start campaign — publish your first post today"
BEHIND       → action = execution    "Catch up — publish N posts in next 48h"
ON_TRACK     → fall through to existing signal-strength matrix
                (low → experiment, medium → optimization, high → exploit winner)
AHEAD        → action = experiment   "You have buffer — use it to test something risky"
```

Adds `pace` block to the response payload: `{ expectedByNow, actual, delta, state }`.

## 4. UI surfaces

**a) Pacing Feedback strip** — new lightweight component `CampaignPacingStrip.tsx`, rendered above `NextBestActionCard`:
```
Expected by today: 3 posts   Actual: 1   Status: Behind (-2)
```
Color-coded: gray (NOT_STARTED), red (BEHIND), green (ON_TRACK), blue (AHEAD).

**b) Next Best Action card** — show the new state badge (NOT_STARTED/BEHIND/etc) next to the existing priority chip.

**c) Campaign edit form (`StrategyPage.tsx`)** — add `target_end_date` date picker next to `target_start_date`.

**d) Post plan card (`CampaignPostCard.tsx`)** — show `planned_time` next to planned date when set; allow editing via existing post detail flow (out of scope here — just display).

## 5. Files touched

- **Migration**: add `target_end_date`, `planned_time`.
- `src/lib/execution.ts` — `computePacing()` + state machine update.
- `supabase/functions/campaign-next-action/index.ts` — time-first decision tree, pace payload.
- `supabase/functions/execution-tick/index.ts` — use real `target_end_date` instead of inferred end.
- `src/components/campaign/CampaignPacingStrip.tsx` — new component.
- `src/pages/CampaignPlanPage.tsx` — render pacing strip; pass pace to card.
- `src/components/campaign/NextBestActionCard.tsx` — render state badge.
- `src/pages/StrategyPage.tsx` — `target_end_date` picker in form.
- `src/components/campaign/CampaignPostCard.tsx` — display `planned_time` if present.
- New `PHASE_5_TEST_CASES.md` — 4 scenarios (NOT_STARTED, BEHIND, ON_TRACK, AHEAD) + pacing strip + end-date editing.

No v2/v3 timing intelligence (audience-region recommendations, own-performance learning) — kept out as the user requested.

