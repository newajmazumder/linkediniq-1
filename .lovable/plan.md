

# Plan: From Competitor Analysis → Exploitation Engine

## Current state (what we already have)
- Per-post AI tagging: `hook_type`, `content_type`, `tone`, `cta_type`, format
- `competitor_insights` with `win_strategy`, `content_gap_matrix`, `content_angles`, `opportunity_scores`, `predicted_outcomes`, `winning_position`, `execution_plan`, `confidence_layer`
- A `BestMoveCard` that picks the top angle and lets users start a 7-day campaign or generate a post

## What's missing (the user's real ask)
1. Posts aren't classified into the **3 strategic moves**: Mirror / Outperform / Oppose
2. No **gap detection across competitors** as a portfolio (only per-competitor)
3. No **"Next Best Post" engine** that fuses (competitor signals + active campaign goal + user's own performance) into one decisive recommendation
4. No **confidence-aware routing** ("if your data is strong → use yours; if weak → use theirs; if both weak → explore")
5. UI is still a **dashboard** (passive). User wants **forced strategic moves** (active)

---

## The build — 4 surgical additions

### 1. Classify every analyzed post with a "strategic move type"
Add to per-post AI prompt in `analyze-competitor/index.ts`:
```
"strategic_move": {
  "recommended_move": "mirror | outperform | oppose",
  "reasoning": "<why this move beats this post>",
  "your_version_hook": "<rewritten hook with the chosen move>",
  "your_version_cta": "<stronger/different CTA>",
  "exploit_target": "<what specific weakness you're exploiting>"
}
```
Surface this as a **colored badge** on each `PostCard` in `CompetitorsPage` (Mirror = blue, Outperform = amber, Oppose = red).

### 2. New edge function: `competitor-exploit-engine`
The brain that answers *"What should I write next?"*

**Inputs** (auto-loaded server-side):
- Active campaign (goal, target metric, current progress %)
- All competitors' posts + per-post analyses for this user
- User's own `content_patterns` (winning hooks/CTAs from their posts)

**Logic (confidence-aware routing):**
```
internalSignalStrength = f(content_patterns sample size + clarity)
competitorSignalStrength = f(posts analyzed + pattern consistency)

IF internalSignalStrength = high  → route = "USE_OWN_PATTERNS"
ELSE IF competitorSignalStrength ≥ medium → route = "EXPLOIT_COMPETITORS"
ELSE → route = "EXPLORE_NEW_ANGLES"
```

**Output (one decisive JSON):**
```json
{
  "next_best_post": {
    "move_type": "outperform",
    "source_post_id": "<competitor post id>",
    "source_competitor": "<name>",
    "why_now": "<ties to campaign goal + competitor weakness>",
    "hook": "<ready-to-use hook>",
    "angle": "<positioning>",
    "cta": "<specific CTA tied to campaign target_metric>",
    "expected_lift": "+X% on <campaign metric>",
    "confidence": "high|medium|low",
    "route_used": "EXPLOIT_COMPETITORS"
  },
  "avoid_this_week": ["<overused themes detected across all competitors>"],
  "portfolio_gaps": ["<angles NO competitor is using — open territory>"]
}
```

### 3. New UI: "Exploitation Command" card (replaces passive top of CompetitorsPage)
Sticky at top, shows the **single forced move** with:
- Move type badge (Mirror / Outperform / Oppose)
- Source: "Based on @CompetitorX's post #8 (high engagement, weak CTA)"
- Ready-to-use hook + CTA
- One primary CTA: **"Generate this post →"** (passes hook/angle/cta to `CreatePage`)
- Secondary: "Show me 2 alternatives"
- Tiny pill: "Confidence: high · Route: exploiting competitor signal"

This replaces the current `BestMoveCard` for users with active campaigns + analyzed competitors.

### 4. Cross-competitor gap detector (passive but valuable)
Below the command card: a thin strip showing:
- 🚫 **Avoid this week**: themes ≥3 competitors are saturating
- 🎯 **Open territory**: angles NO competitor is using that fit the campaign goal

Pulls from the same `competitor-exploit-engine` output. No new AI calls per render — cached on `competitor_insights` per user.

---

## Files touched

**New:**
- `supabase/functions/competitor-exploit-engine/index.ts` — the brain
- `src/components/competitor/ExploitationCommandCard.tsx` — the forced move UI
- `src/components/competitor/StrategicMoveBadge.tsx` — Mirror/Outperform/Oppose pill

**Modified:**
- `supabase/functions/analyze-competitor/index.ts` — add `strategic_move` block to per-post prompt
- `src/pages/CompetitorsPage.tsx` — render command card at top, add move badges to each post, wire "Generate this post" to `/create` with prefilled brief
- `src/components/competitor/BestMoveCard.tsx` — keep as fallback when no active campaign exists

**No DB migration needed** — `strategic_move` lives inside the existing `post_analysis` JSONB column; `next_best_post` lives inside `competitor_insights.predicted_outcomes` (or a new JSONB column if we want it queryable — see open question).

---

## How this matches your spec
| Your spec | Implementation |
|---|---|
| Classify hook/CTA/content type | ✅ already done — adding `strategic_move` |
| Detect patterns + gaps | ✅ already done per-competitor — adding **cross-competitor portfolio view** |
| Win Mapping ("they do X → you do Y") | ✅ `strategic_move` per post + `next_best_post` overall |
| 3 move types (Mirror/Outperform/Oppose) | ✅ classified per post + chosen for next post |
| Confidence-aware routing | ✅ `internalSignalStrength` vs `competitorSignalStrength` switch in engine |
| "Don't build dashboard, build recommendations" | ✅ ExploitationCommandCard is a forced move, not a chart |
| Fuse competitor + campaign goal + own performance | ✅ exactly what `competitor-exploit-engine` does |

---

## One clarifying question before implementing

Should the "Next Best Post" auto-refresh after each new competitor post is added/analyzed, or only when the user clicks a **"Recompute"** button? Auto-refresh feels alive but burns AI credits on every screenshot upload. My recommendation: **manual recompute** with a subtle "stale" indicator (e.g., "based on data from 2 days ago — refresh"), unless you want it real-time.

