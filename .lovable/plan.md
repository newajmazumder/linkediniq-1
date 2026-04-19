
## Investigation summary

Looking at the current model:
- `post_metrics` already stores raw LinkedIn signals (impressions/reactions/comments/reposts/clicks/profile_visits/follower_gain) — this is our **Layer 1 (Raw)**.
- `campaigns` defines `target_metric` + `target_quantity` — the goal definition exists.
- `campaign_progress` tracks `metric_name` / `current_value` / `target_value` — already supports campaign-level goal totals (great, no new table needed).
- **Missing**: per-post `goal_contribution` field (the bridge between raw signals and goal outcome).
- **Missing**: a UI to enter per-post goal contribution and per-campaign current goal value.
- **Missing**: aggregation/interpretation that compares contribution vs. unattributed and produces goal-aware insights/score.

Earlier the user approved a broader "performance feedback loop" plan. This message refines/locks the **goal-aware model**: raw stays fixed, goal is dynamic, and a `goal_contribution` field per post is the new bridge. We'll fold this into the existing `post_metrics` + `campaign_progress` tables instead of creating new ones.

## Plan: Goal-Aware Performance System

### 1. Database (one small migration)

Add the bridge field + lightweight insight cache:

```sql
ALTER TABLE post_metrics
  ADD COLUMN goal_contribution integer DEFAULT 0,
  ADD COLUMN goal_metric text,        -- snapshot of campaign metric at entry time
  ADD COLUMN attribution_note text;   -- optional user note ("from DM reply")

ALTER TABLE campaigns
  ADD COLUMN current_goal_value integer DEFAULT 0,
  ADD COLUMN goal_value_updated_at timestamptz;
```

Reuse existing tables — no new tables required. `campaign_progress` continues to track historical snapshots if needed.

### 2. Edge function: `aggregate-campaign-goals`

Lightweight, no AI required for the math:
- Sum `goal_contribution` across posts linked to campaign (via `linked_draft_id` → `campaign_post_plans` → campaign).
- Compute: `total_post_contribution`, `unattributed = current_goal_value − total_post_contribution`, `goal_progress %`.
- Compute derived: per-post `efficiency = contribution / impressions`, `conversion_rate = contribution / clicks`, ROI ranking.
- Update `campaigns.execution_score` with new formula:
  `0.5 × goal_progress + 0.3 × execution_rate + 0.2 × content_efficiency`.

### 3. Edge function: `interpret-campaign-performance` (AI layer)

Only runs when user clicks "Generate insights":
- Inputs: posts with raw metrics + contributions, campaign goal/target, top/bottom performers.
- Output: goal-aware recommendations (e.g. "Posts with direct CTA drive 80% of bookings — replicate Post 3 format").
- Saves into existing `campaign_reports` table (`report_type: "goal_interpretation"`).

### 4. UI changes

**A. Performance form on `PostDetailPage`** (the screenshot shown):
- Keep all 7 raw metric fields exactly as-is (locked, platform-native).
- Add a new highlighted section **"Goal Contribution"** below raw metrics:
  - Dynamic label driven by campaign goal — e.g. "Demo bookings from this post" / "Leads generated" / "Followers gained from this post".
  - Single integer input + optional attribution note.
  - Only shown if post is linked to a campaign with a `target_metric`.
  - Helper text: "How many [metric] can you attribute to this post?"

**B. Campaign Analytics tab** (`CampaignPlanPage` analytics tab):
Restructure into 4 sections per spec:
1. **Raw Performance** — totals across posts (impressions, likes, comments, clicks).
2. **Post Goal Contribution** — table ranking posts by contribution (Post → contribution → efficiency).
3. **Campaign Progress** — input field for `current_goal_value`, derived `From posts: X · Unattributed: Y`, progress bar `X / target`.
4. **AI Insight** — button "Generate goal-aware insights" → renders interpretation output.

**C. Inline on `CampaignPostCard`** (posted state):
- Add a tiny line under the existing "Posted" pill: `Impressions: 1.2k · [goal metric]: 3` when contribution exists.

### 5. Score recomputation

Replace planning-only execution score with the goal-aware formula in `aggregate-campaign-goals`. Trigger it whenever metrics or `current_goal_value` change. Fallback to old formula when no contributions yet (so score isn't 0 on day 1).

### 6. Auto-trigger flow

- `MarkPostedDialog` → already creates the metrics row, now also writes `goal_metric` snapshot.
- Saving `post_metrics` (raw + contribution) → invokes `aggregate-campaign-goals`.
- Saving `current_goal_value` on campaign → invokes `aggregate-campaign-goals`.

## Files to edit/create

**New**:
- `supabase/migrations/<ts>_goal_aware_metrics.sql`
- `supabase/functions/aggregate-campaign-goals/index.ts`
- `supabase/functions/interpret-campaign-performance/index.ts`
- `src/lib/goal-metrics.ts` — pure helpers: `goalMetricLabel(metric)`, `computeEfficiency`, `rankByContribution`.
- `src/components/campaign/CampaignGoalProgressCard.tsx` — section 3 UI.
- `src/components/campaign/PostContributionTable.tsx` — section 2 UI.

**Edit**:
- `src/pages/PostDetailPage.tsx` — add "Goal Contribution" section to metrics form; pass campaign metric label.
- `src/pages/CampaignPlanPage.tsx` — restructure analytics tab into 4 sections.
- `src/components/campaign/CampaignPostCard.tsx` — show inline contribution under posted state.
- `src/components/strategy/MarkPostedDialog.tsx` — snapshot `goal_metric` on first metrics row.

## Out of scope (deferred)

- Auto-pulling LinkedIn metrics via API (manual entry only for now).
- Time-series snapshots (Day 1/3/7) — current `last_updated_at` is enough; can add later.
- Multi-goal campaigns (single primary goal only).
