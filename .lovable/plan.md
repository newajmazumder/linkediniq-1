
## Investigation

Current state from code review:

- `campaigns.current_goal_value` is **manually entered** by the user via `CampaignGoalProgressCard` (the input field), then `aggregate-campaign-goals` computes `unattributed = current_goal_value - total_post_contribution`.
- This inverts the user's stated rule: **post contributions should drive campaign progress automatically**, manual entry is optional/unattributed-only.
- `aggregate-campaign-goals` already sums `goal_contribution` across post_metrics rows → `total_post_contribution`. This is the value we need to roll into `current_goal_value`.
- `goal_progress_pct` is already computed but currently capped at 100 (`Math.min(100, ...)`) in `goal-metrics.ts` — blocks overachievement display.
- No `goal_status` field exists on `campaigns`. No overachievement UI anywhere.
- Hero header (screenshot) shows score/strategy/execution but **no campaign goal progress bar** — the missing "proof the campaign is working".
- `CampaignGoalProgressCard` shows "From posts" + "Unattributed" but the manual entry is the source of truth — needs flip.
- Strategy page campaign cards show execution/velocity but no goal progress.

## Plan: Auto-rolled Goal Progress + Overachievement

### 1. Flip the source-of-truth model

**Rule (MVP):** `campaign.current_goal_value = SUM(post_metrics.goal_contribution)` for all posts linked to the campaign. Auto-rolled, not manually typed.

Keep `current_goal_value` column as the persisted total (so the strategy list doesn't need to re-aggregate). `aggregate-campaign-goals` becomes the writer.

**Manual unattributed input** stays available but moves to a **secondary "external attribution" field** (`unattributed_goal_value`, new column) so the user can still log "12 bookings came from cold DMs". Total displayed = posts + unattributed.

### 2. DB migration

```sql
ALTER TABLE campaigns
  ADD COLUMN unattributed_goal_value integer DEFAULT 0,
  ADD COLUMN goal_status text DEFAULT 'not_started',
  ADD COLUMN goal_progress_percent numeric DEFAULT 0;
```

(`goal_status`: `not_started | in_progress | achieved | overachieved`)

### 3. `aggregate-campaign-goals` updates

- Compute `posts_contribution = sum(goal_contribution)`.
- `current_goal_value = posts_contribution + (campaign.unattributed_goal_value || 0)`.
- `goal_progress_percent = target ? (current / target) * 100 : 0` — **uncapped**.
- `goal_status` derived per the spec's logic.
- Persist all four onto `campaigns` (so list/header reads are cheap).
- Return `posts_contribution`, `unattributed`, `current_goal_value`, `goal_progress_percent`, `goal_status`, `remaining = max(0, target - current)`, `over_target = max(0, current - target)`.

### 4. Auto-trigger on contribution save

`PostDetailPage.saveMetrics` already invokes `aggregate-campaign-goals` ✔. Confirm the call passes `campaign_id` resolved from the post→draft→plan chain. Add the same invocation when contribution changes inline anywhere else.

### 5. `goal-metrics.ts` helpers

- Remove `Math.min(100, ...)` cap from `computeGoalProgress` — return raw % so overachievement is visible.
- Add `deriveGoalStatus(current, target)` → status string.
- Add `formatGoalProgress({current, target})` → `{pct, remaining, overTarget, status, label}`.

### 6. UI changes

**A. New component `CampaignGoalProgressBar.tsx`** (reusable):
- Visual bar capped at 100% width, but shows raw % number above.
- States: `not_started` (muted), `in_progress` (primary), `achieved` (green check + "Goal achieved"), `overachieved` (green + "+X over target", green-tinted bar).
- Compact + full variants (compact = inline strip; full = with breakdown).

**B. `CampaignPlanPage` hero header** (the screenshot):
- Add a new row above/below "Goal · Execution · Velocity" cards: full-width `CampaignGoalProgressBar` showing `38 / 100 demo bookings · 38% · 62 remaining`.
- Keeps the existing GOAL card (target text only) but the bar becomes the primary signal.

**C. `CampaignGoalProgressCard` (analytics tab) — restructure**:
- Top: progress bar (full variant) — same component.
- Middle grid: "From posts" (read-only sum) · "External / unattributed" (manual input, replaces current main input) · "Total".
- Bottom: contribution breakdown — top 3 posts by contribution (links to post detail).
- Remove the misleading "manual total" input.

**D. `StrategyPage` campaign cards**:
- Add a one-line goal progress strip under the existing execution/velocity row: `Goal: 38 / 100 demo bookings (38%)` or `Overachieved +35` in green.
- Use the compact `CampaignGoalProgressBar` variant.

**E. `PostContributionTable`**: no logic change — already ranks by contribution. Add a small footer line "Total contributed: X / target".

### 7. Live refresh wiring

- `PostDetailPage` after metrics save → invokes aggregate (already done) → emits a window event `campaign-goals-updated:<id>`.
- `CampaignPlanPage` and `StrategyPage` listen and re-fetch the campaign row + aggregate. No realtime channel needed for MVP.

### 8. Files

**New**:
- `supabase/migrations/<ts>_goal_status_overachievement.sql`
- `src/components/campaign/CampaignGoalProgressBar.tsx`

**Edit**:
- `supabase/functions/aggregate-campaign-goals/index.ts` — flip source of truth, persist status/percent, support overachievement.
- `src/lib/goal-metrics.ts` — uncap progress, add status helpers.
- `src/components/campaign/CampaignGoalProgressCard.tsx` — restructure (unattributed-only input + breakdown).
- `src/pages/CampaignPlanPage.tsx` — add progress bar to hero, wire live refresh.
- `src/pages/StrategyPage.tsx` — add compact progress strip on campaign cards.
- `src/components/campaign/PostContributionTable.tsx` — total/target footer.

### 9. Out of scope

- Realtime channel for cross-tab updates (window event is enough for now).
- Historical snapshots of progress over time.
- Auto-pulling LinkedIn metrics.
