
The user wants lifecycle-state-driven UI. Currently the campaign page shows a fake 3.5/10 score and "Next Best Action" even when no plan exists and nothing has been posted. Need to gate everything behind lifecycle state.

## Lifecycle states
1. **SETUP** — no plan exists → only show "Generate Plan" CTA + onboarding guidance. No score, no NBA, no pacing strip, no progress bar.
2. **PLANNED** — plan exists, 0 posts → show plan, hide score, NBA = "Generate content / publish first post" only. No performance claims.
3. **EXECUTING** — 1-2 posts → show pacing, hide score (or show "—"), NBA limited to execution.
4. **LEARNING** — 3+ posts → unlock score + full NBA intelligence.

## Implementation
1. **`src/lib/campaign-lifecycle.ts`** (new) — single `deriveLifecycleState(campaign, postPlans, postedCount)` returning `'setup' | 'planned' | 'executing' | 'learning'`.
2. **`CampaignPlanPage.tsx`** — compute state, conditionally render:
   - `setup`: hide score header, hide NBA, hide pacing strip, hide goal progress. Show big "Generate Plan" empty state.
   - `planned`: hide score, show plan, NBA shows only "publish first post".
   - `executing`: show pacing strip, score shows "—" with "Building signal" hint, NBA shows execution-only actions.
   - `learning`: full current behavior.
3. **`campaign-next-action`** edge function — gate by `posted_count`:
   - `posted_count === 0` + no plan → `blocker` "Generate plan"
   - `posted_count === 0` + plan exists → `blocker` "Publish first post"
   - `posted_count < 3` → only execution actions, no pattern claims, confidence forced to `low`
   - `posted_count >= 3` → existing logic
4. **Block "Start Campaign"** without a plan — already implicitly true (no posts to start), but add explicit guard in any "start" action.

## Files
- New: `src/lib/campaign-lifecycle.ts`
- Edit: `src/pages/CampaignPlanPage.tsx`, `supabase/functions/campaign-next-action/index.ts`
- Edit: `src/components/campaign/NextBestActionCard.tsx` (handle `setup`/`planned` empty-state variant)

No DB migration. No new edge functions.
