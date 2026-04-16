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
  if (!resp.ok) throw new Error(`AI error ${resp.status}`);
  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content || "{}";
  return raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
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

    const { competitor_id, competitor_name, posts, action } = await req.json();
    if (!competitor_id) throw new Error("Missing competitor_id");

    // Fetch user's business context for context-aware analysis
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: personas } = await supabase
      .from("audience_personas")
      .select("*")
      .eq("user_id", user.id)
      .limit(3);

    const userContext = buildUserContext(businessProfile, personas || []);

    // ===== SINGLE POST ANALYSIS =====
    if (action === "analyze_post") {
      const { post } = await req.json().catch(() => ({ post: null }));
      // post is passed in the original body
      const targetPost = posts?.[0]; // single post passed as array of 1
      if (!targetPost) throw new Error("No post provided");

      const analysis = await analyzePostLevel(targetPost, competitor_name, userContext);

      // Save analysis to the post
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
    if (!posts || posts.length < 2) {
      throw new Error("Need at least 2 posts for aggregate analysis");
    }

    // Step 1: Analyze each post individually
    const postAnalyses: any[] = [];
    for (const post of posts) {
      try {
        const analysis = await analyzePostLevel(post, competitor_name, userContext);
        postAnalyses.push({ post_id: post.id, ...analysis });

        // Save per-post analysis
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

    // Step 2: Generate aggregate report
    const aggregateReport = await generateAggregateReport(
      posts, postAnalyses, competitor_name, userContext
    );

    // Save aggregate insights
    await supabase.from("competitor_insights").upsert({
      user_id: user.id,
      competitor_id,
      patterns: aggregateReport.patterns || [],
      gaps: aggregateReport.gaps || [],
      overused_themes: aggregateReport.overused_themes || [],
      suggested_angles: aggregateReport.suggested_angles || [],
      content_strategy_overview: aggregateReport.content_strategy_overview || {},
      messaging_patterns: aggregateReport.messaging_patterns || {},
      audience_strategy: aggregateReport.audience_strategy || {},
      strengths_analysis: aggregateReport.strengths_analysis || [],
      weaknesses_analysis: aggregateReport.weaknesses_analysis || [],
      performance_insights: aggregateReport.performance_insights || {},
      strategic_opportunities: aggregateReport.strategic_opportunities || [],
      actionable_recommendations: aggregateReport.actionable_recommendations || [],
    }, { onConflict: "competitor_id" });

    return new Response(JSON.stringify({ success: true, post_analyses: postAnalyses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUserContext(profile: any, personas: any[]): string {
  if (!profile && personas.length === 0) return "No user business context available.";
  let ctx = "USER'S BUSINESS CONTEXT (use this to make analysis relative):\n";
  if (profile) {
    if (profile.company_summary) ctx += `Company: ${profile.company_summary}\n`;
    if (profile.product_summary) ctx += `Product: ${profile.product_summary}\n`;
    if (profile.target_audience) ctx += `Target Audience: ${profile.target_audience}\n`;
    if (profile.brand_tone) ctx += `Brand Tone: ${profile.brand_tone}\n`;
    const diffs = profile.differentiators;
    if (diffs && Array.isArray(diffs) && diffs.length > 0) ctx += `Differentiators: ${diffs.join(", ")}\n`;
    const problems = profile.customer_problems;
    if (problems && Array.isArray(problems) && problems.length > 0) ctx += `Customer Problems: ${problems.join(", ")}\n`;
  }
  if (personas.length > 0) {
    ctx += `Personas: ${personas.map(p => `${p.name} (${p.industry || "general"}, ${p.awareness_level || "unaware"})`).join("; ")}\n`;
  }
  return ctx;
}

async function analyzePostLevel(post: any, competitorName: string, userContext: string): Promise<any> {
  const metricsInfo = (post.likes || post.comments || post.reposts || post.impressions)
    ? `\nEngagement Metrics: ${post.likes || 0} likes, ${post.comments || 0} comments, ${post.reposts || 0} reposts, ${post.impressions || 0} impressions`
    : "\nNo engagement metrics provided.";

  const hasVisualData = post.post_format || post.visual_summary;
  const visualInfo = hasVisualData
    ? `\nVisual/Creative Info:\n- Post Format: ${post.post_format || "unknown"}\n- Visual Summary: ${post.visual_summary || "none"}\n- Source: ${post.source_type || "manual"}`
    : "";

  const creativeAnalysisBlock = hasVisualData ? `
  "creative_analysis": {
    "visual_assessment": "<what kind of visual they used and how it relates to the content>",
    "message_alignment": "<does the visual support or weaken the message? Be specific>",
    "performance_impact": "<is the visual likely helping or hurting engagement? Explain why>"
  },` : "";

  const prompt = `You are an elite LinkedIn content strategist doing competitive intelligence analysis. Analyze this competitor post from "${competitorName || "Unknown"}".

${userContext}

POST CONTENT:
${post.content}
${metricsInfo}${visualInfo}

Provide DEEP, SPECIFIC analysis. Reference actual lines from the post. NO generic phrases like "engaging content" or "good post".

Return JSON with this EXACT structure:
{
  "post_breakdown": {
    "hook_type": "<curiosity|pain|data|story|contrarian|question|bold_claim|none>",
    "content_type": "<educational|storytelling|product_led|authority|promotional|thought_leadership>",
    "tone": "<professional|casual|provocative|empathetic|inspirational|technical>",
    "cta_type": "<link_click|comment|dm|follow|share|none>",
    "format": "<text_only|list|carousel_style|thread_style>"
  },
  "audience_targeting": {
    "who_targeted": "<specific description>",
    "awareness_level": "<unaware|problem_aware|solution_aware|product_aware|most_aware>",
    "relevance_to_user": "<how this relates to YOUR audience - be specific>"
  },
  "strength_analysis": {
    "why_it_works": "<specific structural/emotional reasons>",
    "strong_lines": ["<quote actual strong lines from the post>"],
    "emotional_triggers": ["<specific triggers used>"]
  },
  "weakness_analysis": {
    "failures": ["<specific weakness with reasoning>"],
    "weak_elements": {
      "hook": "<specific issue or 'strong'>",
      "cta": "<specific issue or 'strong'>",
      "differentiation": "<specific issue or 'strong'>",
      "specificity": "<specific issue or 'strong'>"
    }
  },${creativeAnalysisBlock}
  "engagement_insight": "<if metrics provided: explain WHY engagement is high/low tied to structure. If no metrics: skip>",
  "improvement_suggestions": ["<specific, actionable suggestions - NOT generic>"],
  "rewritten_hook": "<a better version of the hook, written as if the USER wrote it for THEIR audience>",
  "rewritten_cta": "<a better CTA version>"
}

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}

async function generateAggregateReport(
  posts: any[], postAnalyses: any[], competitorName: string, userContext: string
): Promise<any> {
  const postsOverview = posts.map((p: any, i: number) => {
    const a = postAnalyses[i];
    const metrics = (p.likes || p.comments || p.reposts || p.impressions)
      ? `[${p.likes || 0}L/${p.comments || 0}C/${p.reposts || 0}R/${p.impressions || 0}I]`
      : "[no metrics]";
    const hookType = a?.post_breakdown?.hook_type || "unknown";
    const contentType = a?.post_breakdown?.content_type || "unknown";
    const tone = a?.post_breakdown?.tone || "unknown";
    const visual = p.post_format ? `, format=${p.post_format}` : "";
    const visualDesc = p.visual_summary ? `, visual="${p.visual_summary}"` : "";
    return `Post ${i + 1} ${metrics}: hook=${hookType}, type=${contentType}, tone=${tone}${visual}${visualDesc}\nContent preview: ${p.content?.substring(0, 200)}...`;
  }).join("\n\n");

  const hasVisualPosts = posts.some((p: any) => p.post_format || p.visual_summary);
  const visualStrategyBlock = hasVisualPosts ? `
  "visual_strategy": {
    "dominant_visual_types": ["<most common visual formats used>"],
    "best_performing_visuals": "<which visual types get best engagement>",
    "visual_gaps": ["<visual approaches they are NOT using>"],
    "visual_consistency": "<how consistent is their visual branding>"
  },` : "";

  const prompt = `You are an elite competitive intelligence analyst for LinkedIn strategy. Analyze ${posts.length} posts from competitor "${competitorName || "Unknown"}".

${userContext}

POST SUMMARIES:
${postsOverview}

Generate a COMPREHENSIVE strategic report. Be SPECIFIC. Reference patterns across posts. Make recommendations RELATIVE to the user's business context.

Return JSON with this EXACT structure:
{
  "patterns": ["<3-5 specific content patterns found across posts>"],
  "gaps": ["<3-5 real strategic gaps the user can exploit>"],
  "overused_themes": ["<2-4 themes they repeat too much>"],
  "suggested_angles": ["<3-5 content angles the user should use to differentiate>"],
  "content_strategy_overview": {
    "content_type_distribution": {"storytelling": "<percentage>", "educational": "<percentage>", "product_led": "<percentage>", "authority": "<percentage>"},
    "posting_consistency": "<assessment>",
    "variety_vs_repetition": "<assessment>",
    "format_preferences": ["<formats they use most>"]
  },
  "messaging_patterns": {
    "core_themes": ["<main themes with frequency>"],
    "repeated_narratives": ["<stories/angles they repeat>"],
    "language_patterns": ["<specific language/phrasing patterns>"],
    "positioning_statement": "<how they position themselves>"
  },
  "audience_strategy": {
    "primary_target": "<who they mainly target>",
    "awareness_level_focus": "<which awareness levels they serve>",
    "personas_addressed": ["<specific personas>"],
    "personas_ignored": ["<personas they miss - opportunity for user>"]
  },
  "strengths_analysis": ["<pattern-based strengths with evidence>"],
  "weaknesses_analysis": ["<real weaknesses with evidence - be harsh and honest>"],
  "performance_insights": {
    "best_performing_type": "<which post types work best and why>",
    "worst_performing_type": "<which fail and why>",
    "engagement_triggers": ["<what triggers engagement>"],
    "engagement_killers": ["<what kills engagement>"]
  },
  "strategic_opportunities": [
    {
      "opportunity": "<specific opportunity>",
      "reasoning": "<why this works>",
      "action": "<what to do>"
    }
  ],
  "actionable_recommendations": [
    {
      "action": "<specific action>",
      "priority": "<high|medium|low>",
      "category": "<content|tone|audience|cta|positioning>",
      "reasoning": "<why this matters>"
    }
  ]
}

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, 0.3);
  return JSON.parse(raw);
}
