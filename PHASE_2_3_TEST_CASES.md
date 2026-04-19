# Phase 2 + 3 — Test Cases

Open any campaign at `/campaign/<id>`. The two new components live above and inside the **Plan** tab.

## A. Next Best Action card (top of page, under Advisor)

| # | Scenario | Expected Action title | Priority |
|---|---|---|---|
| A1 | Brand-new campaign, no plan | "Generate your campaign plan" | critical |
| A2 | Plan exists, 0 posts published | "Publish more posts — only 0/N are live" | critical |
| A3 | 1–2 posts posted, no patterns yet | "Keep posting — not enough data to optimize yet" | medium, **low confidence** |
| A4 | 5+ posts posted, clicks present, goal value still 0 | "Fix the conversion bottleneck — clicks aren't converting" | high |
| A5 | 3+ posts with same hook scoring well | "Double down on '<hook>' hooks" + Apply CTA | high, **medium/high confidence** |
| A6 | 4+ signals, posting ≥50%, goal <25% | "Strategy revision needed" → opens Strategy Versions | high |
| A7 | Healthy campaign, on pace, no winning pattern yet | "Optimize for signal — run a 3-post hook test" (experiment) | medium, **signal: low** |

**What to verify in each:**
- The 5-row schema is visible: Observation / Why / Impact / Do this.
- A confidence pill appears next to the priority chip.
- Refresh button (circular arrow) re-runs the engine.
- CTA either scrolls to the target post, opens Strategy Versions, or triggers Generate Plan.

## B. Strategy Versions card (bottom of Plan tab)

| # | Scenario | Expected behaviour |
|---|---|---|
| B1 | Plan exists, no versions yet | v1 auto-snapshots on first load with the current thesis + phases |
| B2 | Click "Revise to v2" with empty reason | Toast: "Tell the AI why you want to revise" |
| B3 | Click "Revise to v2", reason "CTAs too soft, no demos" | New v2 row appears, v1 marked **Superseded**, v2 **Active** |
| B4 | Expand v2 | Shows: reason for revision, hypotheses with confidence labels, CTA progression, evidence snapshot (posted count, goal %, signals) |
| B5 | Revise again to v3 | History grows linearly; v2 → Superseded, v3 → Active |

**What to verify:**
- Each version is immutable — old versions stay visible after revision.
- Evidence snapshot shows the campaign state *at the moment of capture*.
- AI-generated thesis differs meaningfully from v1 when ≥2 signals exist.

## C. End-to-end intelligence loop

1. Start a campaign with a "demo bookings" goal but no offer.
2. Reload `/campaign/<id>`.
3. **Advisor** should ask about the missing offer (Phase 1).
4. **Next Best Action** should say "Generate plan" if no plan, or "Publish more posts" once plan exists.
5. Mark 3 posts as posted via the Performance tab.
6. Reload — Next Best Action should now reflect either an execution gap, a winning pattern, or a strategy-revision call depending on the signals.
7. Click "Revise to v2" with a reason. Inspect the AI-generated thesis in the expanded version.

## D. Edge function curl tests (optional, requires logged-in browser session)

The functions are deployed at:
- `POST /functions/v1/campaign-next-action` body: `{ "campaign_id": "..." }`
- `POST /functions/v1/campaign-strategy-version` body: `{ "campaign_id": "...", "action": "snapshot" | "revise" | "list", "reason": "..." }`

Both return JSON with `ok: true` plus `action` or `version` / `versions` payloads.

## What changed under the hood

- New table rows land in `campaign_strategy_versions` (v1 auto, v2+ on demand).
- `campaign-next-action` reads only — no DB writes — pure decision engine.
- Both engines respect the **Confidence** rule: low <3 signals, medium 3–5, high 6+.
