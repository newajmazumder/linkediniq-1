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

    // Fetch all posted drafts
    const { data: drafts, error: draftErr } = await supabase
      .from("drafts")
      .select("id, custom_content, status, selected_post_id, ideas(idea_title, instruction)")
      .eq("status", "posted")
      .eq("user_id", user.id);

    if (draftErr) throw draftErr;

    // Fetch performance data
    const { data: performances, error: perfErr } = await supabase
      .from("post_performance")
      .select("*")
      .eq("user_id", user.id);

    if (perfErr) throw perfErr;

    // Fetch all posts with metadata (persona, tone, hook_type, post_style, content_intent)
    const { data: allPosts, error: postsErr } = await supabase
      .from("posts")
      .select("id, post_style, tone, hook_type, content_intent, persona_id, campaign_id")
      .eq("user_id", user.id);

    if (postsErr) throw postsErr;

    // Fetch personas for name mapping
    const { data: personas } = await supabase
      .from("audience_personas")
      .select("id, name, industry, awareness_level, language_style")
      .eq("user_id", user.id);

    const personaMap: Record<string, any> = {};
    (personas || []).forEach((p: any) => { personaMap[p.id] = p; });

    // Build enriched dataset with full post metadata
    const enriched = (drafts || []).map((d: any) => {
      const perf = (performances || []).find((p: any) => p.draft_id === d.id);
      const post = (allPosts || []).find((p: any) => p.id === d.selected_post_id);
      const persona = post?.persona_id ? personaMap[post.persona_id] : null;

      return {
        title: d.ideas?.idea_title || "Untitled",
        content_preview: (d.custom_content || "").slice(0, 200),
        impressions: perf?.impressions || 0,
        likes: perf?.likes || 0,
        comments: perf?.comments || 0,
        engagement_rate: perf && perf.impressions > 0
          ? ((perf.likes + perf.comments) / perf.impressions * 100).toFixed(2) + "%"
          : "0%",
        // Post metadata for feedback loop
        post_style: post?.post_style || "unknown",
        tone: post?.tone || "unknown",
        hook_type: post?.hook_type || "unknown",
        content_intent: post?.content_intent || "unknown",
        // Persona metadata
        persona_name: persona?.name || "Unknown",
        persona_industry: persona?.industry || "Unknown",
        persona_awareness: persona?.awareness_level || "unknown",
        persona_language: persona?.language_style || "english",
      };
    });

    // Fetch business profile for context-aware analysis
    const { data: businessProfile } = await supabase
      .from("business_profiles")
      .select("company_summary, product_summary, differentiators, brand_tone, current_priorities, messaging_pillars")
      .eq("user_id", user.id)
      .maybeSingle();

    if (enriched.length === 0) {
      return new Response(
        JSON.stringify({
          insights: {
            best_hooks: [],
            best_themes: [],
            best_post_types: [],
            summary: "No posted content with performance data yet. Add performance metrics to your posted drafts to see insights.",
          },
          suggestions: {
            post_next: ["Create and publish more content to build your analytics dataset."],
            avoid: [],
          },
          persona_insights: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const businessContextSection = businessProfile ? `
BUSINESS CONTEXT:
- Company: ${businessProfile.company_summary || "Not specified"}
- Product: ${businessProfile.product_summary || "Not specified"}
- Differentiators: ${Array.isArray(businessProfile.differentiators) && businessProfile.differentiators.length > 0 ? businessProfile.differentiators.join(", ") : "Not specified"}
- Brand Tone: ${businessProfile.brand_tone || "Not specified"}
- Current Priorities: ${Array.isArray(businessProfile.current_priorities) && businessProfile.current_priorities.length > 0 ? businessProfile.current_priorities.join(", ") : "Not specified"}
- Messaging Pillars: ${Array.isArray(businessProfile.messaging_pillars) && businessProfile.messaging_pillars.length > 0 ? businessProfile.messaging_pillars.join(", ") : "Not specified"}

When analyzing performance, also evaluate:
- Whether posts that use the strongest business differentiators perform better
- Whether posts aligned with current priorities outperform generic content
- Whether the brand tone is consistently used in top-performing posts
- Provide specific recommendations referencing actual business context` : "";

    const prompt = `You are a LinkedIn content strategist. Analyze these post performance metrics WITH full metadata (persona, tone, hook type, content style, content intent) and provide deep, persona-specific insights.
${businessContextSection}

Posts data:
${JSON.stringify(enriched, null, 2)}

Return a JSON object with this exact structure:
{
  "insights": {
    "best_hooks": ["array of the top-performing hook styles with brief explanation"],
    "best_themes": ["array of themes/topics that performed best"],
    "best_post_types": ["array of post formats/types that got most engagement"],
    "summary": "A brief 2-3 sentence summary of overall performance patterns"
  },
  "suggestions": {
    "post_next": ["3-5 specific actionable suggestions for next posts based on what works"],
    "avoid": ["2-3 things to avoid based on low performance patterns"]
  },
  "persona_insights": [
    {
      "persona_name": "string (exact persona name from the data)",
      "best_hook_type": "string (which hook type performs best for this persona)",
      "best_content_style": "string (which post_style works best)",
      "best_tone": "string (which tone resonates most)",
      "best_content_intent": "string (which intent drives most engagement)",
      "engagement_pattern": "string (1-2 sentence insight, e.g. 'Bangladeshi ecommerce founders respond better to pain-driven storytelling than feature posts')",
      "recommendation": "string (specific actionable recommendation for this persona)"
    }
  ],
  "content_learnings": {
    "hook_performance": {
      "curiosity": "string (how curiosity hooks performed overall)",
      "contrarian": "string (how contrarian hooks performed)",
      "pain_driven": "string (how pain-driven hooks performed)",
      "data_bold": "string (how data/bold hooks performed)"
    },
    "style_performance": {
      "storytelling": "string (how story-based posts performed)",
      "educational": "string (how educational posts performed)",
      "hybrid": "string (how hybrid posts performed)",
      "product_led": "string (how product-led posts performed)"
    },
    "tone_performance": "string (which tones convert best and why)"
  }
}

IMPORTANT:
- Group insights BY PERSONA. Show what works for each specific audience.
- Generate learning statements like: "[Persona] responds better to [X] than [Y]"
- Be specific about which hook types, tones, and content styles work for which personas.
- If there's limited data for a persona, still provide your best analysis.
- Reference actual numbers from the data.
Return ONLY valid JSON.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${errText}`);
    }

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    const parsed = extractJsonFromResponse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
