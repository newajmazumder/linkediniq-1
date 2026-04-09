

# Goal-Driven Outcome Optimization Engine — Implementation Plan

## What Already Exists

| Capability | Current State |
|---|---|
| Campaign model | `campaigns` table with goal (awareness/engagement/lead generation/promotion), CTA type, tone, style mix, personas — but NO measurable targets |
| Content generation | `generate-content` function: persona-aware, campaign-aligned, pattern-informed, supports text/image/carousel. Already uses GOAL_CATEGORY_PRIORITIES for context filtering |
| Pre-publish scoring | `predict-score`: 6 dimensions, failure reasons, improved hooks/CTAs, publish recommendation. Already references campaign goal and CTA type in scoring |
| Pattern learning | `learn-patterns`: aggregates by hook_type, tone, style, intent, CTA, length, time. Has confidence levels and comparative insights. But patterns are NOT segmented by outcome type |
| Performance tracking | `post_performance` (draft-based) and `post_metrics` (LinkedIn post-based). Manual metric entry on Analytics page |
| Recommendations | `recommend-next`: exploit/fix/experiment classification with pattern evidence |
| Post intelligence | `analyze-post`: goal evaluation, writing diagnosis, recommendations |

## What Needs to Change

### Phase 1: Measurable Campaign Targets

**Database migration** — add columns to `campaigns`:
```sql
ALTER TABLE campaigns ADD COLUMN primary_objective text DEFAULT 'awareness';
ALTER TABLE campaigns ADD COLUMN target_metric text;
ALTER TABLE campaigns ADD COLUMN target_quantity integer;
ALTER TABLE campaigns ADD COLUMN target_timeframe text DEFAULT 'monthly';
ALTER TABLE campaigns ADD COLUMN target_priority text DEFAULT 'medium';
ALTER TABLE campaigns ADD COLUMN target_start_date timestamptz DEFAULT now();
```

New table for progress tracking:
```sql
CREATE TABLE campaign_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  metric_name text NOT NULL,
  current_value integer DEFAULT 0,
  target_value integer DEFAULT 0,
  period_start timestamptz,
  period_end timestamptz,
  contributing_post_ids jsonb DEFAULT '[]',
  gap_analysis text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
-- + RLS policies
```

**Files changed:**
- `src/pages/StrategyPage.tsx` — add objective/metric/quantity/timeframe/priority fields to campaign form. Add progress summary cards on each campaign.
- Expand `goals` array to: awareness, engagement, followers, profile_visits, dms, leads, demo_bookings, signups, education.

### Phase 2: Goal-to-Content Strategy Mapping

**No new tables.** This is pure prompt engineering injected into `generate-content`.

**Files changed:**
- `supabase/functions/generate-content/index.ts` — add `buildOutcomeStrategyBlock(objective, targetMetric)` function that returns explicit generation rules per objective type (followers → relatable hooks, light CTA; DMs → curiosity gaps, direct-response; leads → pain→proof→CTA; awareness → broad hooks; education → frameworks). Inject this block into the user message alongside persona/campaign/context blocks. Also add `expected_funnel_path` and `generation_strategy_rationale` to the output schema per post.

### Phase 3: Pre-Publish Scoring Upgrade — Outcome Probability

**Database migration** — add columns to `prediction_scores`:
```sql
ALTER TABLE prediction_scores ADD COLUMN outcome_probability integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN goal_fit_score integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN attention_potential integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN engagement_potential integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN action_potential integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN outcome_potential integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN weak_stage text;
ALTER TABLE prediction_scores ADD COLUMN stage_breakdown jsonb DEFAULT '{}';
ALTER TABLE prediction_scores ADD COLUMN target_metric text;
ALTER TABLE prediction_scores ADD COLUMN target_quantity integer;
```

**Files changed:**
- `supabase/functions/predict-score/index.ts` — fetch campaign's `primary_objective`, `target_metric`, `target_quantity`. Expand prompt to request: outcome_probability, stage breakdown (attention → engagement → action → outcome), weak_stage identification, target-specific failure reasons (e.g., "this post explains too much, reducing reason to DM"), target-aware improvement suggestions. Replace generic language with outcome-specific language.
- `src/components/create/PostCard.tsx` — add outcome probability display, stage breakdown visualization (4 bars: attention/engagement/action/outcome), weak stage highlight, target-specific recommendations.
- `src/pages/DraftsPage.tsx` — same outcome probability and stage breakdown UI.

### Phase 4: Auto-Optimization Pass

**No new tables.** Logic lives in the edge function.

New edge function: `supabase/functions/optimize-post/index.ts`
- Takes a `post_id`, calls `predict-score` internally, checks if score < 75 or publish_recommendation !== "publish"
- If weak: builds a revision prompt using the failure_reasons and suggestions from prediction, calls AI to revise hook/body/CTA
- Returns the optimized post + what changed
- Can be called in a loop (max 2 passes)

