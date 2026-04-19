// Aggregates goal-aware performance for a campaign.
// Pure math, no AI — fast and safe to call on every save.
//
// Returns:
//   - raw totals (impressions, likes, comments, clicks, ...)
//   - per-post contribution rows ranked by ROI
//   - campaign progress (current_goal_value vs target_quantity)
//   - unattributed = current_goal_value − sum(post.goal_contribution)
//   - new execution_score = 0.5*goal_progress + 0.3*execution_rate + 0.2*content_efficiency
//
// Side effects: updates campaigns.execution_score & last_evaluated_at.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id || typeof campaign_id !== "string") {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Authenticate user from JWT
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // 1. Load campaign + plans + linked metrics
    const [{ data: campaign, error: cErr }, { data: plans }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).eq("user_id", userId).maybeSingle(),
      supabase
        .from("campaign_post_plans")
        .select("id, post_number, week_number, status, linked_draft_id, linked_post_id")
        .eq("campaign_id", campaign_id)
        .eq("user_id", userId),
    ]);

    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve linkedin_post_id for each plan (fallback via linked_draft_id)
    const planRows = plans || [];
    const draftIds = planRows.map((p: any) => p.linked_draft_id).filter(Boolean);
    let draftToLinkedinId = new Map<string, string>();
    if (draftIds.length > 0) {
      const { data: linked } = await supabase
        .from("linkedin_posts")
        .select("id, linked_draft_id")
        .in("linked_draft_id", draftIds);
      (linked || []).forEach((l: any) => {
        if (l.linked_draft_id) draftToLinkedinId.set(l.linked_draft_id, l.id);
      });
    }

    const linkedinIds = planRows
      .map((p: any) => p.linked_post_id || (p.linked_draft_id && draftToLinkedinId.get(p.linked_draft_id)))
      .filter(Boolean) as string[];

    const { data: metrics } = linkedinIds.length > 0
      ? await supabase.from("post_metrics").select("*").in("linkedin_post_id", linkedinIds)
      : { data: [] as any[] };

    const metricsByLinkedinId = new Map<string, any>();
    (metrics || []).forEach((m: any) => metricsByLinkedinId.set(m.linkedin_post_id, m));

    // 2. Build per-post rows + raw totals
    const totals = { impressions: 0, reactions: 0, comments: 0, reposts: 0, clicks: 0, profile_visits: 0, follower_gain: 0 };
    const contributionRows: any[] = [];
    let totalPostContribution = 0;

    for (const plan of planRows) {
      const linkedinId = plan.linked_post_id || (plan.linked_draft_id && draftToLinkedinId.get(plan.linked_draft_id));
      const m = linkedinId ? metricsByLinkedinId.get(linkedinId) : null;
      if (m) {
        totals.impressions += m.impressions || 0;
        totals.reactions += m.reactions || 0;
        totals.comments += m.comments || 0;
        totals.reposts += m.reposts || 0;
        totals.clicks += m.clicks || 0;
        totals.profile_visits += m.profile_visits || 0;
        totals.follower_gain += m.follower_gain || 0;
      }
      const contribution = m?.goal_contribution || 0;
      totalPostContribution += contribution;
      const impressions = m?.impressions || 0;
      const clicks = m?.clicks || 0;
      contributionRows.push({
        post_plan_id: plan.id,
        linkedin_post_id: linkedinId || null,
        post_number: plan.post_number,
        week_number: plan.week_number,
        status: plan.status,
        contribution,
        impressions,
        clicks,
        reactions: m?.reactions || 0,
        comments: m?.comments || 0,
        // efficiency = contribution per 1k impressions
        efficiency: impressions > 0 ? (contribution / impressions) * 1000 : 0,
        conversion_rate: clicks > 0 ? (contribution / clicks) * 100 : 0,
      });
    }

    contributionRows.sort((a, b) => b.contribution - a.contribution);

    // 3. Goal progress
    const currentGoalValue = campaign.current_goal_value || 0;
    const target = campaign.target_quantity || 0;
    const goalProgressPct = target > 0 ? Math.min(100, (currentGoalValue / target) * 100) : 0;
    const unattributed = Math.max(0, currentGoalValue - totalPostContribution);

    // 4. New execution score
    //    goal_progress (0..1) * 0.5 + execution_rate (0..1) * 0.3 + content_efficiency (0..1) * 0.2
    const totalPlanned = planRows.length;
    const executed = planRows.filter((p: any) => p.status === "posted").length;
    const executionRate = totalPlanned > 0 ? executed / totalPlanned : 0;

    // content_efficiency = how productive each posted post is (contribution per posted post,
    // normalized against an aspirational target of (target/totalPlanned) per post).
    const expectedPerPost = totalPlanned > 0 && target > 0 ? target / totalPlanned : 0;
    const actualPerPost = executed > 0 ? totalPostContribution / executed : 0;
    const contentEfficiency = expectedPerPost > 0
      ? Math.min(1, actualPerPost / expectedPerPost)
      : (executed > 0 && totalPostContribution > 0 ? 1 : 0);

    const goalAware = (goalProgressPct / 100) * 0.5 + executionRate * 0.3 + contentEfficiency * 0.2;
    // Fallback when no contribution data yet — keep the planning execution score
    const useGoalAware = currentGoalValue > 0 || totalPostContribution > 0;
    const newScore = useGoalAware
      ? Number((goalAware * 100).toFixed(1))
      : Number((executionRate * 100).toFixed(1));

    await supabase
      .from("campaigns")
      .update({ execution_score: newScore, last_evaluated_at: new Date().toISOString() })
      .eq("id", campaign_id)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({
        campaign_id,
        goal_metric: campaign.target_metric,
        target,
        current_goal_value: currentGoalValue,
        total_post_contribution: totalPostContribution,
        unattributed,
        goal_progress_pct: Number(goalProgressPct.toFixed(1)),
        raw_totals: totals,
        contribution_rows: contributionRows,
        execution_score: newScore,
        score_breakdown: {
          goal_progress: Number(((goalProgressPct / 100) * 50).toFixed(1)),
          execution_rate: Number((executionRate * 30).toFixed(1)),
          content_efficiency: Number((contentEfficiency * 20).toFixed(1)),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("aggregate-campaign-goals error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
