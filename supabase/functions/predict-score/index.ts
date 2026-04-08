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

    const body = await req.json();
    const { draft_id, post_id, post_content, post_meta } = body;

    // Support two modes: draft-based or inline (post_id / raw content)
    let content = "";
    let hookType = "unknown";
    let tone = "unknown";
    let style = "unknown";
    let contentIntent = "unknown";
    let personaId: string | null = null;
    let campaignId: string | null = null;
    let postType = "text";

    if (draft_id) {
      // Original draft-based flow
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

      content = draft.custom_content || "No content";

      if (draft.selected_post_id) {
        const { data } = await supabase
          .from("posts")
          .select("hook_type, tone, post_style, content_intent, persona_id, campaign_id, post_type")
          .eq("id", draft.selected_post_id)
          .single();
        if (data) {
          hookType = data.hook_type || hookType;
          tone = data.tone || tone;
          style = data.post_style || style;
          contentIntent = data.content_intent || contentIntent;
          personaId = data.persona_id;
          campaignId = data.campaign_id;
          postType = data.post_type || "text";
        }
      }
    } else if (post_id) {
      // Inline scoring from Create page — fetch post directly
      const { data: postData } = await supabase
        .from("posts")
        .select("hook, body, cta, hook_type, tone, post_style, content_intent, persona_id, campaign_id, post_type")
        .eq("id", post_id)
        .single();

      if (!postData) {
        return new Response(JSON.stringify({ error: "Post not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      content = `${postData.hook}\n\n${postData.body}\n\n${postData.cta}`;
      hookType = postData.hook_type || hookType;
      tone = postData.tone || tone;
      style = postData.post_style || style;
      contentIntent = postData.content_intent || contentIntent;
      personaId = postData.persona_id;
      campaignId = postData.campaign_id;
      postType = postData.post_type || "text";
    } else if (post_content) {
      // Raw content scoring (no DB reference)
      content = post_content;
      hookType = post_meta?.hook_type || hookType;
      tone = post_meta?.tone || tone;
      style = post_meta?.post_style || style;
      contentIntent = post_meta?.content_intent || contentIntent;
      personaId = post_meta?.persona_id || null;
      campaignId = post_meta?.campaign_id || null;
      postType = post_meta?.post_type || "text";
    } else {
      return new Response(JSON.stringify({ error: "draft_id, post_id, or post_content is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all context in parallel
    const [patternsRes, profileRes, personaRes, campaignRes] = await Promise.all([
      supabase.from("content_patterns").select("*").eq("user_id", user.id),
      supabase.from("business_profiles")
        .select("company_summary, product_summary, differentiators, current_priorities, brand_tone, restricted_claims, customer_problems, product_features, customer_benefits, industries_served")
        .eq("user_id", user.id).maybeSingle(),
      personaId
        ? supabase.from("audience_personas")
            .select("name, pain_points, goals, objections, awareness_level, industry, business_size, geography, language_style, content_preference")
            .eq("id", personaId).single()
        : Promise.resolve({ data: null }),
      campaignId
        ? supabase.from("campaigns")
            .select("name, goal, core_message, cta_type, tone")
            .eq("id", campaignId).single()
        : Promise.resolve({ data: null }),
    ]);

    const patterns = patternsRes.data || [];
    const profile = profileRes.data;
    const persona = personaRes.data;
    const campaign = campaignRes.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build rich pattern summary with comparative data
    const byDim: Record<string, any[]> = {};
    for (const p of patterns) {
      if (!byDim[p.dimension]) byDim[p.dimension] = [];
      byDim[p.dimension].push(p);
    }

    let patternsSummary = "";
    for (const [dim, items] of Object.entries(byDim)) {
      const sorted = items.sort((a: any, b: any) => (b.avg_engagement_rate || 0) - (a.avg_engagement_rate || 0));
      patternsSummary += `\n${dim.replace(/_/g, " ").toUpperCase()}:\n`;
      for (const p of sorted) {
        patternsSummary += `  "${p.dimension_value}": ${p.avg_engagement_rate}% engagement, ${p.avg_impressions} impressions (${p.sample_count} posts)\n`;
      }
      if (sorted.length > 1) {
        const ratio = sorted[0].avg_engagement_rate && sorted[sorted.length - 1].avg_engagement_rate
          ? (sorted[0].avg_engagement_rate / sorted[sorted.length - 1].avg_engagement_rate).toFixed(1)
          : "N/A";
        patternsSummary += `  → Best "${sorted[0].dimension_value}" outperforms worst "${sorted[sorted.length - 1].dimension_value}" by ${ratio}x\n`;
      }
    }

    const campaignGoal = campaign?.goal || "awareness";
    const campaignCta = campaign?.cta_type || "soft";

    const prompt = `You are a LinkedIn content performance predictor and pre-publish advisor. Score this ${postType === "carousel" ? "carousel" : postType === "image_text" ? "image+text" : "text"} post with DEEP causal analysis.

DRAFT CONTENT:
${content.slice(0, 2000)}

POST METADATA:
- Hook type: ${hookType}
- Tone: ${tone}
- Style: ${style}
- Content intent: ${contentIntent}
- Post type: ${postType}
- Campaign goal: ${campaignGoal}
- Campaign CTA type: ${campaignCta}

${persona ? `TARGET PERSONA: ${persona.name}
- Industry: ${(persona as any).industry || "General"}
- Business Size: ${(persona as any).business_size || "Any"}
- Geography: ${(persona as any).geography || "Global"}
- Language Style: ${(persona as any).language_style || "english"}
- Awareness Level: ${persona.awareness_level || "unaware"}
- Pain Points: ${JSON.stringify(persona.pain_points || [])}
- Goals: ${JSON.stringify(persona.goals || [])}
- Objections: ${JSON.stringify(persona.objections || [])}
- Content Preference: ${(persona as any).content_preference || "educational"}` : "No persona selected."}

${profile ? `BUSINESS CONTEXT:
- Company: ${profile.company_summary || "N/A"}
- Product: ${profile.product_summary || "N/A"}
- Differentiators: ${JSON.stringify(profile.differentiators || [])}
- Priorities: ${JSON.stringify(profile.current_priorities || [])}
- Customer Problems: ${JSON.stringify((profile as any).customer_problems || [])}
- Product Features: ${JSON.stringify((profile as any).product_features || [])}
- Brand tone: ${profile.brand_tone || "N/A"}` : ""}

HISTORICAL PERFORMANCE PATTERNS:
${patternsSummary || "No historical patterns yet."}

SCORING INSTRUCTIONS:
Score each dimension 0-100. Be SPECIFIC and CAUSAL in your reasoning — reference the persona's industry, geography, awareness level, and actual pattern data.
${postType !== "text" ? `\nAlso evaluate the visual/carousel strategy — is the post type appropriate for the goal and audience?` : ""}

Return VALID JSON only (no markdown fences):
{
  "hook_strength": 0-100,
  "persona_relevance": 0-100,
  "clarity": 0-100,
  "goal_alignment": 0-100,
  "cta_alignment": 0-100,
  "context_relevance": 0-100,
  "predicted_score": 0-100,
  "risk_level": "low" | "medium" | "high",
  "strongest_element": "2-3 sentence explanation of the strongest aspect, referencing specific persona/context data",
  "weakest_element": "2-3 sentence explanation of the weakest aspect, referencing specific pattern data or persona mismatch",
  "failure_reasons": [
    "specific causal reason why this may underperform, e.g. 'hook uses curiosity framing but pattern data shows pain_driven hooks outperform curiosity by 2.1x for this user'",
    "another specific reason referencing persona/goal/context mismatch"
  ],
  "improved_hooks": [
    "alternative hook option 1 tailored to persona and best-performing patterns",
    "alternative hook option 2",
    "alternative hook option 3"
  ],
  "improved_ctas": [
    "alternative CTA aligned with campaign goal '${campaignGoal}' and persona awareness level",
    "alternative CTA option 2"
  ],
  "publish_recommendation": "publish" | "revise" | "not_recommended",
  "historical_comparison": "one sentence comparing to similar past posts using pattern data",
  "suggestions": ["specific actionable improvement 1", "improvement 2", "improvement 3"]
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
          { role: "system", content: "You are a LinkedIn content performance predictor and pre-publish advisor. Score drafts based on historical patterns, business context, persona alignment, and content quality. Be SPECIFIC, CAUSAL, and ACTIONABLE. Never give generic advice — always reference the specific persona, goal, patterns, and business context." },
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

    // Save prediction (only if draft_id provided — inline scoring doesn't persist)
    if (draft_id) {
      await supabase.from("prediction_scores").insert({
        user_id: user.id,
        draft_id,
        hook_strength: result.hook_strength || 0,
        persona_relevance: result.persona_relevance || 0,
        clarity: result.clarity || 0,
        goal_alignment: result.goal_alignment || 0,
        cta_alignment: result.cta_alignment || 0,
        context_relevance: result.context_relevance || 0,
        predicted_score: result.predicted_score || 0,
        risk_level: result.risk_level || "medium",
        suggestions: result.suggestions || [],
        historical_comparison: result.historical_comparison || null,
        strongest_element: result.strongest_element || null,
        weakest_element: result.weakest_element || null,
        failure_reasons: result.failure_reasons || [],
        improved_hooks: result.improved_hooks || [],
        improved_ctas: result.improved_ctas || [],
        publish_recommendation: result.publish_recommendation || "revise",
      });
    }

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
