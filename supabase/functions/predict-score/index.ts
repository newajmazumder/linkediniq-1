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

    const { draft_id } = await req.json();
    if (!draft_id) {
      return new Response(JSON.stringify({ error: "draft_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch draft + linked post
    const { data: draft } = await supabase
      .from("drafts")
      .select("*, ideas(idea_title, instruction, objective, target_audience)")
      .eq("id", draft_id)
      .single();

    if (!draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let postMeta: any = null;
    if (draft.selected_post_id) {
      const { data } = await supabase
        .from("posts")
        .select("hook_type, tone, post_style, content_intent, persona_id, campaign_id")
        .eq("id", draft.selected_post_id)
        .single();
      postMeta = data;
    }

    // Fetch user's learned patterns
    const { data: patterns } = await supabase
      .from("content_patterns")
      .select("*")
      .eq("user_id", user.id);

    // Fetch business profile
    const { data: profile } = await supabase
      .from("business_profiles")
      .select("company_summary, product_summary, differentiators, current_priorities, brand_tone, restricted_claims")
      .eq("user_id", user.id)
      .maybeSingle();

    // Fetch persona if available
    let persona: any = null;
    if (postMeta?.persona_id) {
      const { data } = await supabase
        .from("audience_personas")
        .select("name, pain_points, goals, objections, awareness_level")
        .eq("id", postMeta.persona_id)
        .single();
      persona = data;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context for AI
    const patternsSummary = (patterns || []).map((p: any) =>
      `${p.dimension}="${p.dimension_value}": ${p.sample_count} posts, avg ${p.avg_engagement_rate}% engagement, avg ${p.avg_impressions} impressions`
    ).join("\n") || "No historical patterns yet.";

    const content = draft.custom_content || "No content";
    const hookType = postMeta?.hook_type || "unknown";
    const tone = postMeta?.tone || "unknown";
    const style = postMeta?.post_style || "unknown";

    const prompt = `Score this LinkedIn post draft before publishing.

DRAFT CONTENT:
${content.slice(0, 2000)}

POST METADATA:
- Hook type: ${hookType}
- Tone: ${tone}
- Style: ${style}
- Content intent: ${postMeta?.content_intent || "unknown"}

${persona ? `TARGET PERSONA: ${persona.name}
- Pain points: ${JSON.stringify(persona.pain_points || [])}
- Goals: ${JSON.stringify(persona.goals || [])}
- Awareness: ${persona.awareness_level}` : ""}

${profile ? `BUSINESS CONTEXT:
- Company: ${profile.company_summary || "N/A"}
- Product: ${profile.product_summary || "N/A"}
- Differentiators: ${JSON.stringify(profile.differentiators || [])}
- Priorities: ${JSON.stringify(profile.current_priorities || [])}
- Brand tone: ${profile.brand_tone || "N/A"}` : ""}

HISTORICAL PERFORMANCE PATTERNS:
${patternsSummary}

Return VALID JSON only (no markdown fences):
{
  "hook_strength": 0-100,
  "persona_relevance": 0-100,
  "clarity": 0-100,
  "goal_alignment": 0-100,
  "predicted_score": 0-100 (weighted average),
  "risk_level": "low" | "medium" | "high",
  "historical_comparison": "one sentence comparing to similar past posts",
  "suggestions": ["improvement suggestion 1", "suggestion 2", "suggestion 3"]
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
          { role: "system", content: "You are a LinkedIn content performance predictor. Score drafts based on historical patterns, business context, and content quality. Be specific and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    let raw = aiData.choices?.[0]?.message?.content?.trim() || "";
    if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const result = JSON.parse(raw);

    // Save prediction
    await supabase.from("prediction_scores").insert({
      user_id: user.id,
      draft_id,
      hook_strength: result.hook_strength || 0,
      persona_relevance: result.persona_relevance || 0,
      clarity: result.clarity || 0,
      goal_alignment: result.goal_alignment || 0,
      predicted_score: result.predicted_score || 0,
      risk_level: result.risk_level || "medium",
      suggestions: result.suggestions || [],
      historical_comparison: result.historical_comparison || null,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("predict-score error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
