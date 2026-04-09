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

    // Fetch all relevant data
    const [campaignRes, postPlansRes, progressRes, postsRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).single(),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("campaign_progress").select("*").eq("campaign_id", campaign_id),
      supabase.from("posts").select("id, hook_type, tone, post_style, content_intent, cta, created_at").eq("campaign_id", campaign_id),
    ]);

    const campaign = campaignRes.data;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const postPlans = postPlansRes.data || [];
    const progress = progressRes.data || [];
    const posts = postsRes.data || [];

    // Fetch performance data for campaign posts
    const postIds = posts.map((p: any) => p.id);
    let performanceData: any[] = [];
    if (postIds.length > 0) {
      const { data } = await supabase
        .from("post_performance")
        .select("*")
        .in("draft_id", postIds);
      performanceData = data || [];
    }

    // Calculate posting progress
    const totalPlanned = postPlans.length;
    const draftedCount = postPlans.filter((p: any) => p.status === "drafted" || p.status === "published").length;
    const publishedCount = postPlans.filter((p: any) => p.status === "published").length;

    const postingProgress = {
      total_planned: totalPlanned,
      drafted: draftedCount,
      published: publishedCount,
      remaining: totalPlanned - draftedCount,
      cadence_adherence: totalPlanned > 0 ? Math.round((draftedCount / totalPlanned) * 100) : 0,
    };

    // Outcome progress
    const currentProgress = progress[0];
    const outcomeProgress = {
      target_metric: campaign.target_metric,
      target_quantity: campaign.target_quantity,
      current_value: currentProgress?.current_value || 0,
      progress_pct: campaign.target_quantity ? Math.round(((currentProgress?.current_value || 0) / campaign.target_quantity) * 100) : 0,
      gap_analysis: currentProgress?.gap_analysis || null,
    };

    // Determine health status
    let healthStatus = "on_track";
    if (outcomeProgress.progress_pct < 25 && postingProgress.cadence_adherence > 50) {
      healthStatus = "at_risk";
    }
    if (outcomeProgress.progress_pct < 10 && postingProgress.cadence_adherence > 75) {
      healthStatus = "off_track";
    }
    if (postingProgress.remaining > postingProgress.drafted && postingProgress.cadence_adherence < 30) {
      healthStatus = "at_risk";
    }

    // Generate AI recommendations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let recommendations: any[] = [];

    if (LOVABLE_API_KEY && posts.length > 0) {
      try {
        const recPrompt = `You are a LinkedIn campaign analyst. Based on the following campaign data, provide 3-5 tactical recommendations.

CAMPAIGN: ${campaign.name}
OBJECTIVE: ${campaign.primary_objective || campaign.goal}
TARGET: ${campaign.target_quantity || "N/A"} ${campaign.target_metric || ""}
HEALTH: ${healthStatus}
POSTING PROGRESS: ${draftedCount}/${totalPlanned} posts created
OUTCOME PROGRESS: ${outcomeProgress.current_value}/${campaign.target_quantity || "N/A"}

POSTS CREATED: ${posts.map((p: any) => `${p.hook_type || "unknown"} hook, ${p.tone || "unknown"} tone, ${p.post_style || "unknown"} style`).join("; ")}

Respond with JSON:
{
  "recommendations": [
    {
      "type": "exploit|fix|test|change_cta|change_hook|change_tone|change_format",
      "title": "short title",
      "description": "detailed recommendation",
      "priority": "high|medium|low"
    }
  ]
}`;

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: recPrompt }],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          let raw = aiData.choices?.[0]?.message?.content?.trim() || "";
          if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          const parsed = JSON.parse(raw);
          recommendations = parsed.recommendations || [];
        }
      } catch (e) {
        console.error("Recommendation generation failed:", e);
      }
    }

    // Save report
    await supabase.from("campaign_reports").insert({
      user_id: user.id,
      campaign_id,
      report_type: "progress",
      health_status: healthStatus,
      posting_progress: postingProgress,
      outcome_progress: outcomeProgress,
      recommendations,
      generated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({
      health_status: healthStatus,
      posting_progress: postingProgress,
      outcome_progress: outcomeProgress,
      recommendations,
      post_count: posts.length,
      post_plans_count: totalPlanned,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campaign-analytics error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
