

# LinkedInIQ → Self-Learning Content Intelligence System

## System Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                         UI LAYER                                 │
│  CreatePage (enhanced) │ Analytics (enhanced) │ Strategy (new)   │
│  Dashboard (enhanced)  │ Drafts (pre-publish scoring)            │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────┐
│                      5 ENGINE LAYER                              │
│                                                                  │
│  1. Content Engine        → generate-content (exists, enhance)   │
│  2. Performance Engine    → post_performance + content_tags      │
│  3. Learning Engine (NEW) → content_patterns table + learn fn    │
│  4. Prediction Engine     → predict-score edge function          │
│  5. Strategy Engine (NEW) → recommend-next edge function         │
└────────────┬────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
│  content_tags │ content_patterns │ strategy_recommendations      │
│  (existing tables: posts, drafts, post_performance, etc.)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Data Model — New Tables

### `content_tags` — structured tagging for every published post
Bridges drafts/posts to tagged metadata for learning.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| draft_id | uuid | nullable, FK |
| post_id | uuid | nullable, FK to posts |
| linkedin_post_id | uuid | nullable, FK |
| hook_type | text | curiosity, contrarian, pain_driven, data_bold |
| tone | text | authoritative, emotional, conversational, etc. |
| content_type | text | story, list, framework, hybrid, product_insight |
| post_style | text | founder_story, educational, etc. |
| content_intent | text | Awareness, Education, Trust, Product, Lead |
| persona_id | uuid | nullable |
| campaign_id | uuid | nullable |
| topic | text | free text topic label |
| cta_type | text | soft, medium, hard |
| goal | text | engagement, profile_visits, leads, authority |
| created_at | timestamptz | |

### `content_patterns` — learned performance patterns
Aggregated by the Learning Engine, stores what works.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| dimension | text | hook_type, tone, content_type, persona, topic, cta_type |
| dimension_value | text | e.g. "curiosity", "authoritative" |
| sample_count | int | number of posts with this tag |
| avg_impressions | float | |
| avg_engagement_rate | float | |
| avg_likes | float | |
| avg_comments | float | |
| best_combination | jsonb | e.g. {"tone": "emotional", "hook": "pain_driven"} |
| insight | text | AI-generated insight sentence |
| updated_at | timestamptz | |

### `strategy_recommendations` — "what to post next" outputs
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| recommendation | jsonb | {topic, hook_type, tone, persona_id, content_type, cta_type, reason} |
| gap_analysis | jsonb | {underused_hooks, underused_personas, missing_topics} |
| confidence | float | 0-1 |
| status | text | pending, used, dismissed |
| created_at | timestamptz | |

### `prediction_scores` — pre-publish scores for drafts
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | |
| draft_id | uuid | or post_id |
| hook_strength | int | 0-100 |
| persona_relevance | int | 0-100 |
| clarity | int | 0-100 |
| goal_alignment | int | 0-100 |
| predicted_score | int | 0-100 overall |
| risk_level | text | low, medium, high |
| suggestions | jsonb | array of improvement suggestions |
| historical_comparison | text | "Similar posts averaged X engagement" |
| created_at | timestamptz | |

---

## 2. Learning Logic

**How the system learns:**

1. When a user saves performance metrics (impressions, likes, comments) for a posted draft, the system auto-tags it using `content_tags` (pulled from the original `posts` table metadata: hook_type, tone, post_style, persona_id, campaign_id, content_intent).

2. The **Learning Engine** (`learn-patterns` edge function) runs when:
   - User triggers "Generate Insights" in Analytics
   - Automatically after 5+ new performance entries

3. It aggregates `content_tags` + `post_performance` to compute `content_patterns`:
   - Group by each dimension (hook_type, tone, content_type, persona, topic)
   - Calculate avg metrics per group
   - Find best-performing combinations
   - Call AI to generate natural-language insights

4. Patterns are stored in `content_patterns` and used by both the Prediction and Strategy engines.

**Learning feedback loop:**
```text
Generate → Publish → Track Performance → Tag Content → Aggregate Patterns
    ↑                                                          │
    └──────── Feed patterns into generation + scoring ─────────┘
```

---

## 3. Prediction Logic (Pre-Publish Scoring)

New edge function: `predict-score`

**Input:** draft content + metadata (hook, tone, persona, campaign, goal)

**Process:**
1. Fetch user's `content_patterns` from DB
2. Fetch `business_profiles` for context alignment check
3. Send to AI with:
   - The draft content
   - Historical patterns ("curiosity hooks avg 5.2% engagement for you, contrarian avg 3.1%")
   - Business context (differentiators, priorities)
   - Persona details
4. AI returns structured scores

**Output:**
```json
{
  "predicted_score": 78,
  "hook_strength": 82,
  "persona_relevance": 75,
  "clarity": 85,
  "goal_alignment": 70,
  "risk_level": "low",
  "historical_comparison": "Similar curiosity-hook posts for this persona averaged 4.8% engagement",
  "suggestions": [
    "Your pain-driven hooks outperform curiosity hooks by 40% for this persona — consider switching",
    "Add a specific proof point from your business context to boost credibility"
  ]
}
```

