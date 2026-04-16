import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(prompt: string, temperature = 0.4): Promise<string> {
  let resp: Response | null = null;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        max_tokens: 8192,
        messages: [{ role: "user", content: prompt }],
        temperature,
      }),
    });
    if (resp!.ok) break;
    if ((resp!.status === 502 || resp!.status === 503) && attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 2000 * attempt));
      continue;
    }
    if (resp!.status === 402) throw new Error("AI credits exhausted. Please add funds.");
    if (resp!.status === 429) throw new Error("Rate limited. Please try again in a moment.");
    throw new Error(`AI error ${resp!.status}`);
  }
  const data = await resp!.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
}

function buildMarketContextBlock(mc: any): string {
  if (!mc) return "";
  let block = `\nMARKET CONTEXT — ${mc.region_name} (${mc.region_code}):\n`;
  block += `Audience Type: ${mc.audience_type}\n`;
  block += `Tone Preference: ${mc.tone_preference}\n`;
  block += `Buyer Maturity: ${mc.buyer_maturity}\n`;
  block += `Content Style Bias: ${mc.content_style_bias}\n`;
  block += `Preferred CTA Style: ${mc.preferred_cta_style}\n`;

  const channels = mc.primary_channels;
  if (Array.isArray(channels) && channels.length) block += `Primary Channels: ${channels.join(", ")}\n`;
  const behaviors = mc.common_customer_behaviors;
  if (Array.isArray(behaviors) && behaviors.length) block += `Customer Behaviors: ${behaviors.join("; ")}\n`;
  const pains = mc.common_pain_points;
  if (Array.isArray(pains) && pains.length) block += `Common Pain Points: ${pains.join("; ")}\n`;
  const trust = mc.trust_signals;
  if (Array.isArray(trust) && trust.length) block += `Trust Signals: ${trust.join(", ")}\n`;
  const examples = mc.localized_examples;
  if (Array.isArray(examples) && examples.length) block += `Localized Examples: ${examples.join("; ")}\n`;
  const phrases = mc.localized_phrases;
  if (Array.isArray(phrases) && phrases.length) block += `Localized Phrases: ${phrases.join("; ")}\n`;
  const langs = mc.language_defaults;
  if (Array.isArray(langs) && langs.length) block += `Language Defaults: ${langs.join(", ")}\n`;

  const platform = mc.platform_reality;
  if (platform && typeof platform === "object" && Object.keys(platform).length) {
    block += `Platform Reality: ${JSON.stringify(platform)}\n`;
  }
  const sales = mc.sales_conversation_behavior;
  if (sales && typeof sales === "object" && Object.keys(sales).length) {
    block += `Sales Conversation Behavior: ${JSON.stringify(sales)}\n`;
  }

  block += `\nCRITICAL MARKET RULES:\n`;
  block += `- Generate ALL insights, recommendations, CTAs, and strategies NATIVELY for the ${mc.region_name} market.\n`;
  block += `- Use ${mc.tone_preference} tone throughout. Match ${mc.content_style_bias} content style.\n`;
  block += `- Reference ${mc.region_name}-specific behaviors, channels, and pain points in every recommendation.\n`;
  block += `- Evaluate competitor content against LOCAL relevance — content that works globally but fails locally should be flagged.\n`;
  block += `- CTA style must match: ${mc.preferred_cta_style}\n`;
  return block;
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

    const { competitor_id, competitor_name, posts, action, market_context_id } = await req.json();
    if (!competitor_id) throw new Error("Missing competitor_id");

    const { data: businessProfile } = await supabase
      .from("business_profiles").select("*").eq("user_id", user.id).maybeSingle();
    const { data: personas } = await supabase
      .from("audience_personas").select("*").eq("user_id", user.id).limit(3);
    const { data: campaigns } = await supabase
      .from("campaigns").select("*").eq("user_id", user.id).eq("is_active", true).limit(1);

    // Fetch market context: from param, from active campaign, or default
    let marketContext: any = null;
    const mcId = market_context_id || campaigns?.[0]?.market_context_id;
    if (mcId) {
      const { data } = await supabase.from("market_contexts").select("*").eq("id", mcId).maybeSingle();
      marketContext = data;
    }

    const userContext = buildUserContext(businessProfile, personas || [], campaigns || [], marketContext);

    // ===== SINGLE POST ANALYSIS =====
    if (action === "analyze_post") {
      const targetPost = posts?.[0];
      if (!targetPost) throw new Error("No post provided");

      const analysis = await analyzePostLevel(targetPost, competitor_name, userContext, marketContext);

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
        const analysis = await analyzePostLevel(post, competitor_name, userContext, marketContext);
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

    const report = await generateStrategyReport(posts, postAnalyses, competitor_name, userContext, businessProfile, campaigns?.[0], marketContext);

    const upsertData: any = {
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
    };
    if (mcId) upsertData.market_context_id = mcId;

    await supabase.from("competitor_insights").upsert(upsertData, { onConflict: "competitor_id" });

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

function buildUserContext(profile: any, personas: any[], campaigns: any[], marketContext: any): string {
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

  // Inject dynamic market context instead of hardcoded Bangladesh logic
  if (marketContext) {
    ctx += buildMarketContextBlock(marketContext);
  }

  ctx += `\nCRITICAL: Reference the user's SPECIFIC product, audience, geography, and pricing in EVERY recommendation. Do NOT give generic advice. Make it personal.`;
  if (marketContext) {
    ctx += ` Ground every insight in ${marketContext.region_name} market behavior, local channels, and buyer patterns.`;
  }
  ctx += `\n`;
  return ctx;
}

async function analyzePostLevel(post: any, competitorName: string, userContext: string, marketContext: any): Promise<any> {
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

  const marketName = marketContext?.region_name || "the target market";
  const marketFitBlock = marketContext ? `
  "market_fit_analysis": {
    "bd_fit": {
      "score": "<high|medium|low>",
      "assessment": "<does this work for ${marketName}? Be specific about local relevance>"
    },
    "us_fit": {
      "score": "<high|medium|low>",
      "assessment": "<does this work for US B2B/SaaS audience?>"
    },
    "market_gap_opportunity": "<how user can win by localizing harder than competitor>",
    "local_relevance_score": "<high|medium|low>"
  },` : "";

  const prompt = `You are an elite LinkedIn competitive intelligence strategist and decision engine. Analyze this post from "${competitorName || "Unknown"}".

${userContext}

POST:
${post.content}
${metricsInfo}${visualInfo}

Be SPECIFIC. Reference actual lines. NO generic phrases. Speak like a battle strategist.
Every insight must answer: "So what? What should the user DO about this?"

Return JSON:
{
  "brutal_verdict": "<max 15 words. Pure decision clarity. Examples: 'Strong authority. Weak conversion. Easy to beat.' or 'Low impact post. Not worth reacting to.'>",
  "verdict_card": {
    "verdict_type": "<opportunity|monitor|threat>",
    "verdict_label": "<Low Impact Opportunity|Medium Competitive Threat|High Priority Threat>",
    "verdict_summary": "<1 sentence explaining verdict — decisive>",
    "threat_level": "<low|medium|high>",
    "recommended_action": "<Ignore or outperform with 1 strong post|Adapt strategy to counter|Respond immediately with superior content>",
    "timing": "<No urgency — add to next content cycle|Within 3-5 days|Post immediately>",
    "confidence": "<high|medium|low>",
    "confidence_reason": "<short reason — e.g. 'Weak CTA + low relevance to ICP + generic messaging detected'>"
  },
  "post_breakdown": {
    "hook_type": "<curiosity|pain|data|story|contrarian|question|bold_claim|none>",
    "content_type": "<educational|storytelling|product_led|authority|promotional|thought_leadership>",
    "tone": "<professional|casual|provocative|empathetic|inspirational|technical>",
    "cta_type": "<link_click|comment|dm|follow|share|none>",
    "format": "<text_only|list|carousel_style|thread_style>"
  },
  "impact_panel": {
    "hook_strength": <0-10>,
    "engagement_potential": "<low|medium|high>",
    "conversion_intent_strength": "<low|medium|high>",
    "competitive_threat_level": "<low|medium|high>",
    "threat_action": "<ignore|learn|must_respond>",
    "verdict": "<1-2 sentence decisive verdict>"
  },
  "exploitable_weaknesses": [
    {
      "weakness": "<SHORT: weakness + implication — e.g. 'Too technical → loses non-technical store owners'>",
      "how_to_exploit": "<1 line action>"
    }
  ],
  "strength_analysis": {
    "why_it_works": "<specific reasons — decisive language>",
    "strong_lines": ["<quote actual lines>"],
    "emotional_triggers": ["<specific triggers>"],
    "should_replicate": "<yes|no|partial>",
    "replicate_note": "<what to learn, not blindly copy>"
  },
  "weakness_analysis": {
    "failures": ["<specific weakness>"],
    "weak_elements": {
      "hook": "<specific issue or 'strong'>",
      "cta": "<specific issue or 'strong'>",
      "differentiation": "<specific issue or 'strong'>",
      "specificity": "<specific issue or 'strong'>"
    }
  },${creativeBlock}${marketFitBlock}
  "behavioral_insight": {
    "scroll_stop_power": "<1 line: weak/medium/strong + why>",
    "engagement_trigger": "<1 line: what triggers engagement>",
    "attention_drop_point": "<1 line: where attention drops and why>"
  },
  "winning_move": {
    "better_hook": "<rewritten hook that outperforms — ready to use>",
    "better_angle": "<positioning difference>",
    "better_cta": "<more aggressive/clearer/localized CTA>",
    "strategic_advantage": "<WHY your version wins>"
  },
  "execution_plan": {
    "steps": [
      "<Step 1: most important action — specific and executable>",
      "<Step 2: secondary action>",
      "<Step 3: follow-up action>",
      "<Step 4: optional strategic move>"
    ],
    "timing_note": "<when to execute — e.g. 'Publish within 3 days for maximum impact'>"
  },
  "priority_opportunities": [
    {
      "label": "<short opportunity name>",
      "impact": "<high|medium|low>",
      "detail": "<1 line: what to do + expected result>"
    }
  ],
  "cross_post_patterns": {
    "patterns_detected": ["<pattern across competitor's content — e.g. 'Weak CTAs across 80% of posts'>"],
    "strategic_opportunity": "<how to exploit the pattern>",
    "recommendation": "<specific action>"
  },
  "competitive_benchmark": {
    "hook": { "competitor": "<e.g. 6/10>", "top_performers": "<e.g. 8.5/10>", "opportunity": "<e.g. +40% improvement possible>", "direction": "<weaker|stronger|similar>" },
    "engagement": { "competitor": "<low|medium|high>", "industry_standard": "<low|medium|high>", "your_expected": "<low|medium|high — with reason>", "direction": "<below_average|average|above_average>" },
    "cta": { "competitor": "<description>", "best_practice": "<description>", "direction": "<weak|adequate|strong>" }
  },
  "outperform_version": "<full rewritten post (150-300 words) optimized for user's audience, market, and campaign goal>",
  "audience_targeting": {
    "who_targeted": "<specific>",
    "awareness_level": "<unaware|problem_aware|solution_aware|product_aware|most_aware>",
    "relevance_to_user": "<how this relates to YOUR audience>"
  },
  "engagement_insight": "<WHY engagement is high/low tied to structure>",
  "improvement_suggestions": ["<specific actionable suggestions>"]
}

Return ONLY valid JSON.`;

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}

async function generateStrategyReport(
  posts: any[], postAnalyses: any[], competitorName: string, userContext: string,
  businessProfile: any, activeCampaign: any, marketContext: any
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

  const marketName = marketContext?.region_name || "the target market";
  const localRelevanceInstruction = marketContext
    ? `\n- Evaluate ALL competitor content against LOCAL RELEVANCE for ${marketName}. Flag content that works globally but fails locally.
- Add "local_relevance_score" (high/medium/low) to predicted_outcomes based on how well strategies fit ${marketName} buyer behavior.
- Every content angle CTA must use ${marketContext.preferred_cta_style} style appropriate for ${marketName}.`
    : "";

  const prompt = `You are an elite competitive intelligence strategist for LinkedIn. You speak in DECISIVE, SHARP language. Never say "you may consider" — say "you should prioritize." Every insight leads to action. Every action leads to content. Every content aims for an outcome.

You MUST personalize every single recommendation to the user's specific product, audience, geography, and funnel stage. Generic advice = failure.

Analyze ${posts.length} posts from "${competitorName || "Unknown"}" and generate an EXECUTION-READY competitive strategy.

${userContext}

USER'S ADVANTAGES:
${userAdvantages}

CAMPAIGN GOAL:
${campaignGoal}

COMPETITOR POSTS:
${postsOverview}

Generate a COMPREHENSIVE, DECISIVE, SPECIFIC report. NO vague language. NO generic AI statements.${localRelevanceInstruction}

Return JSON:
{
  "best_move": {
    "action": "<THE single most impactful thing to do right now — specific to user's product and audience>",
    "expected_outcome": "<specific outcome e.g. +40% engagement, 15+ DMs>",
    "reason": "<why this works — reference competitor weakness AND user advantage>",
    "hook_type": "<pain|story|data|contrarian|question>",
    "cta_style": "<specific CTA>",
    "goal": "<DM|engagement|leads|awareness>"
  },
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
    "tied_to_goal": "<how this connects to campaign goal or default engagement>",
    "local_relevance_score": "<high|medium|low — how well strategies fit the target market>",
    "market_fit_assessment": "<1-2 sentence assessment of how competitor content fits vs misses the target market>"
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
- PERSONALIZE: Reference user's specific product name, target audience, geography, pricing, and funnel stage in angles and strategies
- best_move must be the SINGLE highest-ROI action — not generic

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}