**Files changed:**
- `src/pages/CreatePage.tsx` — add "Auto-optimize" toggle. After generation, optionally call `optimize-post` for each variation. Show "optimized" badge and what was improved.
- `src/components/create/PostCard.tsx` — show optimization delta (initial score → optimized score, what changed).

### Phase 5: Outcome-Specific Pattern Learning

**Database migration** — add outcome dimension to `content_patterns`:
```sql
ALTER TABLE content_patterns ADD COLUMN outcome_type text;
ALTER TABLE content_patterns ADD COLUMN target_metric text;
```

**Files changed:**
- `supabase/functions/learn-patterns/index.ts` — when aggregating, also group by the campaign's primary_objective. Store separate patterns for "hook_type for DMs" vs "hook_type for followers". Add outcome-specific comparative insights.
- `src/pages/AnalyticsPage.tsx` — add "By Outcome" tab/section. Show patterns filtered by objective (what works for followers vs DMs vs leads). Show confidence + sample size.

### Phase 6: Campaign Progress Intelligence

**Files changed:**
- `src/pages/StrategyPage.tsx` — for each campaign with targets, show progress bar, contributing posts, gap analysis, and whether current content strategy is helping. Fetch from `campaign_progress` + aggregate from `post_performance`/`post_metrics`.
- `supabase/functions/learn-patterns/index.ts` — at end of learning cycle, update `campaign_progress` rows by matching drafts/posts to campaigns, summing metrics.
- New section on Dashboard: campaign target progress summary.

## Data Model Summary

```text
campaigns (MODIFIED)
  + primary_objective     text
  + target_metric         text  
  + target_quantity       integer
  + target_timeframe      text
  + target_priority       text
  + target_start_date     timestamptz

campaign_progress (NEW)
  id, user_id, campaign_id, metric_name,
  current_value, target_value,
  period_start, period_end,
  contributing_post_ids, gap_analysis

prediction_scores (MODIFIED)
  + outcome_probability   integer
  + goal_fit_score        integer
  + attention_potential    integer
  + engagement_potential   integer
  + action_potential       integer
  + outcome_potential      integer
  + weak_stage             text
  + stage_breakdown        jsonb
  + target_metric          text
  + target_quantity        integer

content_patterns (MODIFIED)
  + outcome_type           text
  + target_metric          text
```

## Files Modified (Full List)

| File | Phase | Change |
|---|---|---|
| Migration SQL | 1,3,5 | Schema changes above |
| `src/pages/StrategyPage.tsx` | 1,6 | Campaign target fields + progress tracking UI |
| `supabase/functions/generate-content/index.ts` | 2 | Outcome strategy block + expanded output schema |
| `supabase/functions/predict-score/index.ts` | 3 | Outcome probability + stage breakdown + target-specific reasoning |
| `src/components/create/PostCard.tsx` | 3,4 | Outcome probability display + stage bars + optimization delta |
| `src/pages/DraftsPage.tsx` | 3 | Same outcome UI as PostCard |
| `supabase/functions/optimize-post/index.ts` | 4 | New auto-optimization function |
| `src/pages/CreatePage.tsx` | 4 | Auto-optimize toggle + optimized badges |
| `supabase/functions/learn-patterns/index.ts` | 5,6 | Outcome-segmented patterns + campaign progress updates |
| `src/pages/AnalyticsPage.tsx` | 5 | Outcome-type pattern sections |
| `src/pages/DashboardPage.tsx` | 6 | Campaign progress summary |

## Dependencies and Risks

- **AI prompt size**: Adding outcome strategy + stage breakdown increases prompt tokens. Mitigated by keeping blocks concise and only including relevant outcome rules (not all 8).
- **Auto-optimization latency**: Each optimization pass = 1 additional AI call per post. With 4 variations × 2 passes = up to 8 extra calls. Mitigated by making it optional and defaulting to 1 pass.
- **Pattern learning data sparsity**: Outcome-segmented patterns will have smaller sample sizes initially. Mitigated by showing confidence levels prominently and falling back to non-segmented patterns when data is thin.
- **Campaign progress accuracy**: Progress relies on manual metric input or LinkedIn sync. Explicitly shown as "based on available data."

## Implementation Order

1. **Phase 1** (Campaign targets) — foundation for everything else
2. **Phase 2** (Goal-to-content mapping) — immediate generation quality improvement
3. **Phase 3** (Outcome probability scoring) — the core value shift
4. **Phase 4** (Auto-optimization) — reduces generate-then-fix gap
5. **Phase 5** (Outcome-specific learning) — long-term intelligence
6. **Phase 6** (Campaign progress) — ties everything together

