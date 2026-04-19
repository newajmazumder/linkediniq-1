
## Plan: Confidence, Hierarchy, and Causal Action Layer

The product is loud right now — every section claims top priority. This pass tightens **three things**: trust the projection, collapse the page into a strict 4-layer hierarchy, and make every recommendation/execution number tied to the goal.

### 1. Add a confidence layer to projections (stop the lying)

Update `src/lib/campaign-projection.ts`:
- Add `confidence: "low" | "medium" | "high"` derived from: posts with metrics, days elapsed, contribution variance.
  - `< 3 posted with metrics` OR `timeProgressPct < 10%` → **low** → suppress `expectedAtEnd`, only show "Need 3+ posts to project".
  - `3–5 posts` → medium → show projection with band (`±30%`).
  - `≥ 6 posts` and `≥ 25% time elapsed` → high.
- Add `stable: boolean` flag. When `false`, `CampaignProjectionCard` renders a calm "Projection unstable — based on N posts only" instead of a hard number.
- Cap displayed `expectedAtEnd` at `target × 3` even when stable, so we never print "1047/100".

### 2. Collapse the page into a strict 4-layer hierarchy

Edit `src/pages/CampaignPlanPage.tsx` — remove the three "OUTCOME / EXECUTION / INTELLIGENCE" eyebrow labels and the giant zone gaps. New structure:

```text
HERO (status whisper + score, unchanged but trimmed)

L1 · ALWAYS VISIBLE        → Goal progress bar + Projection + Status pill
L2 · EXECUTION (1 card)    → ExecutionDashboard, but slim
L3 · DO THIS NOW (1 card)  → top 1–3 impact-driven actions only
L4 · DEEP ANALYSIS         → Tabs (Plan / Analytics / Report) collapsed by default
```

- `ScoreBreakdownCard` moves **inside L4** behind a "Why this score" disclosure; it is no longer always-on.
- `RawToGoalInsight` and `PostContributionTable` stay in the Analytics tab (already correct).
- Remove the duplicate "Goal · Execution · Velocity" mini-strip from the hero — it repeats L1.

### 3. Add a "Top Performer" card to L1

New tiny component `src/components/campaign/TopPerformerCard.tsx`:
- Picks the top contributor from `goalAgg.contribution_rows`.
- Shows: post number, contribution count + `% of total`, hook + CTA (read from `post_signals`/`campaign_post_plans`), and a single "Replicate this" button → `/create?campaign_id=…&clone=postN`.
- Hidden when no posts have contributions yet.

### 4. Connect execution → outcome (kill the disconnect)

In `ExecutionDashboard.tsx`:
- Replace the "Predicted outcome" tile copy with a causal sentence:  
  `At current pace → 22 / 100 bookings · need 4 posts/wk to hit target` (computed: `requiredVelocityToHit = (target - current) / daysRemaining * 7 / avgContributionPerPost`).
- "Do this now" list items become impact-tagged: each fix gets `→ +X expected` when we can derive it; otherwise stays plain.

### 5. Convert adaptive recommendations to commands

In `supabase/functions/campaign-adapt/index.ts` — tighten the prompt to force the AI to return objects shaped as:
```json
{ "where": "Post 3", "what": "Rewrite headline using Financial-loss hook",
  "why": "Posts 1 & 4 with this hook drove 71% of bookings",
  "expected_impact": "+2–4 bookings" }
```
Render in `ExecutionDashboard` as a single dense line per item: bold `where → what`, muted `why`, accent `expected impact`. No more abstract "tip" tone.

### 6. Strategy Flow → performance funnel

In the Plan tab week list (`CampaignPlanPage`), each phase row gains two inline numbers next to the existing `drafted/total`:
- `Bookings: N` (sum of `goal_contribution` for posts in that week, from `goalAgg.contribution_rows` joined by `week_number`).
- Color stays neutral; just two extra tabular-nums cells.

### 7. Visual polish (minimalist hierarchy, no new colors)

- Bigger numbers where it matters: goal `current`, projected `expected`, velocity `actual` → bump to `text-3xl`/`text-4xl tabular-nums`.
- Drop the existing `bg-emerald/yellow/destructive` *fill* tints on `CampaignProjectionCard`; replace with a thin 2px left border + tone color on the verdict text only. Inside stays neutral `bg-card`. Same treatment for the trajectory meta in `campaign-projection.ts` — keep `tone` text class but neutralize `bg`.
- Add one urgency micro-line under the hero status pill **only** when behind: `3.7 posts/wk behind → projected 78% shortfall`.

### 8. Files

**Edit**:
- `src/lib/campaign-projection.ts` — confidence + stability + cap.
- `src/components/campaign/CampaignProjectionCard.tsx` — render unstable state, neutralize backgrounds, bigger numbers.
- `src/pages/CampaignPlanPage.tsx` — restructure into L1/L2/L3/L4, move `ScoreBreakdownCard` into a disclosure, remove duplicate goal strip in hero, add `TopPerformerCard` + funnel numbers in week rows, urgency micro-line.
- `src/components/strategy/ExecutionDashboard.tsx` — causal "predicted outcome" copy + required velocity, command-style adaptation rendering.
- `supabase/functions/campaign-adapt/index.ts` — tighten prompt to `where/what/why/expected_impact` schema.

**New**:
- `src/components/campaign/TopPerformerCard.tsx` — replicate-the-winner card.

### 9. Out of scope

- No new tables; everything reads from existing `goalAgg` + `post_signals`.
- No theme changes; sticking with current neutral palette + accent text only.
- "Learning memory across campaigns" — defer.
