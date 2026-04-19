

# Plan — Start Campaign flow with required dates + plan gating

The "Generate Plan" button currently runs without ensuring `target_start_date` / `target_end_date` exist, so per-post scheduling has nothing to anchor to. The user wants a **Start Campaign modal** that captures dates first, then makes plan generation date-aware (each post gets a real `planned_date` distributed across the campaign window).

## 1. New "Start Campaign" CTA in setup empty state

In `CampaignPlanPage.tsx` setup block (currently shows "Generate Plan" directly):
- Replace the standalone "Generate Plan" button with **"Start Campaign"** when `started_at` is null AND no plan exists.
- Clicking opens a new **`StartCampaignDialog`** modal.
- Keep "Generate Plan" only as a secondary state once dates are set but plan is missing.

Also remove the small "Generate Plan" button in the hero (top-right) — it bypasses the date requirement.

## 2. New component — `StartCampaignDialog.tsx`

A modal that captures:
- **Start date** (required, date picker, default = today)
- **End date** (required, date picker)
- **Duration** (auto-calculated read-only field: `endDate - startDate` in days/weeks)

Logic:
- If `campaign.target_timeframe` exists (e.g. "monthly" → 30d, "weekly" → 7d), pre-fill end date as `start + duration`. Otherwise leave blank.
- Validate: `end > start`, both required.
- On save: update `campaigns` row with `target_start_date`, `target_end_date`, `started_at = start_date`, `execution_status = 'planned'`. Then auto-trigger `generatePlan()`.

## 3. Make plan generation date-aware

Update `supabase/functions/generate-campaign-plan/index.ts`:
- **Hard guard**: return `400` with `"Campaign start and end dates are required"` if `target_start_date` or `target_end_date` is missing.
- After AI returns weeks/posts, **distribute `planned_date` across the campaign window**:
  ```
  totalDays = (end - start) in days
  intervalDays = totalDays / totalPosts
  postPlans[i].planned_date = start + (i * intervalDays)
  ```
  This evenly spaces posts across the campaign — week 1 gets first N posts, week 2 gets next N, etc.
- Also pass `duration_weeks` derived from actual dates (not blueprint default), so the AI generates the right number of weeks.

Client-side (`CampaignPlanPage.tsx`): wrap `generatePlan()` with a guard — if dates missing, open `StartCampaignDialog` instead.

## 4. Pause / resume controls (when started)

When `lifecycle !== "setup"` AND `started_at` exists, add a small status pill in the hero next to the strategy meta:
- If `execution_status === 'active'` → show **Pause** button → sets `execution_status = 'paused'`
- If `execution_status === 'paused'` → show **Resume** button → sets back to `'active'`

This is intentionally minimal — single button toggle, no modal. No need to re-capture dates.

## 5. Files touched

- **New** `src/components/campaign/StartCampaignDialog.tsx` — date capture modal (~120 lines).
- **Edit** `src/pages/CampaignPlanPage.tsx` — replace setup CTA, add date guard on `generatePlan()`, add Pause/Resume pill.
- **Edit** `supabase/functions/generate-campaign-plan/index.ts` — date guard + per-post `planned_date` distribution + duration derived from dates.

No DB migration (`target_start_date`, `target_end_date`, `started_at`, `execution_status` already exist).

## 6. State flow after change

```text
SETUP (no dates, no plan)
  → [Start Campaign] button
  → modal captures start + end dates
  → saves dates + started_at
  → auto-generates plan with date-distributed posts
  → transitions to PLANNED

PLANNED / EXECUTING / LEARNING
  → [Pause] / [Resume] toggle in hero
  → no date re-capture
```

## 7. Out of scope

- Editing dates after campaign start (later — would require re-distributing posts).
- Per-post time-of-day picker in modal (planned_time stays optional; AI can assign defaults later).
- Recalculating dates when adding/removing posts from the plan manually.

