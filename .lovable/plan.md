

The user wants Phase 1 foundation fixes. This is a high-risk, structural migration. Let me think carefully.

## What's actually broken (from audit)

1. **Post entity sprawl**: `ideas`, `drafts`, `linkedin_posts`, `campaign_post_plans` — 4 tables representing one logical thing
2. **No FK relationships** — every table has "No foreign keys"
3. **Duplicated goal progress**: `campaign_progress` table + `campaigns.current_goal_value`/`goal_progress_percent`/`goal_status` columns + `aggregate-campaign-goals` function
4. **Score sprawl**: `execution_score`, `velocity_score`, `strategy_strength_score`, `goal_progress_percent`, `predict-score`, `goal_fulfillment_score`, content `confidence_level`

## Approach decision

Full table merger of drafts→linkedin_posts→post_plans into one `posts` table = catastrophic blast radius (~30+ files, every edge function, every page). Will break the running app.

**Safer, mature approach**: Introduce a **canonical `posts` table** as the new source of truth, but implement it as a **unifying layer** rather than nuking existing tables. Keep `drafts`/`linkedin_posts`/`campaign_post_plans` as **support/historical tables** that write-through to `posts`. Migrate reads incrementally.

This matches the user's exact wording: *"Decide whether drafts and linkedin_posts become states of posts or remain support tables only"* → **support tables**.

## Plan

<lov-plan>

# Phase 1 — Foundation Fix

Goal: stop the data-model sprawl without nuking the running app. Introduce a **canonical `posts` table**, formalize **FK relationships**, collapse **goal progress** to one source of truth, and reduce **scores** to one primary per object.

---

## 1. Canonical `posts` table (new source of truth)

Create `public.posts` — every "post-like" thing in the system gets one row here, regardless of which tab it lives on.

```
posts
├── id (uuid, pk)
├── user_id (uuid)
├── campaign_id (uuid, fk → campaigns)
├── week_plan_id (uuid, fk → campaign_week_plans, nullable)
├── post_plan_id (uuid, fk → campaign_post_plans, nullable)  -- back-pointer
├── lifecycle_state (enum: idea | drafted | scheduled | posted | missed | archived)
├── content (text)               -- final body
├── hook, cta, format, hook_type, cta_type, tone, post_style
├── planned_date, scheduled_at, posted_at
├── linkedin_post_url, linkedin_post_id (string)
├── source (manual | generated | imported)
├── primary_score (numeric)      -- ONE score per post (see §4)
├── primary_score_kind (text)    -- 'predicted' before posting, 'actual' after
├── created_at, updated_at
```

