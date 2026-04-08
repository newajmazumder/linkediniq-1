

# LinkedInIQ Intelligence Upgrade — Implementation Plan

## What Already Exists

| Capability | Status | Location |
|---|---|---|
| Pre-publish scoring (4 dimensions + risk + suggestions) | Done | `predict-score`, DraftsPage |
| Pattern learning (hook/tone/style/intent/cta/length/time) | Done | `learn-patterns`, `content_patterns` |
| Performance intelligence in generation | Done | `generate-content` (patterns block) |
| Goal-aware context filtering | Done | `generate-content` (GOAL_CATEGORY_PRIORITIES) |
| Pattern-aware diagnostics in analysis | Done | `analyze-post` |
| Distribution intelligence (word count, publish hour) | Done | `learn-patterns` |
| Strategy recommendations | Done | `recommend-next`, Dashboard, StrategyPage |

## What Needs Enhancement

### 1. Predict-Score: Deeper Output
**Current:** 4 scoring dimensions, generic suggestions.
**Upgrade:** Add `cta_alignment` and `context_relevance` dimensions, `strongest_element`, `weakest_element`, `failure_reasons[]`, `improved_hooks[]`, `improved_ctas[]`, `publish_recommendation` (publish/revise/not_recommended).

**Changes:**
- `supabase/functions/predict-score/index.ts` — expand prompt to request 6 dimensions + causal failure reasons + hook/CTA alternatives + publish recommendation
- `prediction_scores` table — migration to add `cta_alignment`, `context_relevance`, `strongest_element`, `weakest_element`, `failure_reasons`, `improved_hooks`, `improved_ctas`, `publish_recommendation` columns
- `src/pages/DraftsPage.tsx` — render expanded score card with 6 dimensions, strongest/weakest badges, failure reasons, hook/CTA suggestions, publish recommendation badge

### 2. Pattern Learning: Confidence + Comparative Intelligence
**Current:** Patterns aggregated by single dimension, no confidence, no cross-dimensional comparison.
**Upgrade:** Add confidence level per pattern. Add comparative statements ("X outperforms Y by Z% for persona W"). Store persona-specific and goal-specific intelligence profiles.

**Changes:**
- `content_patterns` table — migration to add `confidence_level` (text: low/medium/high) and `comparative_insight` (text) columns
- `supabase/functions/learn-patterns/index.ts` — compute confidence based on sample_count (1-2=low, 3-5=medium, 6+=high), generate comparative insights via AI ("pain_driven outperforms curiosity by 2.1x"), add persona-dimension and goal-dimension cross-aggregation
- `src/pages/AnalyticsPage.tsx` — show confidence badges on pattern cards, add comparative insights section, add persona intelligence profiles and goal intelligence profiles sections

### 3. Generation: Visible Learning Influence
**Current:** Patterns injected into prompt but not surfaced to user.
**Upgrade:** Return `generation_influences` per post explaining what the system intentionally repeated, avoided, or tested.

**Changes:**
- `supabase/functions/generate-content/index.ts` — add `generation_influences` to output schema (what_repeated, what_avoided, what_tested)
- `src/components/create/PostCard.tsx` — render generation_influences section alongside existing context_rationale

### 4. CTA Intelligence
**Current:** CTA type tracked but not deeply analyzed for alignment.
**Upgrade:** Predict-score explicitly evaluates CTA-goal mismatch. Learn-patterns tracks CTA effectiveness per goal and persona.

**Changes:**
- Already partially covered by predict-score upgrade (cta_alignment dimension)
- `supabase/functions/learn-patterns/index.ts` — add cross-dimension: CTA×goal and CTA×persona aggregation

### 5. Audience Page: Persona Intelligence Profiles
**Current:** Static persona definitions.
**Upgrade:** Show dynamic intelligence profile per persona (best hook, best style, best CTA, weak patterns).

**Changes:**
- `src/pages/AudiencePage.tsx` — fetch `content_patterns` filtered by persona_id, render "What works for this persona" card with best/worst patterns and confidence

### 6. Dashboard: Smarter "What to Post Next"
**Current:** Shows recommendation topic + tags + reason.
**Upgrade:** Add recommendation_type (exploit/fix/experiment), supporting_pattern, and past_evidence fields.

**Changes:**
- `supabase/functions/recommend-next/index.ts` — add recommendation_type and supporting_pattern to output schema
- `src/pages/DashboardPage.tsx` — show exploit/fix/experiment badge and pattern evidence per recommendation

## Database Migration

```sql
-- Expand prediction_scores
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS cta_alignment integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS context_relevance integer DEFAULT 0;
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS strongest_element text;
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS weakest_element text;
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS failure_reasons jsonb DEFAULT '[]';
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS improved_hooks jsonb DEFAULT '[]';
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS improved_ctas jsonb DEFAULT '[]';
ALTER TABLE prediction_scores ADD COLUMN IF NOT EXISTS publish_recommendation text DEFAULT 'revise';

-- Expand content_patterns
ALTER TABLE content_patterns ADD COLUMN IF NOT EXISTS confidence_level text DEFAULT 'low';
ALTER TABLE content_patterns ADD COLUMN IF NOT EXISTS comparative_insight text;
```

## Implementation Order

**Phase 1: Enhanced Pre-Publish Scoring**
- Migration for prediction_scores columns
- Upgrade predict-score prompt + output parsing + DB insert
- Upgrade DraftsPage score card UI

**Phase 2: Enhanced Pattern Learning**
- Migration for content_patterns columns
- Upgrade learn-patterns with confidence logic + comparative insights + cross-dimensional aggregation
- Upgrade AnalyticsPage with confidence badges + comparisons

**Phase 3: Persona & Goal Intelligence**
- Add persona intelligence profiles to AudiencePage
- Add goal intelligence section to AnalyticsPage
- Upgrade recommend-next with exploit/fix/experiment classification

**Phase 4: Visible Generation Intelligence**
- Add generation_influences to generate-content output
- Update PostCard to display what was repeated/avoided

## Files Modified

- `supabase/functions/predict-score/index.ts` — expanded prompt + output
- `supabase/functions/learn-patterns/index.ts` — confidence + comparative + cross-dimension
- `supabase/functions/generate-content/index.ts` — generation_influences output
- `supabase/functions/recommend-next/index.ts` — recommendation_type field
- `src/pages/DraftsPage.tsx` — expanded score card
- `src/pages/AnalyticsPage.tsx` — confidence, comparisons, persona/goal profiles
- `src/pages/AudiencePage.tsx` — persona intelligence cards
- `src/pages/DashboardPage.tsx` — exploit/fix/experiment badges
- `src/components/create/PostCard.tsx` — generation influences display
- New migration for schema changes

