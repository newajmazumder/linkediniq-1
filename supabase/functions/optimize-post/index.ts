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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch post
    const { data: post } = await supabase
      .from("posts")
      .select("*, campaigns:campaign_id(primary_objective, target_metric, target_quantity, goal, cta_type)")
      .eq("id", post_id)
      .single();

    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Call predict-score inline to get analysis
    const predictResp = await fetch(`${supabaseUrl}/functions/v1/predict-score`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ post_id }),
    });

    if (!predictResp.ok) {
      throw new Error("Failed to get prediction score");
    }

    const prediction = await predictResp.json();

    // If score is already strong, return as-is
    if (prediction.predicted_score >= 75 && prediction.publish_recommendation === "publish") {
      return new Response(JSON.stringify({
        optimized: false,
        reason: "Post already scores well — no optimization needed",
        prediction,
        post: { id: post.id, hook: post.hook, body: post.body, cta: post.cta },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Build optimization prompt using prediction weaknesses
    const campaign = (post as any).campaigns;
    const objective = campaign?.primary_objective || campaign?.goal || "awareness";
    const targetMetric = campaign?.target_metric || "";
    const targetQuantity = campaign?.target_quantity || "";

    const failureReasons = (prediction.failure_reasons || []).join("\n- ");
    const suggestions = (prediction.suggestions || []).join("\n- ");
    const weakStage = prediction.weak_stage || "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const optimizePrompt = `You are a LinkedIn content optimizer. Revise this post to improve its performance score.

CURRENT POST:
Hook: ${post.hook}
Body: ${post.body}
CTA: ${post.cta}

CURRENT SCORE: ${prediction.predicted_score}/100
PUBLISH RECOMMENDATION: ${prediction.publish_recommendation}
CAMPAIGN OBJECTIVE: ${objective}
${targetMetric ? `TARGET METRIC: ${targetMetric} (goal: ${targetQuantity})` : ""}
${weakStage ? `WEAKEST FUNNEL STAGE: ${weakStage}` : ""}

FAILURE REASONS:
- ${failureReasons || "None identified"}

SUGGESTIONS:
- ${suggestions || "None provided"}

STRONGEST ELEMENT: ${prediction.strongest_element || "N/A"}
WEAKEST ELEMENT: ${prediction.weakest_element || "N/A"}

OPTIMIZATION RULES:
- Keep the strongest elements intact
- Fix the weakest elements and failure reasons
- Align CTA more closely with the campaign objective (${objective})
- Preserve the overall tone and style
- Make targeted improvements, not a full rewrite
- Keep it LinkedIn-ready: professional but human

Return VALID JSON only (no markdown fences):
{
  "hook": "optimized hook",
  "body": "optimized body",
  "cta": "optimized CTA",
  "changes_made": ["specific change 1", "specific change 2", "specific change 3"]
}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a LinkedIn content optimizer. Make targeted improvements to increase post performance for the specified campaign objective. Return VALID JSON only." },
          { role: "user", content: optimizePrompt },
        ],
      }),
    });

    if (!aiResp.ok) throw new Error("AI optimization failed");

    const aiData = await aiResp.json();
    let raw = aiData.choices?.[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const optimized = JSON.parse(raw);

    // Step 3: Update the post in DB
    const { error: updateErr } = await supabase.from("posts").update({
      hook: optimized.hook,
      body: optimized.body,
      cta: optimized.cta,
    }).eq("id", post_id);

    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({
      optimized: true,
      initial_score: prediction.predicted_score,
      changes_made: optimized.changes_made || [],
      prediction,
      post: {
        id: post.id,
        hook: optimized.hook,
        body: optimized.body,
        cta: optimized.cta,
        variation_number: post.variation_number,
        hook_type: post.hook_type,
        post_style: post.post_style,
        tone: post.tone,
        post_type: post.post_type,
        first_comment: post.first_comment,
        image_briefs: post.image_briefs,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("optimize-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
