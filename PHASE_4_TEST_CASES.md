# Phase 4 — Apply Adaptations + Confidence Gate

## What changed
The Adaptive Recommendations panel (Plan tab → Execution Dashboard) now:
1. **Refuses to invent recommendations** when fewer than 3 measured posts exist — shows an "Insufficient evidence" honest message.
2. **Tags every recommendation with confidence + sample count** (e.g. `medium · n=4`).
3. **Disables the Apply button on `low` confidence** — you can't push a guess into the plan.
4. **Apply to plan** mutates `campaign_post_plans` (hook type, CTA type, format) for the targeted post and appends an `[Adapted: …]` note to the strategic rationale.
5. Already-applied recommendations show **✓ Applied to plan** and cannot be re-applied.

## Test cases

### Case 1 — Insufficient evidence (brutal honesty)
**Setup:** Campaign with ≤2 posts marked as posted (or no signals at all).
**Action:** Plan tab → "Generate" in Adaptive recommendations.
**Expected:**
- No recommendations are inserted.
- A dashed gray panel appears: "Only N measured post(s). Need at least 3 to detect a real pattern. Keep posting before adapting…"
- Toast: "Insufficient evidence — keep posting."

### Case 2 — Recommendations with confidence pills
**Setup:** Campaign with ≥3 measured posts that have varied hook/CTA mix.
**Action:** Click "Generate".
**Expected:**
- 2–4 recommendations appear, each with a confidence pill (`high` green / `medium` amber / `low` gray) and `n=X` sample count.
- Each rec cites numerical evidence in the "why" line.

### Case 3 — Apply mutates the plan
**Setup:** A recommendation targeting "Post N" with confidence ≥ medium where Post N is still in `planned`/`drafted` status.
**Action:** Click "Apply to plan".
**Expected:**
- Toast: "Plan updated — Post #N adjusted".
- The plan card for Post N now shows the new hook/CTA/format.
- The post's strategic rationale is appended with `[Adapted: <what> — <why>]`.
- The Apply button is replaced by "✓ Applied to plan".

### Case 4 — Low-confidence recommendations can't be applied
**Setup:** A rec with `low` confidence (e.g. only 1–2 samples for that pattern).
**Action:** Hover the Apply button.
**Expected:**
- Button is disabled.
- Tooltip: "Low confidence — gather more signals before applying".

### Case 5 — Idempotency
**Setup:** Apply a recommendation twice.
**Expected:**
- After first apply, button switches to the "✓ Applied to plan" badge — second apply is impossible from the UI.

## Files touched
- `supabase/functions/campaign-adapt/index.ts` — confidence gate + per-rec confidence/evidence_count.
- `src/components/strategy/ExecutionDashboard.tsx` — Apply UX, confidence pills, insufficient-evidence panel.
