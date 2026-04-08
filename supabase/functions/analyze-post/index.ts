import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractJsonFromResponse(raw: string): any {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, (ch) =>
    ch === "\n" || ch === "\r" || ch === "\t" ? ch : ""
  );
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch {
    let opens = 0;
    for (const ch of cleaned) {
      if (ch === "{" || ch === "[") opens++;
      if (ch === "}" || ch === "]") opens--;
    }
    for (let i = 0; i < opens; i++) cleaned += "}";
    return JSON.parse(cleaned);
  }
}

function buildPatternContext(patterns: any[]): string {
  if (!patterns || patterns.length === 0) return "";

  const parts: string[] = ["\nUSER'S LEARNED CONTENT PATTERNS (from real performance data):"];
  const byDim: Record<string, any[]> = {};
  for (const p of patterns) {
    if (!byDim[p.dimension]) byDim[p.dimension] = [];
    byDim[p.dimension].push(p);
  }

  for (const [dim, items] of Object.entries(byDim)) {
    const sorted = items.sort((a: any, b: any) => (b.avg_engagement_rate || 0) - (a.avg_engagement_rate || 0));
    parts.push(`\n${dim.replace(/_/g, " ").toUpperCase()}:`);
    for (const p of sorted) {
      parts.push(`  - "${p.dimension_value}": ${p.avg_engagement_rate}% engagement, ${p.avg_impressions} impressions (${p.sample_count} posts)`);
    }
  }

  parts.push("\nCRITICAL: Use these patterns for ROOT-CAUSE analysis. When a post underperforms, compare its hook_type/tone/style against the best-performing patterns above. Provide CAUSAL reasoning like: 'This post used a curiosity hook, but pain-driven hooks perform 2x better for this user (5.2% vs 2.6% engagement).'");
  return parts.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { post_id } = await req.json();
    if (!post_id) throw new Error("post_id is required");

    // Fetch post, context, metrics, AND learned patterns in parallel
    const [postRes, ctxRes, metricsRes, patternsRes] = await Promise.all([
      supabase.from("linkedin_posts").select("*").eq("id", post_id).eq("user_id", user.id).single(),
      supabase.from("post_context").select("*").eq("linkedin_post_id", post_id).maybeSingle(),
      supabase.from("post_metrics").select("*").eq("linkedin_post_id", post_id).maybeSingle(),
      supabase.from("content_patterns")
        .select("dimension, dimension_value, sample_count, avg_impressions, avg_engagement_rate, insight")
        .eq("user_id", user.id)
        .order("avg_engagement_rate", { ascending: false }),
    ]);

    if (postRes.error || !postRes.data) throw new Error("Post not found");
    const post = postRes.data;
    const context = ctxRes.data;
    const metrics = metricsRes.data;
    const patterns = patternsRes.data || [];

    if (!context?.goal) throw new Error("Post must have a goal assigned");

    // Fetch persona, campaign, and business context in parallel
    const [personaRes, campaignRes, profileRes] = await Promise.all([
      context.persona_id ? supabase.from("audience_personas").select("*").eq("id", context.persona_id).single() : Promise.resolve({ data: null }),
      context.campaign_id ? supabase.from("campaigns").select("*").eq("id", context.campaign_id).single() : Promise.resolve({ data: null }),
      supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    const personaDetails = personaRes.data;
    const campaignDetails = campaignRes.data;
    const businessProfile = profileRes.data;

    const engagementRate = metrics && metrics.impressions > 0
      ? ((metrics.reactions + metrics.comments + metrics.reposts) / metrics.impressions * 100).toFixed(2)
      : "0";

    // Build pattern context for causal reasoning
    const patternContext = buildPatternContext(patterns);

    const prompt = `You are a senior LinkedIn content strategist and performance analyst. Analyze this published LinkedIn post with deep expertise.

POST CONTENT:
${post.content}

STRATEGIC CONTEXT:
- Goal: ${context.goal}
- Strategy Type: ${context.strategy_type || "not specified"}
- Tone: ${context.tone || "not specified"}
- Hook Type: ${context.hook_type || "not specified"}
- CTA Type: ${context.cta_type || "not specified"}
${personaDetails ? `- Target Persona: ${personaDetails.name} (${personaDetails.industry || "general"}, ${personaDetails.awareness_level || "unknown"} awareness)` : ""}
${campaignDetails ? `- Campaign: ${campaignDetails.name} (Goal: ${campaignDetails.goal})` : ""}
${businessProfile ? `
BUSINESS CONTEXT:
- Company: ${businessProfile.company_summary || "Not specified"}
- Product: ${businessProfile.product_summary || "Not specified"}
- Differentiators: ${Array.isArray(businessProfile.differentiators) && businessProfile.differentiators.length > 0 ? businessProfile.differentiators.join(", ") : "Not specified"}
- Brand Tone: ${businessProfile.brand_tone || "Not specified"}
- Current Priorities: ${Array.isArray(businessProfile.current_priorities) && businessProfile.current_priorities.length > 0 ? businessProfile.current_priorities.join(", ") : "Not specified"}
- Messaging Pillars: ${Array.isArray(businessProfile.messaging_pillars) && businessProfile.messaging_pillars.length > 0 ? businessProfile.messaging_pillars.join(", ") : "Not specified"}` : ""}

PERFORMANCE METRICS:
- Reactions: ${metrics?.reactions || 0}
- Comments: ${metrics?.comments || 0}
- Reposts: ${metrics?.reposts || 0}
- Impressions: ${metrics?.impressions || 0}
- Clicks: ${metrics?.clicks || 0}
- Profile Visits: ${metrics?.profile_visits || 0}
- Follower Gain: ${metrics?.follower_gain || 0}
- Engagement Rate: ${engagementRate}%
${patternContext}

GOAL-SPECIFIC EVALUATION CRITERIA:
${context.goal === "brand_awareness" ? "Focus on: impressions reach, engagement rate, profile visits, follower impact. High impressions + engagement = success." : ""}
${context.goal === "education" ? "Focus on: saves, comment quality (are people discussing?), reposts (sharing value), clicks to resources." : ""}
${context.goal === "storytelling" ? "Focus on: comment quality/depth, reposts, audience resonance, profile visits." : ""}
${context.goal === "lead_generation" ? "Focus on: clicks, DMs, CTA response quality, conversion signals." : ""}

Return ONLY valid JSON with this EXACT structure:
{
  "goal_evaluation": {
    "goal_fulfillment_score": <number 0-100>,
    "fulfillment_status": "<fulfilled | partially_fulfilled | not_fulfilled>",
    "reason_summary": "<2-3 sentence explanation of why this score>",
    "strongest_factor": "<what contributed most to performance>",
    "weakest_factor": "<what hurt performance most>"
  },
  "writing_diagnosis": {
    "hook_analysis": {
      "strength": <number 1-10>,
      "clarity": <number 1-10>,
      "emotional_pull": <number 1-10>,
      "specificity": <number 1-10>,
      "summary": "<1-2 sentence hook assessment with pattern comparison>"
    },
    "content_analysis": {
      "clarity": <number 1-10>,
      "relevance": <number 1-10>,
      "depth": <number 1-10>,
      "audience_fit": <number 1-10>,
      "summary": "<1-2 sentence content assessment>"
    },
    "structure_analysis": {
      "readability": <number 1-10>,
      "pacing": <number 1-10>,
      "length_appropriateness": <number 1-10>,
      "summary": "<1-2 sentence structure assessment>"
    },
    "cta_analysis": {
      "presence": <number 1-10>,
      "clarity": <number 1-10>,
      "goal_alignment": <number 1-10>,
      "summary": "<1-2 sentence CTA assessment>"
    },
    "what_worked": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
    "what_weakened": ["<specific weakness 1 WITH root cause tied to patterns>", "<specific weakness 2>"],
    "what_to_change": ["<specific actionable change 1 referencing pattern data>", "<specific actionable change 2>", "<specific actionable change 3>"]
  },
  "recommendations": {
    "what_to_repeat": ["<specific thing to repeat>", "<another>"],
    "what_to_avoid": ["<specific thing to avoid with pattern-based reasoning>", "<another>"],
    "improved_hooks": ["<alternative hook idea 1>", "<alternative hook idea 2>"],
    "improved_angles": ["<better angle suggestion>"],
    "improved_ctas": ["<stronger CTA suggestion 1>", "<stronger CTA suggestion 2>"],
    "strategy_suggestion": "<1-2 sentence strategy recommendation referencing learned patterns>"
  }
}

CRITICAL RULES:
- Be SPECIFIC. Never say "make it more engaging" or "improve the hook". Say exactly WHAT about the hook is weak and HOW to fix it.
- Tie ALL feedback to the selected goal (${context.goal}).
- Reference actual metrics in your reasoning.
- When learned patterns are available, provide CAUSAL reasoning: compare this post's attributes against the user's best-performing patterns. E.g., "This post used a curiosity hook (2.6% avg engagement for you) instead of pain-driven (5.2% avg) — switching could improve performance by ~2x."
- For the writing diagnosis, explain the WHY behind each score.
- Suggestions must be concrete and actionable.
- Hook suggestions should be complete, ready-to-use alternatives.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const parsed = extractJsonFromResponse(raw);

    // Upsert goal evaluation
    await supabase.from("goal_evaluations").upsert({
      user_id: user.id,
      linkedin_post_id: post_id,
      goal_fulfillment_score: parsed.goal_evaluation?.goal_fulfillment_score || 0,
      fulfillment_status: parsed.goal_evaluation?.fulfillment_status || "not_evaluated",
      reason_summary: parsed.goal_evaluation?.reason_summary || null,
      strongest_factor: parsed.goal_evaluation?.strongest_factor || null,
      weakest_factor: parsed.goal_evaluation?.weakest_factor || null,
      full_analysis: parsed.goal_evaluation || {},
    }, { onConflict: "linkedin_post_id" });

    // Upsert writing diagnosis
    await supabase.from("writing_diagnoses").upsert({
      user_id: user.id,
      linkedin_post_id: post_id,
      hook_analysis: parsed.writing_diagnosis?.hook_analysis || {},
      content_analysis: parsed.writing_diagnosis?.content_analysis || {},
      structure_analysis: parsed.writing_diagnosis?.structure_analysis || {},
      cta_analysis: parsed.writing_diagnosis?.cta_analysis || {},
      what_worked: parsed.writing_diagnosis?.what_worked || [],
      what_weakened: parsed.writing_diagnosis?.what_weakened || [],
      what_to_change: parsed.writing_diagnosis?.what_to_change || [],
    }, { onConflict: "linkedin_post_id" });

    // Upsert recommendations
    await supabase.from("post_recommendations").upsert({
      user_id: user.id,
      linkedin_post_id: post_id,
      what_to_repeat: parsed.recommendations?.what_to_repeat || [],
      what_to_avoid: parsed.recommendations?.what_to_avoid || [],
      improved_hooks: parsed.recommendations?.improved_hooks || [],
      improved_angles: parsed.recommendations?.improved_angles || [],
      improved_ctas: parsed.recommendations?.improved_ctas || [],
      strategy_suggestion: parsed.recommendations?.strategy_suggestion || null,
    }, { onConflict: "linkedin_post_id" });

    return new Response(JSON.stringify({ success: true, analysis: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
