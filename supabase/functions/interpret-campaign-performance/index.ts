// Goal-aware AI interpretation of a campaign's performance.
// Calls aggregate-campaign-goals to get the math, then asks Lovable AI
// to surface goal-driven recommendations (not engagement vanity).
//
// Saves the result to campaign_reports with report_type = "goal_interpretation".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

    // Get aggregated data from sibling function
    const aggRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/aggregate-campaign-goals`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ campaign_id }),
    });
    if (!aggRes.ok) {
      const errText = await aggRes.text();
      throw new Error(`Aggregation failed: ${errText}`);
    }
    const agg = await aggRes.json();

    // Pull tags for top/bottom posts (hook/cta/format) so AI can spot patterns
    const planIds = (agg.contribution_rows || []).map((r: any) => r.post_plan_id);
    let planTags: Record<string, any> = {};
    if (planIds.length > 0) {
      const { data: planRows } = await supabase
        .from("campaign_post_plans")
        .select("id, suggested_hook_type, suggested_cta_type, recommended_format, suggested_tone")
        .in("id", planIds);
      (planRows || []).forEach((p: any) => { planTags[p.id] = p; });
    }

    const enrichedRows = (agg.contribution_rows || []).map((r: any) => ({
      ...r,
      tags: planTags[r.post_plan_id] || {},
    }));

    const top = enrichedRows.slice(0, 3);
    const bottom = enrichedRows.filter((r: any) => r.status === "posted").slice(-3).reverse();

    const prompt = `You are a senior LinkedIn growth strategist. Analyze this campaign's GOAL-AWARE performance and produce sharp, action-led insights.

CAMPAIGN GOAL: ${agg.goal_metric || "unknown"} (target: ${agg.target || "?"})
PROGRESS: ${agg.current_goal_value} / ${agg.target} (${agg.goal_progress_pct}%)
TOTAL POST CONTRIBUTION: ${agg.total_post_contribution}
UNATTRIBUTED: ${agg.unattributed}

RAW TOTALS: ${JSON.stringify(agg.raw_totals)}

TOP CONTRIBUTING POSTS:
${JSON.stringify(top, null, 2)}

BOTTOM POSTS (posted but low/no contribution):
${JSON.stringify(bottom, null, 2)}

Return STRICT JSON with this shape (no markdown, no commentary):
{
  "headline": "1-sentence verdict tied to the GOAL metric, not engagement.",
  "key_patterns": [
    "Pattern as 1 sentence — e.g. 'Posts with direct CTA drive 80% of bookings.'"
  ],
  "high_intent_signals": [
    "What's driving conversion (hook/cta/format combos)"
  ],
  "vanity_traps": [
    "Posts with high reach but low/no contribution — what to stop"
  ],
  "recommendations": [
    {
      "title": "Short imperative",
      "why": "1-sentence reasoning grounded in numbers above",
      "action": "Concrete next step"
    }
  ]
}`;

    const aiRes = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You output strict JSON only. No prose, no markdown." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${errText}`);
    }
    const aiData = await aiRes.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    // Strip code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { headline: "Could not parse insight", recommendations: [] };
    }

    // Save to campaign_reports
    const reportPayload = {
      user_id: userId,
      campaign_id,
      report_type: "goal_interpretation",
      health_status: agg.goal_progress_pct >= 70 ? "on_track" : agg.goal_progress_pct >= 40 ? "at_risk" : "off_track",
      outcome_progress: {
        target: agg.target,
        current: agg.current_goal_value,
        from_posts: agg.total_post_contribution,
        unattributed: agg.unattributed,
        progress_pct: agg.goal_progress_pct,
      },
      contribution_analysis: {
        top: top,
        bottom: bottom,
        score_breakdown: agg.score_breakdown,
      },
      recommendations: parsed.recommendations || [],
    };

    const { data: saved } = await supabase
      .from("campaign_reports")
      .insert(reportPayload)
      .select()
      .single();

    return new Response(
      JSON.stringify({
        insight: parsed,
        aggregate: agg,
        report_id: saved?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("interpret-campaign-performance error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