**Decision (per the user's checklist):**
- `drafts` → **support table** (kept for backwards-compat + historical idea→draft trail). Every new draft also writes a row to `posts` with `lifecycle_state = 'drafted'`.
- `linkedin_posts` → **support table** (kept for raw imports + LinkedIn metadata). Every published post also lives in `posts` with `lifecycle_state = 'posted'`.
- `campaign_post_plans` → stays as the **plan/slot** entity (the "calendar" object). Gets a `post_id` FK pointing to its realized `posts` row.

This gives one queryable surface (`posts`) without breaking 30 files on day one.

---

## 2. FK relationships (currently zero)

Add real foreign keys so the data graph is enforced:

```
campaigns.id
  ← campaign_week_plans.campaign_id
      ← campaign_post_plans.week_plan_id, .campaign_id
          ← posts.post_plan_id, .campaign_id, .week_plan_id

campaigns.id
  ← campaign_progress.campaign_id  (will be removed in §3)
  ← campaign_strategy_versions.campaign_id
  ← campaign_blueprints.campaign_id

posts.id
  ← post_metrics.post_id           (NEW — replaces .linkedin_post_id)
  ← post_context.post_id           (NEW — replaces .linkedin_post_id)
  ← goal_evaluations.post_id       (NEW)
  ← content_tags.post_id           (NEW)

drafts.id          ← posts.draft_id (back-link, nullable)
linkedin_posts.id  ← posts.linkedin_post_ref_id (back-link, nullable)
```

All FKs `ON DELETE` set to `SET NULL` for back-links, `CASCADE` for owned children (metrics, context).

---

## 3. One source of truth for campaign progress

**Today (duplicated):**
- `campaign_progress` table (per-metric rows)
- `campaigns.current_goal_value` + `goal_progress_percent` + `goal_status` + `unattributed_goal_value`
- `aggregate-campaign-goals` function recomputes both

**After:**
- **Source of truth = `campaigns` columns** (`current_goal_value`, `goal_progress_percent`, `goal_status`, `unattributed_goal_value`).
- `campaign_progress` → **deprecate**: keep table for now (in case any read still hits it), stop writing to it from `aggregate-campaign-goals`. Mark for removal in Phase 2.
- All goal math flows through one path: `post_metrics.goal_contribution` → SUM → `+ unattributed_goal_value` → `campaigns.current_goal_value`. No client-side recomputation.

A single helper `lib/campaign-progress.ts` exports `getCampaignProgress(campaignId)` that **only reads from `campaigns`**. Deletes any client code that re-derives it.

---

## 4. One primary score per object

**Today (7 scores):**
| Object | Scores currently stored |
|---|---|
| Campaign | `execution_score`, `velocity_score`, `strategy_strength_score`, `goal_progress_percent` |
| Post | `predict-score` output, `goal_fulfillment_score`, `goal_evaluations.goal_fulfillment_score` |
| Pattern | `confidence_level` |

**After (one primary + breakdown JSON):**

```
campaigns.primary_score         numeric   -- 0–100, the headline number
campaigns.primary_score_kind    text      -- 'execution' | 'goal' | 'velocity' depending on lifecycle
campaigns.score_breakdown       jsonb     -- { goal:50, execution:30, velocity:20, ... } (explainable)

posts.primary_score             numeric   -- 0–100
posts.primary_score_kind        text      -- 'predicted' | 'actual'
posts.score_breakdown           jsonb
```

The 4 legacy campaign score columns + post evaluation scores stay for now (write-through), but **only `primary_score` is read by UI**. A single `lib/scoring.ts` module exposes `getCampaignScore()` and `getPostScore()` and is the only place that knows the formula.

---

## 5. Migration & rollout strategy (zero-downtime)

**Step A — Schema migration** (one SQL migration):
1. Create `posts` table + enums.
2. Add FK columns + constraints.
3. Add `primary_score` / `primary_score_kind` / `score_breakdown` to `campaigns` and `posts`.
4. Backfill `posts` from existing `drafts` ∪ `linkedin_posts` ∪ `campaign_post_plans` so the canonical table is populated for existing data.
5. Backfill `primary_score` from existing scores (use `execution_score` for campaigns, `predict-score` cached value or `goal_fulfillment_score` for posts).

**Step B — Write-through layer** (edge functions):
- Update `generate-content`, `optimize-post`, `rewrite-post`, `evaluate-post-signal`, `aggregate-campaign-goals`, `execution-tick`, `MarkPostedDialog` to **also write to `posts`** whenever they touch `drafts` / `linkedin_posts` / `campaign_post_plans`.
- New helper `supabase/functions/_shared/posts-sync.ts` centralizes the write-through.

**Step C — Read migration** (incremental, this PR scope):
- Migrate 4 high-traffic reads to `posts`:
  1. `CampaignPlanPage` — post list per week → reads `posts` joined to `campaign_post_plans`.
  2. `DraftsPage` — list → reads `posts` where `lifecycle_state in ('drafted','scheduled')`.
  3. `PerformancePage` — list → reads `posts` where `lifecycle_state = 'posted'`.
  4. `aggregate-campaign-goals` — sums from `posts` joined to `post_metrics`.
- All other reads keep working against legacy tables (write-through keeps them in sync). Migrated incrementally in Phase 2.

**Step D — Score consolidation** (this PR scope):
- New `src/lib/scoring.ts` — single formula owner.
- `CampaignPlanPage` hero, `StrategyPage` campaign cards, `ScoreBreakdownCard`, `PostCard` prediction badge → all switch to `primary_score`.
- Old score columns remain populated for one release (rollback safety), then dropped in Phase 2.

---

## 6. Files touched

**Migrations (new):**
- `phase1_canonical_posts.sql` — table + enum + FKs + backfill
- `phase1_score_consolidation.sql` — primary_score columns + backfill
- `phase1_progress_consolidation.sql` — drop writes to `campaign_progress` (keep table)

**New code:**
- `src/lib/posts.ts` — typed accessor for the canonical table
- `src/lib/scoring.ts` — single scoring source
- `src/lib/campaign-progress.ts` — single progress source
- `supabase/functions/_shared/posts-sync.ts` — write-through helper

**Modified (read paths in this PR):**
- `src/pages/CampaignPlanPage.tsx`
- `src/pages/DraftsPage.tsx`
- `src/pages/PerformancePage.tsx`
- `src/pages/StrategyPage.tsx` (score field swap)
- `src/components/campaign/ScoreBreakdownCard.tsx`
- `src/components/campaign/CampaignPostCard.tsx`
- `src/components/campaign/CampaignGoalProgressCard.tsx`

**Modified (write paths — write-through):**
- `supabase/functions/generate-content/index.ts`
- `supabase/functions/optimize-post/index.ts`
- `supabase/functions/aggregate-campaign-goals/index.ts`
- `supabase/functions/execution-tick/index.ts`
- `supabase/functions/evaluate-post-signal/index.ts`
- `src/components/strategy/MarkPostedDialog.tsx`
- `src/components/create/PostCard.tsx` (saveDraft)

**Untouched in Phase 1** (intentionally — to keep blast radius safe):
- Competitor system, advisor questions, market context, business profile, audience personas — already isolated, fine as-is.

---

## 7. What the user gets after Phase 1

| Before | After |
|---|---|
| 4 tables for "post" | 1 canonical `posts` + 3 support tables |
| 0 foreign keys | Enforced graph: campaign → week → plan → post → metrics |
| Goal progress in 3 places | One source: `campaigns.*` columns, one helper |
| 7 competing scores per surface | 1 `primary_score` per object + explainable `score_breakdown` |
| Client recomputes scores/progress | Single server-side source, client just reads |

**Risk profile:** Low. Write-through keeps every existing read working. Reads migrated incrementally. Old columns kept for rollback.

**Out of scope (Phase 2):** dropping legacy score columns, removing `campaign_progress` table, full read migration of remaining pages, event log (`campaign_events`), automated LinkedIn metric ingestion.

