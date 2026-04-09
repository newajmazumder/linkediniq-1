

# Campaign Intelligence System — Implementation Plan

## What Already Exists

| Capability | State |
|---|---|
| Campaigns | Table with goal, personas, CTA, tone, style mix, measurable targets (objective, metric, quantity, timeframe, priority), progress tracking |
| Content generation | `generate-content`: persona-aware, campaign-aligned, outcome-strategy-aware, supports text/image/carousel |
| Pre-publish scoring | `predict-score`: 6 dimensions + outcome probability + stage breakdown + weak stage |
| Pattern learning | `learn-patterns`: outcome-segmented patterns with confidence levels |
| Recommendations | `recommend-next`: exploit/fix/experiment with gap analysis |
| Campaign progress | `campaign_progress` table with current vs target values, gap analysis |
| Auto-optimization | `optimize-post`: revision pass based on prediction weaknesses |
| Business context | Full profile with product, differentiators, proof points, pain points |
| Personas | Awareness levels, pain points, goals, objections, buying triggers |

## What Needs to Be Built

### Phase 1: Conversational Campaign Builder

**New tables:**

```sql
CREATE TABLE campaign_blueprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid,
  conversation_id uuid,
  campaign_summary jsonb DEFAULT '{}',
  business_rationale jsonb DEFAULT '{}',
  audience_summary jsonb DEFAULT '{}',
  messaging_strategy jsonb DEFAULT '{}',
  cta_strategy jsonb DEFAULT '{}',
  content_strategy jsonb DEFAULT '{}',
  success_model jsonb DEFAULT '{}',
  ai_recommendations jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blueprint_id uuid,
  messages jsonb DEFAULT '[]',
  current_step text DEFAULT 'goal',
  collected_data jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**New edge function:** `supabase/functions/campaign-strategist/index.ts`
- Accepts conversation messages + current step + collected data
- Steps: goal → targets → structure → audience → product → style → blueprint
- At each step, AI asks smart follow-up questions based on prior answers
- Challenges weak inputs (unrealistic targets, vague pain points, mismatched CTAs)
- After final step, generates a structured Campaign Blueprint
- Creates the campaign record + blueprint record
- Uses business profile + personas as context for smarter questions

**New page:** `src/pages/CampaignBuilderPage.tsx`
- Chat-style conversational UI on left, live blueprint preview on right
- Step indicator showing progress through the 6 steps
- Each AI message includes structured question prompts (not free-text only)
- User can type answers or select from suggested options
- After completion, shows full blueprint with "Create Campaign" button
- Alternative: "Skip to form" link goes to existing Strategy page form

**New route:** `/campaign/new` in App.tsx

**Updated:** `src/pages/StrategyPage.tsx`
- Add "Create with AI Strategist" button alongside existing "New Campaign"
- Campaign cards link to their blueprint view
- Add blueprint tab on each campaign

### Phase 2: Weekly Plan + Post Roadmap

**New tables:**

```sql
CREATE TABLE campaign_week_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  blueprint_id uuid,
  week_number integer NOT NULL,
  weekly_goal text,
  primary_message text,
  audience_lens text,
  recommended_post_count integer DEFAULT 2,
  recommended_formats jsonb DEFAULT '[]',
  hook_styles jsonb DEFAULT '[]',
  cta_strategy text,
  week_purpose text,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE campaign_post_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  week_plan_id uuid,
  post_number integer NOT NULL,
  week_number integer NOT NULL,
  post_objective text,
  content_angle text,
  recommended_format text DEFAULT 'text',
  suggested_hook_type text,
  suggested_tone text,
  suggested_cta_type text,
  strategic_rationale text,
  linked_draft_id uuid,
  linked_post_id uuid,
  status text DEFAULT 'planned',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**New edge function:** `supabase/functions/generate-campaign-plan/index.ts`
- Takes blueprint_id, generates week-by-week plan
- Adapts weekly structure based on objective (awareness campaigns ramp differently than DM campaigns)
- Creates post slots with specific angles, hooks, tones, CTAs, and rationale
- Each post slot explains its role in the campaign sequence

**New page:** `src/pages/CampaignPlanPage.tsx` (route: `/campaign/:id`)
- Campaign hub view: blueprint summary at top
- Week-by-week timeline with expandable cards
- Each week shows its posts with status indicators (planned/drafted/published)
- Click a post slot to go to Create page with that slot pre-loaded
- Progress bar showing posts created vs planned

**Updated:** `src/components/AppSidebar.tsx` — add Campaign nav item or nest under Strategy

### Phase 3: Campaign-Linked Generation

**Updated:** `src/pages/CreatePage.tsx`
- When campaign is selected, fetch its post plan
- Show "Next recommended post" banner with slot info (week, post number, objective, suggested style)
- "Generate for this slot" button pre-fills instruction with the post plan's angle
- After generation, link the draft to the campaign_post_plan slot
- Show campaign stage context: "Week 2, Post 1 — Pain amplification"

**Updated:** `supabase/functions/generate-content/index.ts`
- Accept optional `post_plan_id` parameter
- When provided, fetch the post plan's objective, angle, hook type, tone, CTA
- Inject these as hard constraints into the generation prompt (not just suggestions)
- Add `campaign_stage`, `planned_post_number`, `weekly_objective` to output metadata

**Updated:** `campaign_post_plans` — update status to 'drafted' when draft is created, 'published' when posted

### Phase 4: In-Campaign Analytics

**New table:**

