

The user wants the Advisor question UI to be smarter: when the question is about data that already exists in the system (like persona, offer, CTA type, tone, etc.), show a **select dropdown** populated from existing records, with a fallback to free-text typing for cases where the answer doesn't exist yet.

Let me find the Advisor component and understand current structure.

## Plan

**1. Inspect the Advisor banner component** (`src/components/campaign/CampaignAdvisorBanner.tsx`) to see how questions are rendered and answered today.

**2. Map question_key → data source.** The advisor function emits `question_key` strings. I need to map known keys to dropdown options:

| question_key (contains)    | source table                          | label field |
|----------------------------|---------------------------------------|-------------|
| `persona`, `audience`      | `audience_personas` (user's)          | name        |
| `offer`                    | `business_profiles.offers_campaigns`  | name/title  |
| `cta`                      | static enum (Comment / DM / Link / Demo / Download) |
| `tone`                     | static enum (Authoritative / Friendly / Bold / Empathetic) |
| `goal_metric`, `metric`    | static enum (Followers / DMs / Demo bookings / Leads / Clicks) |
| `language`                 | static enum (English / Bangla / …) |

For unmapped keys → fall back to current textarea.

**3. Add a hybrid input component:**
- If options exist for this question_key → render a `<Select>` with the options + a "Custom answer…" option that swaps in a textarea.
- If no options → render the existing textarea unchanged.
- "Save answer" button stays the same; it just submits whichever value is active.

**4. For persona-type questions, also auto-write the campaign field.** When the user picks a persona from the dropdown, set `campaigns.primary_persona_id` so the chosen persona is actually wired in (not just recorded as text on the question). For offer, write `campaigns.offer`. For tone, `campaigns.tone`. For language, `campaigns.language`. Otherwise the answer is informational only.

## Files to touch

- `src/components/campaign/CampaignAdvisorBanner.tsx` — add resolver logic + hybrid Select/Textarea, and write back to campaign fields when applicable.

That's it. Single file. No new edge functions, no migrations. Pure UX upgrade.

