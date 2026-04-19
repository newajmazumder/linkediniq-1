// Next Best Action — leverage-based decision engine.
// Picks the highest-impact intervention RIGHT NOW based on user state, not just task completion.
//
// Action types (in priority order, only ONE returned):
//   blocker   → user CAN'T proceed (no plan, broken state)
//   execution → user is BEHIND schedule (real urgency, not just "you have posts left")
//   optimization → user is ON TRACK but data shows a winning pattern to exploit (highest leverage)
//   strategy  → execution is fine but goal isn't moving — strategy is wrong
//   experiment → on track, no clear pattern → suggest a learning bet
//   steady    → genuinely nothing useful to say
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Confidence = "low" | "medium" | "high";
type ActionType = "blocker" | "execution" | "optimization" | "strategy" | "experiment" | "steady";

function confidenceFromSamples(n: number): Confidence {
  if (n >= 6) return "high";
  if (n >= 3) return "medium";
  return "low";
}

const DAY_MS = 24 * 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const campaign_id: string | undefined = body.campaign_id;
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [
      { data: campaign },
      { data: plans },
      { data: signals },
      { data: weekPlans },
    ] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("post_signals").select("*").eq("campaign_id", campaign_id),
      supabase.from("campaign_week_plans").select("week_number").eq("campaign_id", campaign_id),
    ]);

    if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allPlans = plans || [];
    const allSignals = signals || [];
    const totalPosts = allPlans.length;
    const totalWeeks = (weekPlans || []).length || 1;

    // Self-healing: count as posted if any of (status, linked_post_id, draft → linkedin_posts)
    const draftIds = allPlans.map((p: any) => p.linked_draft_id).filter(Boolean);
    let publishedDraftIds = new Set<string>();
    if (draftIds.length) {
      const { data: liPosts } = await supabase
        .from("linkedin_posts")
        .select("linked_draft_id")
        .in("linked_draft_id", draftIds as string[]);
      publishedDraftIds = new Set((liPosts || []).map((r: any) => r.linked_draft_id).filter(Boolean));
    }
    const isPosted = (p: any) =>
      p.status === "posted" || !!p.linked_post_id || (p.linked_draft_id && publishedDraftIds.has(p.linked_draft_id));

    const posted = allPlans.filter(isPosted).length;
    const drafted = allPlans.filter((p: any) => !isPosted(p) && p.status === "drafted").length;
    const planned = allPlans.filter((p: any) => !isPosted(p) && (p.status === "planned" || !p.status)).length;
    const postingPct = totalPosts > 0 ? Math.round((posted / totalPosts) * 100) : 0;
    const goalCurrent = campaign.current_goal_value || 0;
    const goalTarget = campaign.target_quantity || 0;
    const goalPct = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;
    const totalClicks = allSignals.reduce((a: number, s: any) => a + (s.clicks || 0), 0);

    // ---- TIME / SCHEDULE AWARENESS ----
    const startedRef = campaign.started_at || campaign.target_start_date;
    const startMs = startedRef ? new Date(startedRef).getTime() : null;
    const nowMs = Date.now();
    const campaignDays = totalWeeks * 7;
    const endMs = startMs ? startMs + campaignDays * DAY_MS : null;
    const elapsedDays = startMs ? Math.max(0, (nowMs - startMs) / DAY_MS) : 0;
    const daysRemaining = endMs ? Math.max(0, (endMs - nowMs) / DAY_MS) : null;
    const timeProgressPct = endMs && startMs ? Math.min(100, Math.round((elapsedDays / campaignDays) * 100)) : 0;
    // Pace ratio: how much of the plan posted vs. how much time elapsed.
    // <0.85 = behind, 0.85–1.15 = on pace, >1.15 = ahead
    const paceRatio = timeProgressPct > 0 ? (postingPct / Math.max(1, timeProgressPct)) : 1;
    const isBehind = paceRatio < 0.85 && timeProgressPct > 10;
    const isAhead = paceRatio > 1.15;
    const isOnPace = !isBehind && !isAhead;
    const hasTimeBuffer = daysRemaining !== null && daysRemaining >= 1.5 && !isBehind;

    // ---- PATTERN DETECTION ----
    const byHook: Record<string, { count: number; conv: number; eng: number }> = {};
    const byCta: Record<string, { count: number; conv: number }> = {};
    const byFormat: Record<string, { count: number; conv: number }> = {};
    for (const s of allSignals as any[]) {
      if (s.hook_type) {
        byHook[s.hook_type] ||= { count: 0, conv: 0, eng: 0 };
        byHook[s.hook_type].count++;
        byHook[s.hook_type].conv += s.conversion_signal_score || 0;
        byHook[s.hook_type].eng += s.engagement || 0;
      }
      if (s.cta_type) {
        byCta[s.cta_type] ||= { count: 0, conv: 0 };
        byCta[s.cta_type].count++;
        byCta[s.cta_type].conv += s.conversion_signal_score || 0;
      }
      if (s.format) {
        byFormat[s.format] ||= { count: 0, conv: 0 };
        byFormat[s.format].count++;
        byFormat[s.format].conv += s.conversion_signal_score || 0;
      }
    }
    const rank = (m: Record<string, { count: number; conv: number }>) =>
      Object.entries(m)
        .map(([k, v]) => ({ k, avg_conv: v.conv / Math.max(1, v.count), n: v.count }))
        .sort((a, b) => b.avg_conv - a.avg_conv);
    const hookRanked = rank(byHook as any);
    const ctaRanked = rank(byCta);
    const formatRanked = rank(byFormat);
    // Winning hook = at least 2 samples AND clearly better than average
    const overallAvgConv = allSignals.length > 0
      ? allSignals.reduce((a: number, s: any) => a + (s.conversion_signal_score || 0), 0) / allSignals.length
      : 0;
    const winningHook = hookRanked.find(h => h.n >= 2 && h.avg_conv > overallAvgConv * 1.2 && h.avg_conv > 0);
    const winningCta = ctaRanked.find(c => c.n >= 2 && c.avg_conv > overallAvgConv * 1.2 && c.avg_conv > 0);

    // Top contributing post (for replication recommendation)
    const sortedSignals = [...allSignals].sort((a: any, b: any) => (b.conversion_signal_score || 0) - (a.conversion_signal_score || 0));
    const topSignal = sortedSignals[0];
    const topPostPlan = topSignal
      ? allPlans.find((p: any) => p.linked_post_id === topSignal.linkedin_post_id || p.linked_draft_id === topSignal.draft_id)
      : null;

    const nextPlannedPost = allPlans.find((p: any) => !isPosted(p) && (p.status === "planned" || !p.status))
      || allPlans.find((p: any) => !isPosted(p) && p.status === "drafted");

    // Days until the next planned post (if planned_date set)
    const nextPostInDays = nextPlannedPost?.planned_date
      ? Math.max(0, (new Date(nextPlannedPost.planned_date).getTime() - nowMs) / DAY_MS)
      : null;

    // ---- SIGNAL STRENGTH — how fast are we learning? ----
    // Different from confidence: confidence = "how sure am I about THIS recommendation"
    // Signal strength = "how much do we actually know about what works for this campaign"
    let signalStrength: Confidence = "low";
    let signalReason = "";
    if (allSignals.length >= 6 && winningHook) {
      signalStrength = "high";
      signalReason = `${allSignals.length} measured posts, "${winningHook.k}" hook is a clear winner (${winningHook.n} samples, ${Math.round(((winningHook.avg_conv / Math.max(0.01, overallAvgConv)) - 1) * 100)}% above average).`;
    } else if (allSignals.length >= 3 && (winningHook || hookRanked.find(h => h.n >= 2))) {
      signalStrength = "medium";
      signalReason = `${allSignals.length} measured posts, an emerging pattern is forming but needs 1–2 more confirming posts.`;
    } else {
      signalStrength = "low";
      signalReason = allSignals.length === 0
        ? "No measured posts yet — we know nothing about what converts for this audience."
        : `Only ${allSignals.length} measured post${allSignals.length === 1 ? "" : "s"} — too thin to detect what's actually working.`;
    }

    // ---- DECISION TREE — leverage-first ----
    let action: any = null;

    // 1. BLOCKER — no plan
    if (totalPosts === 0) {
      action = {
        action_type: "blocker",
        priority: "critical",
        title: "Generate your campaign plan",
        observation: "No plan exists yet. Strategy is empty.",
        why_now: "Without a plan, you can't measure progress or replicate what works.",
        interpretation: "Every post is generated in isolation. No compounding learning.",
        impact: `You will miss your ${goalTarget} ${campaign.target_metric || "goal"} target by default.`,
        recommendation: "Generate a goal-aware weekly roadmap.",
        confidence: "high",
        cta_label: "Generate plan",
        cta_action: "generate_plan",
      };
    }
    // 2. EXECUTION — genuinely behind schedule (time-aware, not just count-aware)
    else if (isBehind && daysRemaining !== null && daysRemaining < 7) {
      const need = totalPosts - posted;
      action = {
        action_type: "execution",
        priority: daysRemaining < 3 ? "critical" : "high",
        title: `You're behind pace — ${need} posts in ${Math.ceil(daysRemaining)} days`,
        observation: `${posted}/${totalPosts} posts live (${postingPct}%) but ${timeProgressPct}% of the campaign window has elapsed.`,
        why_now: `Only ${Math.ceil(daysRemaining)} days left. Execution gap is real, not theoretical.`,
        interpretation: "Strategy can't help if posts aren't going live. This is now a velocity problem.",
        impact: `Goal at ${goalPct}%. Without catching up, the math doesn't work.`,
        recommendation: nextPlannedPost
          ? `Open Post #${nextPlannedPost.post_number} and ship today. Batch the next 2 in the same session.`
          : "Open the next planned post and publish today.",
        confidence: "high",
        cta_label: nextPlannedPost ? `Open post #${nextPlannedPost.post_number}` : "Open plan",
        target_post_id: nextPlannedPost?.id || null,
      };
    }
    // 3. STRATEGY FIX — clicks but no conversions (leverage > execution)
    else if (totalClicks > 5 && goalCurrent === 0 && goalTarget > 0 && allSignals.length >= 3) {
      action = {
        action_type: "strategy",
        priority: "high",
        title: "Clicks aren't converting — fix the bottleneck after the click",
        observation: `${totalClicks} clicks across posts but zero attributed ${campaign.target_metric || "conversions"}.`,
        why_now: "Posting more right now means burning audience attention with no ROI.",
        interpretation: "Hook + CTA work — the drop-off is post-click. Landing page, offer, or attribution is broken.",
        impact: "More volume amplifies the leak. Fix it once and every post starts converting.",
        recommendation: "Audit the destination: is the offer matched to the post promise? Is the next step obvious in 5 seconds?",
        confidence: "medium",
        cta_label: "Review offer & landing",
      };
    }
    // 4. OPTIMIZATION — on pace + winning pattern + time buffer (THE high-leverage move)
    else if (winningHook && hasTimeBuffer && nextPlannedPost) {
      const conf = confidenceFromSamples(winningHook.n);
      const replicationParts = [
        winningHook && `${winningHook.k} hook`,
        winningCta && `${winningCta.k} CTA`,
        formatRanked[0]?.n >= 2 && `${formatRanked[0].k} format`,
      ].filter(Boolean);
      action = {
        action_type: "optimization",
        priority: "high",
        title: `Use your buffer to replicate what's working — apply to Post #${nextPlannedPost.post_number}`,
        observation: `You're on pace (${posted}/${totalPosts} posted, ${Math.ceil(daysRemaining!)} days left) and "${winningHook.k}" hooks are converting ${Math.round(((winningHook.avg_conv / Math.max(0.01, overallAvgConv)) - 1) * 100)}% above your average.`,
        why_now: `You have ${Math.ceil(daysRemaining!)} days of buffer. Best moment to upgrade quality, not volume.`,
        interpretation: `Pattern detected across ${winningHook.n} posts — this is signal, not noise.${topPostPlan ? ` Post #${topPostPlan.post_number} is your highest contributor.` : ""}`,
        impact: "Replicating the winning structure on the next post raises conversion probability vs. a generic next post.",
        recommendation: `Generate Post #${nextPlannedPost.post_number} using: ${replicationParts.join(" + ")}.`,
        confidence: conf,
        cta_label: `Apply to post #${nextPlannedPost.post_number}`,
        suggested_hook: winningHook.k,
        target_post_id: nextPlannedPost?.id || null,
      };
    }
    // 5. STRATEGY REVISION — enough evidence, posting fine, goal not moving
    else if (allSignals.length >= 4 && goalPct < 25 && postingPct >= 50) {
      action = {
        action_type: "strategy",
        priority: "high",
        title: "Strategy isn't working — execution is fine, goal isn't moving",
        observation: `${posted} posts live (${postingPct}% of plan), goal at ${goalPct}%.`,
        why_now: "Continuing without a revision means producing more posts with the same weak result.",
        interpretation: "Execution isn't the bottleneck. Phasing, CTA progression, or messaging is misaligned.",
        impact: "A v2 strategy retargets the remaining posts to actually move the goal.",
        recommendation: "Create Strategy v2: tighten CTAs, compress awareness phase, or reframe the core message.",
        confidence: confidenceFromSamples(allSignals.length),
        cta_label: "Revise strategy",
        cta_action: "revise_strategy",
      };
    }
    // 6. EXPERIMENT — on track, not enough data yet → suggest a learning bet
    else if (allSignals.length < 3 && nextPlannedPost) {
      action = {
        action_type: "experiment",
        priority: "medium",
        title: "Run a learning bet on Post #" + nextPlannedPost.post_number,
        observation: `${allSignals.length} performance signal${allSignals.length === 1 ? "" : "s"} so far — too thin to detect patterns.`,
        why_now: nextPostInDays !== null
          ? `Post #${nextPlannedPost.post_number} is due in ${Math.ceil(nextPostInDays)} day${Math.ceil(nextPostInDays) === 1 ? "" : "s"}. Use it to test a clear hypothesis.`
          : "You're still in learning mode. Each post should test one variable.",
        interpretation: "Acting on noise this early creates false patterns. Better to design the next post as an explicit test.",
        impact: "A focused test gives you signal in 1–2 posts instead of guessing for 5.",
        recommendation: `Pick ONE variable to test on Post #${nextPlannedPost.post_number} (hook style, CTA, or format) and keep everything else constant.`,
        confidence: "low",
        cta_label: `Open post #${nextPlannedPost.post_number}`,
        target_post_id: nextPlannedPost?.id || null,
      };
    }
    // 7. PASSIVE OPTIMIZATION — on track but no winning pattern → design experiments
    else if (isOnPace && signalStrength !== "high" && nextPlannedPost) {
      // medium signal: confirm the emerging pattern with a controlled test
      // low signal: run a 3-post hook variation experiment
      const emergingHook = hookRanked.find(h => h.n >= 2);
      if (signalStrength === "medium" && emergingHook) {
        action = {
          action_type: "optimization",
          priority: "medium",
          title: `Confirm the emerging "${emergingHook.k}" pattern on Post #${nextPlannedPost.post_number}`,
          observation: `${posted}/${totalPosts} live, on pace. "${emergingHook.k}" hook leads after ${emergingHook.n} samples but needs 1 more confirming run.`,
          why_now: `${daysRemaining !== null ? Math.ceil(daysRemaining) + " days of buffer remaining" : "You have execution buffer"} — the cheapest moment to lock in pattern certainty.`,
          interpretation: "An emerging pattern that gets one confirming run becomes a high-confidence playbook. Without confirmation it stays a guess.",
          impact: "One targeted test now → high-confidence pattern → every remaining post gets compounding lift.",
          recommendation: `Use "${emergingHook.k}" hook on Post #${nextPlannedPost.post_number}, keep CTA + format constant from your top performer. If it wins again → exploit it on every remaining post.`,
          confidence: "medium",
          cta_label: `Open post #${nextPlannedPost.post_number}`,
          target_post_id: nextPlannedPost?.id || null,
          suggested_hook: emergingHook.k,
        };
      } else {
        // low signal → design a 3-post hook variation experiment
        action = {
          action_type: "experiment",
          priority: "medium",
          title: "Optimize for signal — run a 3-post hook test",
          observation: `On pace (${posted}/${totalPosts} live, ${daysRemaining !== null ? Math.ceil(daysRemaining) + " days remaining" : "buffer available"}) but no dominant conversion pattern yet.`,
          why_now: "Stable execution + time buffer = the best moment to accelerate learning, not just maintain pace. Continuing blindly delays pattern discovery.",
          interpretation: "You don't have a clear winning pattern yet. Continuing with random hooks means you'll still be guessing in 5 posts. A controlled test gives signal in 3.",
          impact: "Faster pattern discovery → faster scale later. One disciplined test cycle beats 5 random posts.",
          recommendation: `For the next 3 posts: test 3 different hook angles (e.g. financial-loss / operational-pain / authority-positioning). Keep CTA + audience constant. Return after 3 posts — system will refine strategy.`,
          confidence: "medium",
          cta_label: `Open post #${nextPlannedPost.post_number}`,
          target_post_id: nextPlannedPost?.id || null,
        };
      }
    }
    // 8. STEADY — genuinely no useful action (rare: high signal + on pace + no winning hook)
    else {
      action = {
        action_type: "steady",
        priority: "low",
        title: "On track — keep executing",
        observation: `Goal at ${goalPct}%, ${posted}/${totalPosts} live, ${allSignals.length} signals, pace ratio ${paceRatio.toFixed(2)}.`,
        why_now: hasTimeBuffer
          ? `${Math.ceil(daysRemaining!)} days buffer remaining. Don't manufacture urgency.`
          : "No critical issue detected.",
        interpretation: "No clear winning pattern yet, no execution gap, no conversion break. The honest answer is: keep going.",
        impact: "Most campaigns lose at this stage by overreacting to noise.",
        recommendation: nextPlannedPost
          ? `Publish Post #${nextPlannedPost.post_number} on schedule. Return after 2 more posts for pattern analysis.`
          : "Continue with the plan.",
        confidence: confidenceFromSamples(allSignals.length),
        cta_label: nextPlannedPost ? `Open post #${nextPlannedPost.post_number}` : "Open plan",
        target_post_id: nextPlannedPost?.id || null,
      };
    }

    // ---- ALTERNATIVE PATH — the road not taken, and why it's inferior ----
    const alternativeByType: Record<string, string> = {
      blocker:      "Skip planning and generate posts ad-hoc — but you'll lose all ability to measure what works against a defined goal.",
      execution:    "Wait and post when inspired — but the math no longer works once the campaign window closes.",
      optimization: "Continue posting normally with random hooks — but you give up the compounding lift from a proven pattern.",
      strategy:     "Keep posting on the current strategy — but more volume against a misaligned plan amplifies the leak instead of fixing it.",
      experiment:   "Continue posting normally — but you'll still be guessing in 5 posts instead of having signal in 3.",
      steady:       "Manufacture an intervention to feel productive — but acting on noise creates false patterns and wastes posts.",
    };
    action.alternative_path = alternativeByType[action.action_type] || alternativeByType.steady;
    action.signal_strength = signalStrength;
    action.signal_reason = signalReason;

    return new Response(JSON.stringify({
      ok: true,
      action,
      context: {
        posted, total_posts: totalPosts, posting_pct: postingPct,
        goal_pct: goalPct, signals: allSignals.length,
        pace_ratio: Number(paceRatio.toFixed(2)),
        is_behind: isBehind, is_on_pace: isOnPace, is_ahead: isAhead,
        days_remaining: daysRemaining !== null ? Number(daysRemaining.toFixed(1)) : null,
        time_progress_pct: timeProgressPct,
        signal_strength: signalStrength,
        winning_hook: winningHook || null,
        winning_cta: winningCta || null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("campaign-next-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