```sql
CREATE TABLE campaign_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  report_type text DEFAULT 'progress',
  health_status text DEFAULT 'on_track',
  posting_progress jsonb DEFAULT '{}',
  outcome_progress jsonb DEFAULT '{}',
  contribution_analysis jsonb DEFAULT '{}',
  stage_performance jsonb DEFAULT '{}',
  cta_performance jsonb DEFAULT '{}',
  weekly_trends jsonb DEFAULT '[]',
  recommendations jsonb DEFAULT '[]',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
```

**New edge function:** `supabase/functions/campaign-analytics/index.ts`
- Takes campaign_id, aggregates all linked posts' performance data
- Calculates: posting cadence adherence, outcome progress vs target, contribution by post
- Determines health status: on_track / at_risk / off_track
- Stage performance breakdown (attention/engagement/action/outcome)
- CTA performance by type
- Week-by-week trends

**New page:** `src/pages/CampaignAnalyticsPage.tsx` (route: `/campaign/:id/analytics`)
- Health overview card (on track / at risk / off track)
- Posting progress (planned vs published vs remaining)
- Outcome progress bar (current vs target)
- Post contribution table (which posts helped most)
- Weekly trend charts
- CTA performance breakdown

### Phase 5: Mid-Campaign Recommendations

**Updated:** `supabase/functions/campaign-analytics/index.ts`
- After computing analytics, generate tactical recommendations
- Classify as: exploit / fix / test / change_cta / change_hook / change_tone / change_format / change_sequence
- Examples: "Reach is low — use stronger hooks in next 2 posts" or "DM target behind — add curiosity-gap post"

**Updated:** Campaign Analytics page — show recommendations section with action buttons
- "Apply to next post" button pre-fills the Create page with the recommendation

### Phase 6: Post-Campaign Report

**New edge function:** `supabase/functions/campaign-report/index.ts`
- Generates a comprehensive intelligence report after campaign ends
- Sections: summary, outcome analysis, best/weakest posts, audience learnings, content learnings, structure learnings, strategic next-campaign recommendations
- Stores in `campaign_reports` with `report_type = 'final'`

**Updated:** Campaign Plan page — when campaign is complete, show "Generate Report" button
- Report view with all sections rendered as cards
- Exportable insights (copy-friendly format)

## Data Model Summary

```text
campaign_blueprints (NEW)
  id, user_id, campaign_id, conversation_id
  campaign_summary, business_rationale, audience_summary
  messaging_strategy, cta_strategy, content_strategy
  success_model, ai_recommendations, status

campaign_conversations (NEW)
  id, user_id, blueprint_id
  messages, current_step, collected_data, status

campaign_week_plans (NEW)
  id, user_id, campaign_id, blueprint_id
  week_number, weekly_goal, primary_message
  audience_lens, recommended_post_count
  recommended_formats, hook_styles, cta_strategy
  week_purpose, status

campaign_post_plans (NEW)
  id, user_id, campaign_id, week_plan_id
  post_number, week_number, post_objective
  content_angle, recommended_format
  suggested_hook_type, suggested_tone, suggested_cta_type
  strategic_rationale, linked_draft_id, linked_post_id
  status

campaign_reports (NEW)
  id, user_id, campaign_id, report_type
  health_status, posting_progress, outcome_progress
  contribution_analysis, stage_performance
  cta_performance, weekly_trends, recommendations
```

## New Files

| File | Phase | Purpose |
|---|---|---|
| `supabase/functions/campaign-strategist/index.ts` | 1 | Conversational AI campaign builder |
| `src/pages/CampaignBuilderPage.tsx` | 1 | Chat-style campaign creation UI |
| `supabase/functions/generate-campaign-plan/index.ts` | 2 | Week/post plan generation |
| `src/pages/CampaignPlanPage.tsx` | 2 | Campaign hub with timeline |
| `supabase/functions/campaign-analytics/index.ts` | 4,5 | Live analytics + recommendations |
| `src/pages/CampaignAnalyticsPage.tsx` | 4 | Analytics dashboard |
| `supabase/functions/campaign-report/index.ts` | 6 | Post-campaign intelligence report |

## Modified Files

| File | Phase | Change |
|---|---|---|
| Migration SQL | 1,2,4 | New tables above |
| `src/App.tsx` | 1,2,4 | New routes |
| `src/components/AppSidebar.tsx` | 1 | Add Campaign nav item |
| `src/pages/StrategyPage.tsx` | 1 | "Create with AI Strategist" button + blueprint links |
| `src/pages/CreatePage.tsx` | 3 | Campaign post plan integration, slot awareness |
| `supabase/functions/generate-content/index.ts` | 3 | Accept post_plan_id, enforce plan constraints |
| `src/pages/DashboardPage.tsx` | 4 | Campaign health summary cards |

## Implementation Order

1. **Phase 1** — Conversational builder + blueprints (foundation)
2. **Phase 2** — Week plans + post roadmap (execution structure)
3. **Phase 3** — Campaign-linked generation (content creation)
4. **Phase 4** — In-campaign analytics (monitoring)
5. **Phase 5** — Mid-campaign recommendations (optimization)
6. **Phase 6** — Post-campaign reporting (learning)

## Risks and Constraints

- **Conversation quality**: The AI strategist's value depends on prompt quality. Must challenge weak inputs rather than just collecting answers.
- **Plan rigidity vs flexibility**: Post plans should guide, not lock. Users must be able to skip/reorder/modify planned posts.
- **Analytics data dependency**: Campaign analytics require manual metric entry or LinkedIn sync. Progress tracking accuracy is limited by available data.
- **AI call volume**: Blueprint generation + plan generation + per-post generation = multiple AI calls per campaign setup. Keep prompts focused to manage latency and cost.
- **Existing campaign migration**: Existing campaigns will not have blueprints or post plans. They continue to work as-is; new features are additive.