**UI integration:** Add a "Score before publishing" button on DraftsPage for approved drafts.

---

## 4. Strategy Logic (What to Post Next)

New edge function: `recommend-next`

**Input:** user_id (uses all their data)

**Process:**
1. Fetch `content_patterns`, `content_tags` (recent posts), `campaigns`, `personas`, `business_profiles`
2. Perform gap analysis:
   - Which hook types haven't been used recently?
   - Which personas are underserved?
   - Which topics haven't been covered?
   - Which high-performing combinations haven't been repeated?
3. Cross-reference with active campaign goals
4. AI generates 3 ranked recommendations

**Output:**
```json
{
  "recommendations": [
    {
      "topic": "How Chattrn reduces support tickets by 60%",
      "hook_type": "data_bold",
      "tone": "authoritative",
      "persona": "ecommerce_ops_manager",
      "content_type": "framework",
      "cta_type": "medium",
      "reason": "Data-bold hooks perform 2x better for this persona. You haven't posted a framework post in 2 weeks. This aligns with your current 'reduce churn' campaign."
    }
  ],
  "gap_analysis": {
    "underused_hooks": ["data_bold"],
    "underused_personas": ["enterprise_buyer"],
    "missing_topics": ["customer success stories"],
    "overused": ["curiosity hooks — 70% of recent posts"]
  }
}
```

**UI:** New "What to Post Next" card on Dashboard + dedicated section in Strategy page.

---

## 5. Gap Analysis — Current vs Required

| Capability | Current State | Required | Gap |
|---|---|---|---|
| Content tagging | Stored on `posts` table (hook_type, tone, post_style) but not linked to performance | Unified `content_tags` linked to performance | **Need bridge table** |
| Performance tracking | Manual input on `post_performance` (impressions, likes, comments only) | Same + saves, profile visits, auto-tagging | **Add fields + auto-tag on save** |
| Pattern learning | AI analyzes raw data each time (no persistence) | Persistent `content_patterns` updated incrementally | **New table + edge function** |
| Pre-publish scoring | `score-posts` exists but scores in isolation, no historical context | Score using learned patterns + business context | **New `predict-score` function** |
| Strategy recommendations | None | AI-driven "what to post next" with gap detection | **New engine entirely** |
| A/B tracking | None | Compare hook/tone/style variants with performance | **Add to learning engine** |
| Content calendar suggestions | Calendar page exists but is empty | Suggest posting schedule based on patterns | **Phase 5** |
| Auto-tagging | None — tags come from generation only | Auto-tag imported/manual posts too | **Add to performance save flow** |

---

## 6. Phased Implementation Plan

### Phase 1: Learning Foundation (Priority)
**New tables:** `content_tags`, `content_patterns`
**New edge function:** `learn-patterns` — aggregates tags + performance into patterns
**UI changes:**
- Auto-populate `content_tags` when performance is saved (pull from `posts` table metadata)
- Show learned patterns in Analytics page (replace current AI-only insights with persistent patterns + AI layer)
- Add "saves" and "profile_visits" fields to `post_performance`

### Phase 2: Pre-Publish Intelligence
**New table:** `prediction_scores`
**New edge function:** `predict-score` — scores drafts using learned patterns + business context
**UI changes:**
- Add "Predict Performance" button on DraftsPage (for approved drafts)
- Show score card with breakdown + suggestions
- Show historical comparison ("posts like this averaged X%")

### Phase 3: Strategy Engine
**New table:** `strategy_recommendations`
**New edge function:** `recommend-next` — gap analysis + recommendations
**UI changes:**
- "What to Post Next" card on Dashboard
- Strategy page: add "Recommendations" tab showing AI suggestions with gap analysis
- One-click "Generate from recommendation" → pre-fills CreatePage

### Phase 4: Experimentation System
**No new tables** — uses `content_patterns` grouping
**UI changes:**
- Analytics page: "Experiments" section comparing A vs B dimensions (e.g., curiosity vs pain hooks)
- Visualize win rates per dimension
- Suggest experiments ("You haven't tried contrarian + educational combo")

### Phase 5: Automation Layer
- Auto-suggest posting frequency based on engagement decay patterns
- Calendar page: AI-populated content calendar
- Optional: auto-generate drafts from strategy recommendations on a schedule

---

## Technical Notes

- All new edge functions use `LOVABLE_API_KEY` + Lovable AI gateway (Gemini Flash for speed, Gemini Pro for strategy)
- `content_tags` auto-populated from existing `posts` metadata — no manual tagging needed
- `content_patterns` is a materialized view concept — rebuilt on each learn cycle, not real-time
- All new tables get standard RLS (`auth.uid() = user_id`)
- The learning engine is additive — more data = better patterns, but works from day 1 with even 3-5 posts

