// Next Best Action — single prioritized recommendation for the campaign,
// derived from execution state + performance signals + winning patterns.
// Output follows the Observation → Interpretation → Impact → Recommendation → Confidence schema.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Confidence = "low" | "medium" | "high";

function confidenceFromSamples(n: number): Confidence {
  if (n >= 6) return "high";
  if (n >= 3) return "medium";
  return "low";
}

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
    ] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("post_signals").select("*").eq("campaign_id", campaign_id),
    ]);

    if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allPlans = plans || [];
    const allSignals = signals || [];
    const totalPosts = allPlans.length;
    const posted = allPlans.filter((p: any) => p.status === "posted" || !!p.linked_post_id).length;
    const drafted = allPlans.filter((p: any) => p.status === "drafted").length;
    const planned = allPlans.filter((p: any) => p.status === "planned" || !p.status).length;
    const postingPct = totalPosts > 0 ? Math.round((posted / totalPosts) * 100) : 0;
    const goalCurrent = campaign.current_goal_value || 0;
    const goalTarget = campaign.target_quantity || 0;
    const goalPct = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;
    const totalClicks = allSignals.reduce((a: number, s: any) => a + (s.clicks || 0), 0);

    // Pattern aggregation
    const byHook: Record<string, { count: number; conv: number; eng: number }> = {};
    for (const s of allSignals as any[]) {
      if (s.hook_type) {
        byHook[s.hook_type] ||= { count: 0, conv: 0, eng: 0 };
        byHook[s.hook_type].count++;
        byHook[s.hook_type].conv += s.conversion_signal_score || 0;
        byHook[s.hook_type].eng += s.engagement || 0;
      }
    }
    const hookRanked = Object.entries(byHook)
      .map(([k, v]) => ({ k, avg_conv: v.conv / Math.max(1, v.count), n: v.count }))
      .sort((a, b) => b.avg_conv - a.avg_conv);
    const winningHook = hookRanked.find(h => h.n >= 2 && h.avg_conv > 0);

    // Find the next planned post (where execution should land next)
    const nextPlannedPost = allPlans.find((p: any) => p.status === "planned" || !p.status);

    // ---- DECISION TREE — pick the single most important action ----
    // Each branch returns one structured action.

    let action: any = null;

    // 1. NO PLAN
    if (totalPosts === 0) {
      action = {
        priority: "critical",
        title: "Generate your campaign plan",
        observation: "No campaign plan exists yet — strategy is empty.",
        interpretation: "Without a plan, every post is generated in isolation and goal progress is impossible to measure.",
        impact: `You will miss your ${goalTarget} ${campaign.target_metric || "goal"} target by default.`,
        recommendation: "Click 'Generate Plan' to produce a goal-aware weekly roadmap.",
        confidence: "high",
        cta_label: "Generate plan",
        cta_path: `/campaign/${campaign_id}`,
        cta_action: "generate_plan",
      };
    }
    // 2. EXECUTION GAP — too few posts going live
    else if (postingPct < 40 && totalPosts >= 4) {
      action = {
        priority: "critical",
        title: `Publish more posts — only ${posted}/${totalPosts} are live`,
        observation: `${posted} of ${totalPosts} planned posts are published. ${drafted} drafted, ${planned} still untouched.`,
        interpretation: "This is an execution problem, not a strategy problem. Strategy revisions won't move the needle until you publish.",
        impact: `Goal is at ${goalPct}% — you have no realistic path without more posts in the feed.`,
        recommendation: nextPlannedPost
          ? `Open Post #${nextPlannedPost.post_number} (${nextPlannedPost.suggested_hook_type || "next hook"}) and publish today.`
          : "Open the next planned post and publish today.",
        confidence: "high",
        cta_label: nextPlannedPost ? `Open post #${nextPlannedPost.post_number}` : "Open plan",
        cta_path: `/campaign/${campaign_id}`,
      };
    }
    // 3. CLICKS WITHOUT CONVERSIONS — landing page or offer issue
    else if (totalClicks > 5 && goalCurrent === 0 && goalTarget > 0) {
      action = {
        priority: "high",
        title: "Fix the conversion bottleneck — clicks aren't converting",
        observation: `${totalClicks} clicks recorded across posts but zero attributed conversions toward "${campaign.target_metric}".`,
        interpretation: "The hook and CTA are pulling people in. The drop-off is happening AFTER the click — landing page, offer clarity, or attribution.",
        impact: "Generating more posts will not fix this. You'll burn audience attention without conversion.",
        recommendation: "Audit the page your CTA sends people to. Is the offer matched? Is the next step obvious in 5 seconds?",
        confidence: "medium",
        cta_label: "Review offer & landing",
        cta_path: `/campaign/${campaign_id}/edit`,
      };
    }
    // 4. WINNING PATTERN FOUND — exploit it
    else if (winningHook && winningHook.n >= 3) {
      const conf = confidenceFromSamples(winningHook.n);
      action = {
        priority: "high",
        title: `Double down on "${winningHook.k}" hooks`,
        observation: `"${winningHook.k}" hooks averaged ${Math.round(winningHook.avg_conv)} conversion score across ${winningHook.n} posts — your strongest pattern.`,
        interpretation: `This pattern is ${conf === "high" ? "reliable" : "promising"}. Other hook styles are underperforming relative to it.`,
        impact: "If your next 3 posts use this hook structure, expected conversion lift is meaningful.",
        recommendation: nextPlannedPost
          ? `For Post #${nextPlannedPost.post_number}, switch the suggested hook to "${winningHook.k}" before generating.`
          : `Switch upcoming hooks to "${winningHook.k}" structure.`,
        confidence: conf,
        cta_label: nextPlannedPost ? `Apply to post #${nextPlannedPost.post_number}` : "Apply to upcoming posts",
        cta_path: `/campaign/${campaign_id}`,
        suggested_hook: winningHook.k,
        target_post_id: nextPlannedPost?.id || null,
      };
    }
    // 5. ON PACE BUT EARLY
    else if (allSignals.length < 3) {
      action = {
        priority: "medium",
        title: "Keep posting — not enough data to optimize yet",
        observation: `${allSignals.length} posts have performance signals so far. Need at least 3 to detect reliable patterns.`,
        interpretation: "The system is not making strong recommendations yet because evidence is too thin. This is the correct behavior.",
        impact: "Acting on noise this early would create false patterns and bad decisions later.",
        recommendation: nextPlannedPost
          ? `Publish Post #${nextPlannedPost.post_number} as planned, then return for pattern analysis.`
          : "Continue executing the plan as designed.",
        confidence: "low",
        cta_label: nextPlannedPost ? `Open post #${nextPlannedPost.post_number}` : "Open plan",
        cta_path: `/campaign/${campaign_id}`,
      };
    }
    // 6. UNDERPERFORMING WITH ENOUGH DATA — revise strategy
    else if (allSignals.length >= 4 && goalPct < 25 && postingPct >= 50) {
      action = {
        priority: "high",
        title: "Strategy revision needed — execution is fine but goal isn't moving",
        observation: `${posted} posts published (${postingPct}% of plan), but goal is at ${goalPct}%.`,
        interpretation: "Execution is not the bottleneck. The strategy itself — phasing, CTA progression, or messaging — is misaligned.",
        impact: "Continuing without revision means more posts producing the same weak result.",
        recommendation: "Create Strategy v2: shift CTAs harder, compress awareness phase, or reframe the core message.",
        confidence: confidenceFromSamples(allSignals.length),
        cta_label: "Revise strategy",
        cta_path: `/campaign/${campaign_id}`,
        cta_action: "revise_strategy",
      };
    }
    // 7. DEFAULT — keep going
    else {
      action = {
        priority: "low",
        title: "On track — keep executing",
        observation: `Goal at ${goalPct}%, ${posted}/${totalPosts} posts live, ${allSignals.length} performance signals collected.`,
        interpretation: "No critical issues detected. Pattern recognition will sharpen as more posts go live.",
        impact: "Steady execution compounds — most campaigns lose at this stage by overreacting.",
        recommendation: nextPlannedPost
          ? `Publish Post #${nextPlannedPost.post_number} on schedule.`
          : "Continue with the plan.",
        confidence: confidenceFromSamples(allSignals.length),
        cta_label: nextPlannedPost ? `Open post #${nextPlannedPost.post_number}` : "Open plan",
        cta_path: `/campaign/${campaign_id}`,
      };
    }

    return new Response(JSON.stringify({
      ok: true,
      action,
      context: {
        posted, total_posts: totalPosts, posting_pct: postingPct,
        goal_pct: goalPct, signals: allSignals.length,
        winning_hook: winningHook || null,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("campaign-next-action error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
