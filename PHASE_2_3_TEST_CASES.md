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
- The 5-row schema is visible: Observation / Why / Impact / Do this / **Alternative**.
- A confidence pill AND a "Signal: low/medium/high" pill appear next to the priority chip.
- The Alternative row appears in italic muted text — it shows the trade-off, not the recommendation.
- Refresh button (circular arrow) re-runs the engine.
- CTA either scrolls to the target post, opens Strategy Versions, or triggers Generate Plan.

## E. Passive Optimization Mode (Phase 3.5)

The system now refuses to say "keep going" when there's a smarter move available. The decision matrix:

| on-pace? | signal-strength | → action | title |
|---|---|---|---|
| no | any | execution | "You're behind pace — N posts in M days" |
| yes | low | experiment | "Optimize for signal — run a 3-post hook test" |
| yes | medium | optimization | "Confirm the emerging '<hook>' pattern on Post #N" |
| yes | high | optimization | "Use your buffer to replicate what's working" |

| # | Scenario | Expected behaviour |
|---|---|---|
| E1 | On pace, 0–2 measured signals | **experiment** card with "Optimize for signal". The recommendation lists 3 hook variations to test (financial-loss / operational-pain / authority). Signal pill = `low`. |
| E2 | On pace, 3–5 signals, one hook leads with n≥2 | **optimization** card "Confirm the emerging '<hook>' pattern". The recommendation says: keep CTA + format constant from your top performer, vary only the hook. Signal pill = `medium`. |
| E3 | On pace, 6+ signals, clear winning hook | **optimization** card "Use your buffer to replicate what's working". CTA suggests the winning hook + CTA + format combo. Signal pill = `high`. |
| E4 | On pace, "On track — keep executing" branch | Should now be RARE (only fires when no nextPlannedPost exists). If it does fire, the Alternative row reads: "Manufacture an intervention to feel productive — but acting on noise creates false patterns." |

**Key principles to verify:**
- **Signal strength ≠ confidence.** Signal strength = "how much do we know about what works for this campaign". Confidence = "how sure am I about THIS recommendation".
- **Alternative path is always present.** Every action shows the path NOT chosen and why it's inferior. This is the trade-off thinking the AI was missing.
- **No more passive "keep going".** When the user is on-pace without a winning pattern, the system actively designs the next post(s) as experiments to accelerate learning velocity.

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
