

The user wants to flip from "always-on AI panel" → "event-triggered advisor". Currently `NextBestActionCard` always renders (gated by lifecycle), and pacing strip always shows. They want **silence by default**, with a single alert surfacing only when a hard trigger fires.

Let me design the trigger engine and the surface.

## Plan — Event-Triggered Advisor (silence-first)

### 1. New trigger engine (`src/lib/campaign-triggers.ts`)

Pure function `evaluateTriggers(campaign, postPlans, signals, pacing, contributionRows) → CampaignAlert | null`.

Five hard-rule triggers, evaluated in priority order. **First match wins**, rest are suppressed.

| # | Trigger              | Fires when                                                                 | Severity  |
|---|----------------------|----------------------------------------------------------------------------|-----------|
| 1 | Stagnation           | `posted_count > 0` AND no posts in last 5 days AND campaign still active   | critical  |
| 2 | Execution Failure    | `pacing.delta <= -2` (behind by 2+ posts vs expected by today)             | critical  |
| 3 | Forecast Risk        | `posted >= 3` AND linear projection of goal_value < 70% of target          | high      |
| 4 | Performance Failure  | `posted >= 3` AND avg CTR < baseline AND zero goal contributions          | high      |
| 5 | Pattern Detected     | `posted >= 4` AND one hook/format converts ≥ 3× the rest                  | medium    |

If none fire → return `null` → **render nothing**.

Each alert returns:
```ts
{ kind, severity, headline, delta, body, cta?: { label, action } }
```

### 2. New surface (`src/components/campaign/CampaignAlertCard.tsx`)

Single dismissible alert card, appears only when trigger fires. Inserted at top of campaign page. Uses red/amber/blue tone per severity. Always shows the **delta from expectation** ("You're 2 posts behind expected pace") — never raw counts alone.

### 3. Removals from `CampaignPlanPage.tsx`

- **Remove** `<NextBestActionCard>` from always-render position.
- **Remove** `<CampaignPacingStrip>` from always-render position. Pacing data is now consumed by the trigger engine, not displayed standalone.
- **Keep** the `setup` empty state ("Generate Plan") — that's onboarding, not advisor noise.
- **Keep** the campaign header, plan, posts, score (when `learning`).

### 4. Replacement render block

```text
if lifecycle === "setup"   → Generate Plan empty state
if lifecycle !== "setup"   → evaluate triggers
                              ├─ alert? → <CampaignAlertCard>
                              └─ none?  → nothing (silence)
```

### 5. Baselines (System Awareness Layer)

Hardcoded MVP constants in `campaign-triggers.ts`:
- `BASELINE_CTR = 1.5%`
- `BASELINE_CONVERSION = 25%`
- `STAGNATION_DAYS = 5`
- `BEHIND_THRESHOLD = -2 posts`
- `FORECAST_MISS_THRESHOLD = 0.7` (70% of target)
- `PATTERN_MULTIPLIER = 3`

### 6. Files touched

- **New** `src/lib/campaign-triggers.ts` — pure trigger evaluation (~120 lines).
- **New** `src/components/campaign/CampaignAlertCard.tsx` — single alert UI.
- **Edit** `src/pages/CampaignPlanPage.tsx` — remove always-on NBA + pacing strip; render alert card only when triggered.
- **Keep** `NextBestActionCard.tsx` and `CampaignPacingStrip.tsx` files (don't delete) — useful for future debug/admin views, but **not imported** by the campaign page anymore.
- **Keep** `campaign-next-action` edge function — can still power an on-demand "ask the advisor" button later, but not auto-called on page load.

No DB migration. No new edge functions. No backend changes — triggers evaluated client-side from data already fetched.

### 7. What's deliberately NOT in this phase
- "Ask the advisor" on-demand button (can come later).
- Notification/email when trigger fires (later).
- Trigger history log (later).

