

# Unified Scoring System — Fix Score Confusion

## The Problem

Two independent AI scoring systems produce conflicting results:

1. **Post Score** (`score-posts` function): Generic B2B content quality score using 4 dimensions (hook_strength, clarity, business_relevance, engagement_potential). No persona, goal, campaign, or historical pattern awareness. Just "is this a decent LinkedIn post?"

2. **Predictive Score** (`predict-score` function): Deep contextual score using 6 dimensions + persona + goal + campaign + historical patterns + business context. Answers "will this post achieve YOUR specific goal for YOUR specific audience?"

A post can score 91 on generic quality but 78 on strategic fit — because the content is well-written but the CTA is misaligned with the campaign goal, or the hook type underperforms for the selected persona.

## Solution

**Eliminate the shallow `score-posts` system entirely.** Replace it with `predict-score` which already does everything `score-posts` does, plus much more. This gives users one score to trust.

### Changes

**1. Remove `score-posts` edge function**
- Delete `supabase/functions/score-posts/index.ts`
- It is redundant — `predict-score` already evaluates hook strength, clarity, and engagement potential with far more context

**2. Update `PostCard.tsx`**
- Remove the `PostScore` type and the old score display (the "91" badge)
- Make the existing `predict-score` inline call the ONLY scoring mechanism
- Show the `predicted_score` as the single post score
- Show a small publish readiness badge next to the score: ✅ Ready / ⚠️ Revise / ❌ Not Recommended
- Keep the expandable detailed breakdown (6 dimensions, strongest/weakest, failure reasons, improved hooks/CTAs)

**3. Update `CreatePage.tsx`**
- Remove the call to `score-posts` that currently runs after generation
- Instead, auto-trigger `predict-score` for each generated variation (or keep it on-demand via the 📊 button to avoid latency)
- Remove any references to the old `PostScore` type

**4. Add score interpretation labels**
- Show what the score means in plain language:
  - 80-100: "Strong — ready to publish"
  - 60-79: "Decent — review suggestions before publishing"  
  - 40-59: "Weak — significant revision needed"
  - 0-39: "Not recommended — rethink approach"
- Display this label next to the score so users immediately understand the verdict

**5. Update `DraftsPage.tsx`**
- Already uses `predict-score` — no structural change needed
- Ensure the same interpretation labels are shown for consistency

### What the user sees after this change

- **One score per post** (the contextual predictive score)
- **One clear verdict** (Ready / Revise / Not Recommended)
- **Transparent reasoning** (strongest element, weakest element, failure reasons)
- **Actionable fixes** (improved hooks, improved CTAs, specific suggestions)
- No more confusion between two disconnected numbers

### Technical Details

| File | Change |
|---|---|
| `supabase/functions/score-posts/index.ts` | Delete |
| `src/components/create/PostCard.tsx` | Remove `PostScore` type, remove old score display, show `predicted_score` as primary score with readiness badge and interpretation label |
| `src/pages/CreatePage.tsx` | Remove `score-posts` invocation, remove old score state, keep predict-score on-demand via 📊 button |
| `src/pages/DraftsPage.tsx` | Add same interpretation labels for consistency |

No database migration needed — `predict-score` already stores everything required.

