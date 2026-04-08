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

    // Fetch all data
    const [patternsRes, tagsRes, campaignsRes, personasRes, profileRes] = await Promise.all([
      supabase.from("content_patterns").select("*").eq("user_id", user.id),
      supabase.from("content_tags").select("hook_type, tone, post_style, content_intent, persona_id, topic, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("campaigns").select("id, name, goal, core_message, tone, cta_type").eq("is_active", true).eq("user_id", user.id),
      supabase.from("audience_personas").select("id, name, pain_points, goals").eq("user_id", user.id),
      supabase.from("business_profiles").select("company_summary, product_summary, differentiators, current_priorities").eq("user_id", user.id).maybeSingle(),
    ]);

    const patterns = patternsRes.data || [];
    const recentTags = tagsRes.data || [];
    const campaigns = campaignsRes.data || [];
    const personas = personasRes.data || [];
    const profile = profileRes.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build gap analysis data
    const recentHooks = recentTags.map((t: any) => t.hook_type).filter(Boolean);
    const recentTones = recentTags.map((t: any) => t.tone).filter(Boolean);
    const recentStyles = recentTags.map((t: any) => t.post_style).filter(Boolean);
    const recentPersonaIds = recentTags.map((t: any) => t.persona_id).filter(Boolean);

    const hookCounts: Record<string, number> = {};
    recentHooks.forEach((h: string) => { hookCounts[h] = (hookCounts[h] || 0) + 1; });

    const personaCounts: Record<string, number> = {};
    recentPersonaIds.forEach((p: string) => { personaCounts[p] = (personaCounts[p] || 0) + 1; });

    const allHookTypes = ["curiosity", "contrarian", "pain_driven", "data_bold", "story"];
    const underusedHooks = allHookTypes.filter(h => !hookCounts[h] || hookCounts[h] < 2);
    const underusedPersonas = personas.filter((p: any) => !personaCounts[p.id] || personaCounts[p.id] < 2);

    // Find best performing patterns
    const bestPatterns = patterns
      .filter((p: any) => p.sample_count >= 2)
      .sort((a: any, b: any) => b.avg_engagement_rate - a.avg_engagement_rate)
      .slice(0, 5);

    const prompt = `You are a LinkedIn content strategist. Based on the data below, recommend 3 specific posts the user should create next.

PERFORMANCE PATTERNS (what works):
${bestPatterns.map((p: any) => `${p.dimension}="${p.dimension_value}": ${p.avg_engagement_rate}% avg engagement (${p.sample_count} posts)`).join("\n") || "No patterns yet - suggest a diverse mix."}

RECENT CONTENT (last 50 posts):
- Hook types used: ${JSON.stringify(hookCounts)}
- Tones used: ${[...new Set(recentTones)].join(", ") || "none"}
- Styles used: ${[...new Set(recentStyles)].join(", ") || "none"}

GAPS:
- Underused hooks: ${underusedHooks.join(", ") || "none"}
- Underused personas: ${underusedPersonas.map((p: any) => p.name).join(", ") || "none"}

ACTIVE CAMPAIGNS:
${campaigns.map((c: any) => `- ${c.name} (goal: ${c.goal}, message: ${c.core_message || "N/A"})`).join("\n") || "No active campaigns"}

PERSONAS:
${personas.map((p: any) => `- ${p.name}: pain points ${JSON.stringify(p.pain_points || [])}`).join("\n") || "No personas defined"}

${profile ? `BUSINESS CONTEXT:
- Company: ${profile.company_summary || "N/A"}
- Product: ${profile.product_summary || "N/A"}
- Differentiators: ${JSON.stringify(profile.differentiators || [])}
- Priorities: ${JSON.stringify(profile.current_priorities || [])}` : ""}

Return VALID JSON only (no markdown):
{
  "recommendations": [
    {
      "topic": "specific post topic",
      "hook_type": "curiosity|contrarian|pain_driven|data_bold|story",
      "tone": "authoritative|emotional|conversational|bold",
      "persona_name": "target persona name",
      "content_type": "story|list|framework|hybrid|product_insight",
      "cta_type": "soft|medium|hard",
      "reason": "2-3 sentence explanation of why this post should be next"
    }
  ],
  "gap_analysis": {
    "underused_hooks": ["..."],
    "underused_personas": ["..."],
    "missing_topics": ["..."],
    "overused": ["..."]
  }
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
          { role: "system", content: "You are a strategic LinkedIn content advisor. Give specific, data-driven recommendations." },
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

    // Save recommendations
    for (const rec of (result.recommendations || [])) {
      await supabase.from("strategy_recommendations").insert({
        user_id: user.id,
        recommendation: rec,
        gap_analysis: result.gap_analysis || {},
        confidence: 0.7,
        status: "pending",
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-next error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
