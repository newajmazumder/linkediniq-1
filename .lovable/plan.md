

Looking at the user's feedback: they want Phase 2/3 upgraded so the "Next Best Action" engine moves from Level 2 (reactive insights) toward Level 3 (decision guidance) with "Passive Optimization Mode" + signal strength + alternative paths. This is a refinement of Phase 3, not a new phase.

The user wants me to update PHASE_2_3_TEST_CASES.md based on the recommendations. But really they want me to **implement the upgrades** AND update the test cases.

Let me check what to change in `campaign-next-action`:
- "steady" path currently just says "On track — keep executing" → needs to become "Passive Optimization Mode"
- Add `signal_strength` field (low/medium/high) based on pattern discovery, not just sample count
- Add `alternative_path` field showing the trade-off
- Add experiment-design recommendations when on-pace + no winning pattern yet

And `NextBestActionCard` needs to render the new fields.

Plan below.

---

# Plan — Phase 3.5: Passive Optimization & Signal Strength

Move "Next Best Action" from reactive observer to decision-driving strategist. When the user is on-pace, the system stops saying "keep going" and instead designs experiments to accelerate pattern discovery.

## What changes

**1. Decision engine (`supabase/functions/campaign-next-action/index.ts`)**
- Add `signalStrength` calculation: `low` (<3 measured posts OR no dominant pattern), `medium` (3-5 posts + emerging pattern), `high` (6+ posts + dominant pattern with clear winner).
- Replace the "steady" branch with **Passive Optimization Mode**:
  - When on-pace AND signal strength is `low` → return an `experiment` action that designs the next 2–3 posts as controlled hook tests (variation > consistency).
  - When on-pace AND signal strength is `medium` → return `optimization` action recommending one more confirming variation.
  - When on-pace AND signal strength is `high` → return `optimization` action saying "exploit the winner" (existing behaviour, kept).
- Add `alternative_path` field to every action: the path NOT chosen and why it's inferior (e.g., "Continue posting normally — slower pattern discovery").
- Add `signal_strength` + `signal_reason` fields to the response payload.

**2. Card UI (`src/components/campaign/NextBestActionCard.tsx`)**
- Render new "Signal strength" pill next to the confidence pill (low = gray, medium = amber, high = emerald).
- Render an "Alternative" row at the bottom of the structured schema (Observation / Why / Impact / Do this / **Alternative**), italic + muted so it reads as a trade-off note, not the recommendation.
- Adjust the "Why now" microcopy to reference timing AND learning velocity.

**3. Client wrapper (`src/lib/campaign-intelligence.ts`)**
- Extend the `NextBestAction` interface with `signal_strength`, `signal_reason`, and `alternative_path` (all optional for backwards compatibility).

**4. Test case doc (`PHASE_2_3_TEST_CASES.md`)**
- Add a new **Section E — Passive Optimization Mode** with 4 scenarios (E1–E4) covering the on-pace × signal-strength matrix.
- Update the existing "A7 Healthy campaign" row so the expected action becomes "Optimize for signal" instead of "On track — keep executing".

## Decision matrix the engine will use

```text
on-pace?  signal-strength  → action_type    title
no        any              → execution      "Publish more posts"
yes       low              → experiment     "Optimize for signal — run a hook test"
yes       medium           → optimization   "Confirm the emerging pattern"
yes       high             → optimization   "Double down on <winning hook>"
behind +clicks no goal     → strategy       "Fix the conversion bottleneck"
no plan   any              → blocker        "Generate your campaign plan"
```

## Files touched
- `supabase/functions/campaign-next-action/index.ts` (decision tree + new fields)
- `src/lib/campaign-intelligence.ts` (type extension)
- `src/components/campaign/NextBestActionCard.tsx` (signal pill + alternative row)
- `PHASE_2_3_TEST_CASES.md` (new Section E + revised A7)

No DB migrations. No new edge functions. Existing dismissal/collapse behaviour preserved.

