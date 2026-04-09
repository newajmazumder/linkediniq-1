import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather all campaign data
    const [campaignRes, blueprintRes, weekPlansRes, postPlansRes, postsRes, progressRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).single(),
      supabase.from("campaign_blueprints").select("*").eq("campaign_id", campaign_id).maybeSingle(),
      supabase.from("campaign_week_plans").select("*").eq("campaign_id", campaign_id).order("week_number"),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("posts").select("*").eq("campaign_id", campaign_id),
      supabase.from("campaign_progress").select("*").eq("campaign_id", campaign_id),
    ]);

    const campaign = campaignRes.data;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const progress = progressRes.data?.[0];
    const posts = postsRes.data || [];
    const postPlans = postPlansRes.data || [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const reportPrompt = `You are a LinkedIn campaign analyst. Generate a comprehensive post-campaign intelligence report.

CAMPAIGN: ${campaign.name}
OBJECTIVE: ${campaign.primary_objective || campaign.goal}
TARGET: ${campaign.target_quantity || "N/A"} ${campaign.target_metric || ""}
DURATION: ${weekPlansRes.data?.length || "?"} weeks
TOTAL POSTS PLANNED: ${postPlans.length}
TOTAL POSTS CREATED: ${posts.length}
PROGRESS: ${progress?.current_value || 0} / ${campaign.target_quantity || "N/A"}

POSTS DETAILS:
${posts.map((p: any) => `- Style: ${p.post_style}, Hook: ${p.hook_type}, Tone: ${p.tone}, Intent: ${p.content_intent}`).join("\n")}

BLUEPRINT: ${JSON.stringify(blueprintRes.data?.content_strategy || {})}

Generate a report with JSON:
{
  "summary": {
    "campaign_name": "...",
    "objective": "...",
    "target": "...",
    "actual_outcome": "...",
    "status": "success|partial_success|failed",
    "overall_assessment": "..."
  },
  "outcome_analysis": {
    "metrics_achieved": [...],
    "metrics_missed": [...],
    "gap_explanation": "..."
  },
  "best_posts": [
    { "description": "...", "why_it_worked": "...", "pattern": "..." }
  ],
  "weakest_posts": [
    { "description": "...", "why_it_failed": "...", "what_should_change": "..." }
  ],
  "content_learnings": {
    "best_hook_types": [...],
    "best_styles": [...],
    "best_tones": [...],
    "best_cta_types": [...],
    "best_angles": [...]
  },
  "structure_learnings": {
    "weekly_sequence_assessment": "...",
    "pacing_assessment": "...",
    "cta_ramp_assessment": "...",
    "repetition_assessment": "..."
  },
  "strategic_recommendations": [
    { "action": "repeat|avoid|change", "recommendation": "...", "reasoning": "..." }
  ],
  "suggested_next_campaign": {
    "objective": "...",
    "theme": "...",
    "rationale": "..."
  }
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content: reportPrompt }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    let raw = aiData.choices?.[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const report = JSON.parse(raw);

    // Save final report
    const { data: savedReport } = await supabase.from("campaign_reports").insert({
      user_id: user.id,
      campaign_id,
      report_type: "final",
      health_status: report.summary?.status || "unknown",
      posting_progress: { total_planned: postPlans.length, created: posts.length },
      outcome_progress: { target: campaign.target_quantity, actual: progress?.current_value || 0 },
      contribution_analysis: report.best_posts || {},
      stage_performance: report.content_learnings || {},
      cta_performance: {},
      weekly_trends: [],
      recommendations: report.strategic_recommendations || [],
      generated_at: new Date().toISOString(),
    }).select().single();

    return new Response(JSON.stringify({ report, saved_report_id: savedReport?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campaign-report error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
