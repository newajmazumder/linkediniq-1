import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(prompt: string, temperature = 0.4): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      temperature,
    }),
  });
  if (!resp.ok) {
    if (resp.status === 402) throw new Error("AI credits exhausted. Please add funds.");
    if (resp.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    throw new Error(`AI error ${resp.status}`);
  }
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const { competitor_id, competitor_name, posts, action } = await req.json();
    if (!competitor_id) throw new Error("Missing competitor_id");

    const { data: businessProfile } = await supabase
      .from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
    const { data: personas } = await supabase
      .from("audience_personas").select("*").eq("user_id", user.id).limit(3);
    const { data: campaigns } = await supabase
      .from("campaigns").select("*").eq("user_id", user.id).eq("is_active", true).limit(1);

    const userContext = buildUserContext(businessProfile, personas || [], campaigns || []);

    // ===== SINGLE POST ANALYSIS =====
    if (action === "analyze_post") {
      const targetPost = posts?.[0];
      if (!targetPost) throw new Error("No post provided");

      const analysis = await analyzePostLevel(targetPost, competitor_name, userContext);

      await supabase.from("competitor_posts").update({
        post_analysis: analysis,
        hook_style: analysis.post_breakdown?.hook_type || null,
        tone: analysis.post_breakdown?.tone || null,
        cta_type: analysis.post_breakdown?.cta_type || null,
      }).eq("id", targetPost.id);

      return new Response(JSON.stringify({ success: true, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== AGGREGATE ANALYSIS =====
    if (!posts || posts.length < 2) throw new Error("Need at least 2 posts for aggregate analysis");

    const postAnalyses: any[] = [];
    for (const post of posts) {
      try {
        const analysis = await analyzePostLevel(post, competitor_name, userContext);
        postAnalyses.push({ post_id: post.id, ...analysis });
        await supabase.from("competitor_posts").update({
          post_analysis: analysis,
          hook_style: analysis.post_breakdown?.hook_type || null,
          tone: analysis.post_breakdown?.tone || null,
          cta_type: analysis.post_breakdown?.cta_type || null,
        }).eq("id", post.id);
      } catch (e) {
        console.error(`Failed analyzing post ${post.id}:`, e);
        postAnalyses.push({ post_id: post.id, error: true });
      }
    }

    const report = await generateStrategyReport(posts, postAnalyses, competitor_name, userContext, businessProfile, campaigns?.[0]);

    await supabase.from("competitor_insights").upsert({
      user_id: user.id,
      competitor_id,
      patterns: report.patterns || [],
      gaps: report.gaps || [],
      overused_themes: report.overused_themes || [],
      suggested_angles: report.suggested_angles || [],
      content_strategy_overview: report.content_strategy_overview || {},
      messaging_patterns: report.messaging_patterns || {},
      audience_strategy: report.audience_strategy || {},
      strengths_analysis: report.strengths_analysis || [],
      weaknesses_analysis: report.weaknesses_analysis || [],
      performance_insights: report.performance_insights || {},
      strategic_opportunities: report.strategic_opportunities || [],
      actionable_recommendations: report.actionable_recommendations || [],
      win_strategy: report.win_strategy || {},
      content_gap_matrix: report.content_gap_matrix || [],
      content_angles: report.content_angles || [],
      opportunity_scores: report.opportunity_scores || [],
      predicted_outcomes: report.predicted_outcomes || {},
      campaign_blueprint: report.campaign_blueprint || {},
      winning_position: report.winning_position || {},
      execution_plan: report.execution_plan || [],
      why_posts_work: report.why_posts_work || [],
      confidence_layer: report.confidence_layer || {},
    }, { onConflict: "competitor_id" });

    return new Response(JSON.stringify({ success: true, post_analyses: postAnalyses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    const status = err.message?.includes("credits exhausted") ? 402
      : err.message?.includes("Rate limited") ? 429 : 500;
    return new Response(JSON.stringify({ error: err.message }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUserContext(profile: any, personas: any[], campaigns: any[]): string {
  if (!profile && personas.length === 0) return "No user business context available.";
  let ctx = "USER'S BUSINESS CONTEXT (INJECT INTO EVERY INSIGHT):\n";
  if (profile) {
    if (profile.company_summary) ctx += `Company: ${profile.company_summary}\n`;
    if (profile.product_summary) ctx += `Product: ${profile.product_summary}\n`;
    if (profile.target_audience) ctx += `Target Audience / ICP: ${profile.target_audience}\n`;
    if (profile.brand_tone) ctx += `Brand Tone: ${profile.brand_tone}\n`;
    const diffs = profile.differentiators;
    if (diffs && Array.isArray(diffs) && diffs.length > 0) ctx += `Differentiators: ${diffs.join(", ")}\n`;
    const problems = profile.customer_problems;
    if (problems && Array.isArray(problems) && problems.length > 0) ctx += `Customer Problems Solved: ${problems.join(", ")}\n`;
    const benefits = profile.customer_benefits;
    if (benefits && Array.isArray(benefits) && benefits.length > 0) ctx += `Customer Benefits: ${benefits.join(", ")}\n`;
    const features = profile.product_features;
    if (features && Array.isArray(features) && features.length > 0) ctx += `Product Features: ${features.join(", ")}\n`;
    const industries = profile.industries_served;
    if (industries && Array.isArray(industries) && industries.length > 0) ctx += `Industries / Geography: ${industries.join(", ")}\n`;
    const pillars = profile.messaging_pillars;
    if (pillars && Array.isArray(pillars) && pillars.length > 0) ctx += `Messaging Pillars: ${pillars.join(", ")}\n`;
    const ctas = profile.valid_ctas;
    if (ctas && Array.isArray(ctas) && ctas.length > 0) ctx += `Valid CTAs: ${ctas.join(", ")}\n`;
    if (profile.desired_perception) ctx += `Desired Perception: ${profile.desired_perception}\n`;
    if (profile.founder_story) ctx += `Founder Story: ${profile.founder_story.substring(0, 300)}\n`;
  }
  if (personas.length > 0) {
    ctx += `\nAUDIENCE PERSONAS:\n`;
    personas.forEach(p => {
      ctx += `- ${p.name}: industry=${p.industry || "general"}, awareness=${p.awareness_level || "unaware"}, size=${p.business_size || "any"}, geo=${p.geography || "global"}\n`;
      if (p.pain_points && Array.isArray(p.pain_points) && p.pain_points.length > 0) ctx += `  Pain points: ${p.pain_points.join(", ")}\n`;
      if (p.goals && Array.isArray(p.goals) && p.goals.length > 0) ctx += `  Goals: ${p.goals.join(", ")}\n`;
    });
  }
  if (campaigns.length > 0) {
    const c = campaigns[0];
    ctx += `\nACTIVE CAMPAIGN: "${c.name}" — Goal: ${c.primary_objective || c.goal}, Target: ${c.target_quantity || "N/A"} ${c.target_metric || ""}, Timeframe: ${c.target_timeframe || "monthly"}\n`;
  }
  ctx += `\nCRITICAL: Reference the user's SPECIFIC product, audience, geography, and pricing in EVERY recommendation. Do NOT give generic advice. Make it personal.\n`;
  return ctx;
}

async function analyzePostLevel(post: any, competitorName: string, userContext: string): Promise<any> {
  const metricsInfo = (post.likes || post.comments || post.reposts || post.impressions)
    ? `\nEngagement: ${post.likes || 0} likes, ${post.comments || 0} comments, ${post.reposts || 0} reposts, ${post.impressions || 0} impressions`
    : "\nNo engagement metrics.";

  const hasVisualData = post.post_format || post.visual_summary;
  const visualInfo = hasVisualData
    ? `\nVisual: Format=${post.post_format || "unknown"}, Summary=${post.visual_summary || "none"}`
    : "";

  const creativeBlock = hasVisualData ? `
  "creative_analysis": {
    "visual_assessment": "<what visual they used and how it relates to content>",
    "message_alignment": "<does visual support or weaken the message?>",
    "performance_impact": "<is visual helping or hurting engagement?>"
  },` : "";

  const prompt = `You are an elite LinkedIn content strategist. Analyze this post from "${competitorName || "Unknown"}".

${userContext}

POST:
${post.content}
${metricsInfo}${visualInfo}

Be SPECIFIC. Reference actual lines. NO generic phrases. Speak like a strategist, not an assistant.

Return JSON:
{
  "post_breakdown": {
    "hook_type": "<curiosity|pain|data|story|contrarian|question|bold_claim|none>",
    "content_type": "<educational|storytelling|product_led|authority|promotional|thought_leadership>",
    "tone": "<professional|casual|provocative|empathetic|inspirational|technical>",
    "cta_type": "<link_click|comment|dm|follow|share|none>",
    "format": "<text_only|list|carousel_style|thread_style>"
  },
  "audience_targeting": {
    "who_targeted": "<specific>",
    "awareness_level": "<unaware|problem_aware|solution_aware|product_aware|most_aware>",
    "relevance_to_user": "<how this relates to YOUR audience>"
  },
  "strength_analysis": {
    "why_it_works": "<specific reasons — decisive language>",
    "strong_lines": ["<quote actual lines>"],
    "emotional_triggers": ["<specific triggers>"]
  },
  "weakness_analysis": {
    "failures": ["<specific weakness with reasoning>"],
    "weak_elements": {
      "hook": "<specific issue or 'strong'>",
      "cta": "<specific issue or 'strong'>",
      "differentiation": "<specific issue or 'strong'>",
      "specificity": "<specific issue or 'strong'>"
    }
  },${creativeBlock}
  "engagement_insight": "<WHY engagement is high/low tied to structure>",
  "what_you_should_replicate": "<specific element user should learn from this post>",
  "what_you_should_avoid": "<specific element user should NOT copy>",
  "improvement_suggestions": ["<specific actionable suggestions>"],
  "rewritten_hook": "<better hook for USER's audience>",
  "rewritten_cta": "<better CTA>"
}

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}

async function generateStrategyReport(
  posts: any[], postAnalyses: any[], competitorName: string, userContext: string,
  businessProfile: any, activeCampaign: any
): Promise<any> {
  const postsOverview = posts.map((p: any, i: number) => {
    const a = postAnalyses[i];
    const metrics = (p.likes || p.comments || p.reposts || p.impressions)
      ? `[${p.likes || 0}L/${p.comments || 0}C/${p.reposts || 0}R/${p.impressions || 0}I]`
      : "[no metrics]";
    const hookType = a?.post_breakdown?.hook_type || "unknown";
    const contentType = a?.post_breakdown?.content_type || "unknown";
    const tone = a?.post_breakdown?.tone || "unknown";
    const ctaType = a?.post_breakdown?.cta_type || "none";
    const visual = p.post_format ? `, format=${p.post_format}` : "";
    return `Post ${i + 1} ${metrics}: hook=${hookType}, type=${contentType}, tone=${tone}, cta=${ctaType}${visual}\nPreview: ${p.content?.substring(0, 250)}...`;
  }).join("\n\n");

  const userAdvantages = businessProfile ? [
    businessProfile.differentiators ? `Differentiators: ${JSON.stringify(businessProfile.differentiators)}` : "",
    businessProfile.brand_tone ? `Tone: ${businessProfile.brand_tone}` : "",
    businessProfile.target_audience ? `Target: ${businessProfile.target_audience}` : "",
  ].filter(Boolean).join("\n") : "Not specified";

  const campaignGoal = activeCampaign
    ? `Active campaign "${activeCampaign.name}": ${activeCampaign.primary_objective}, target ${activeCampaign.target_quantity} ${activeCampaign.target_metric}`
    : "No active campaign — default to engagement optimization";

  const prompt = `You are an elite competitive intelligence strategist for LinkedIn. You speak in DECISIVE, SHARP language. Never say "you may consider" — say "you should prioritize." Every insight leads to action. Every action leads to content. Every content aims for an outcome.

Analyze ${posts.length} posts from "${competitorName || "Unknown"}" and generate an EXECUTION-READY competitive strategy.

${userContext}

USER'S ADVANTAGES:
${userAdvantages}

CAMPAIGN GOAL:
${campaignGoal}

COMPETITOR POSTS:
${postsOverview}

Generate a COMPREHENSIVE, DECISIVE, SPECIFIC report. NO vague language. NO generic AI statements.

Return JSON:
{
  "win_strategy": {
    "competitor_name": "${competitorName}",
    "primary_weakness": "<single most exploitable weakness — be brutally specific>",
    "user_advantage": "<user's strongest advantage over this competitor>",
    "winning_strategy": ["<4 specific, decisive strategy bullets — each starts with action verb>"],
    "expected_engagement_lift": "<e.g. +30-50%>",
    "expected_conversion_lift": "<e.g. +15-25%>"
  },
  "content_gap_matrix": [
    {"content_type": "Storytelling", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"},
    {"content_type": "Pain-based", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"},
    {"content_type": "Educational", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"},
    {"content_type": "Product-led", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"},
    {"content_type": "CTA-driven", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"},
    {"content_type": "Engagement hooks", "competitor_pct": <0-100>, "ideal_pct": <0-100>, "gap_level": "<high|medium|low>", "action": "<what to do>"}
  ],
  "content_angles": [
    {
      "title": "<specific post title/angle — make it catchy>",
      "description": "<1-2 sentence description>",
      "hook_type": "<curiosity|pain|data|story|contrarian|question|bold_claim>",
      "intent": "<engagement|lead|awareness|conversion>",
      "goal": "<Drive DMs|Drive comments|Drive followers|Drive leads|Build authority|Drive awareness>",
      "cta_style": "<Comment 'X' to get...|DM me 'X'|Follow for more|Share if you agree|Link in comments|No CTA (awareness only)>",
      "why_it_beats_competitor": "<specific reasoning referencing actual competitor weakness>",
      "expected_outcome": "<High engagement + High DM conversion|High engagement|Moderate reach + Authority building|etc>",
      "example_hook": "<actual hook line ready to use>"
    }
  ],
  "opportunity_scores": [
    {
      "opportunity": "<specific opportunity>",
      "score": <1-10>,
      "impact": "<high|medium|low>",
      "effort": "<low|medium|high>",
      "priority": "<do_first|do_next|optional>",
      "reasoning": "<why this matters — reference specific competitor data>",
      "action": "<what exactly to do>",
      "expected_impact": "<+X% engagement, +Y% DMs — be specific>",
      "why_it_works": "<evidence-based explanation>"
    }
  ],
  "predicted_outcomes": {
    "engagement_improvement": "<e.g. +30-50% higher than competitor>",
    "conversion_improvement": "<e.g. +15-25% more DMs/leads>",
    "reach_potential": "<moderate|high|very_high>",
    "confidence": "<high|medium|low>",
    "tied_to_goal": "<how this connects to campaign goal or default engagement>"
  },
  "execution_plan": [
    {
      "day": 1,
      "post_title": "<specific post title>",
      "goal": "<Stop scroll|Relatability|Comments + engagement|DMs / leads>",
      "hook_type": "<pain|story|data|contrarian|question>",
      "cta": "<specific CTA or 'None (awareness)'>",
      "why_this_day": "<strategic reasoning for this sequence position>"
    },
    {"day": 3, "post_title": "<>", "goal": "<>", "hook_type": "<>", "cta": "<>", "why_this_day": "<>"},
    {"day": 5, "post_title": "<>", "goal": "<>", "hook_type": "<>", "cta": "<>", "why_this_day": "<>"},
    {"day": 7, "post_title": "<>", "goal": "<>", "hook_type": "<>", "cta": "<>", "why_this_day": "<>"}
  ],
  "why_posts_work": [
    {
      "post_index": <1-based index>,
      "post_preview": "<first 80 chars of post>",
      "why_it_worked": "<specific analysis of what made this post succeed>",
      "key_elements": ["<element 1>", "<element 2>"],
      "what_you_should_replicate": "<specific actionable takeaway>",
      "what_you_should_add": "<what would make it even better for YOUR audience>"
    }
  ],
  "campaign_blueprint": {
    "duration_weeks": 4,
    "posts_per_week": 2,
    "total_posts": 8,
    "weeks": [
      {"week": 1, "theme": "<>", "posts": [{"type": "<>", "angle": "<>", "hook_type": "<>", "cta": "<>"}]},
      {"week": 2, "theme": "<>", "posts": [{"type": "<>", "angle": "<>", "hook_type": "<>", "cta": "<>"}]},
      {"week": 3, "theme": "<>", "posts": [{"type": "<>", "angle": "<>", "hook_type": "<>", "cta": "<>"}]},
      {"week": 4, "theme": "<>", "posts": [{"type": "<>", "angle": "<>", "hook_type": "<>", "cta": "<>"}]}
    ]
  },
  "winning_position": {
    "do_this": ["<3-4 specific directives — decisive tone>"],
    "do_not_do": ["<2-3 things to avoid — based on competitor patterns>"],
    "dominate_with": ["<2-3 power moves that leverage user's unique advantage>"],
    "focus_audience": "<specific audience segment to target>",
    "messaging_approach": "<how to simplify/differentiate messaging>",
    "cta_strategy": "<specific CTA approach>"
  },
  "confidence_layer": {
    "level": "<high|medium|low>",
    "posts_analyzed": ${posts.length},
    "pattern_consistency": "<strong|moderate|weak>",
    "reasoning": "<why this confidence level — reference data points>"
  },
  "patterns": ["<3-5 content patterns>"],
  "gaps": ["<3-5 strategic gaps to exploit>"],
  "overused_themes": ["<2-4 themes they overuse>"],
  "suggested_angles": ["<3-5 angles — brief>"],
  "content_strategy_overview": {
    "content_type_distribution": {"storytelling": "<pct>", "educational": "<pct>", "product_led": "<pct>", "authority": "<pct>"},
    "posting_consistency": "<assessment>",
    "variety_vs_repetition": "<assessment>",
    "format_preferences": ["<formats>"]
  },
  "messaging_patterns": {
    "core_themes": ["<themes>"],
    "repeated_narratives": ["<narratives>"],
    "language_patterns": ["<patterns>"],
    "positioning_statement": "<how they position>"
  },
  "audience_strategy": {
    "primary_target": "<who>",
    "awareness_level_focus": "<levels>",
    "personas_addressed": ["<personas>"],
    "personas_ignored": ["<personas user can target>"]
  },
  "strengths_analysis": ["<strengths with evidence>"],
  "weaknesses_analysis": ["<weaknesses with evidence>"],
  "performance_insights": {
    "best_performing_type": "<type + why>",
    "worst_performing_type": "<type + why>",
    "engagement_triggers": ["<triggers>"],
    "engagement_killers": ["<killers>"]
  },
  "strategic_opportunities": [{"opportunity": "<>", "reasoning": "<>", "action": "<>"}],
  "actionable_recommendations": [{"action": "<specific — starts with verb>", "priority": "<high|medium|low>", "category": "<content|tone|audience|cta|positioning>", "reasoning": "<outcome-linked — reference data>", "expected_impact": "<specific metric improvement>"}]
}

CRITICAL RULES:
- Generate at least 6 content_angles and 5 opportunity_scores
- Every recommendation MUST include expected impact with numbers
- NO generic advice like "improve engagement" or "use better CTA"
- Use SHARP language: "You should prioritize..." not "You may consider..."
- Every content angle MUST include goal, cta_style, and expected_outcome
- execution_plan must have exactly 4 entries (days 1, 3, 5, 7)
- why_posts_work should cover top 2-3 performing posts
- winning_position must use do_this/do_not_do/dominate_with format

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}
