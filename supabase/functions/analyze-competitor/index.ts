import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const { action, competitor_id, posts, knowledge } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (action === "analyze_posts") {
      // Analyze pasted competitor posts
      if (!posts || !Array.isArray(posts) || posts.length === 0) {
        throw new Error("Posts array is required");
      }

      const postsText = posts.map((p: string, i: number) => `Post ${i + 1}:\n${p}`).join("\n\n---\n\n");

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a LinkedIn content strategist specializing in B2B SaaS competitive analysis.

Analyze the provided competitor LinkedIn posts and return a JSON object with these fields:

1. "post_analyses": array of objects, one per post, each with:
   - "hook_style": (e.g. "question", "statistic", "bold claim", "story opener", "pain point")
   - "tone": (e.g. "professional", "casual", "thought leader", "salesy", "educational")
   - "topic": brief topic summary
   - "cta_type": (e.g. "link click", "comment engagement", "DM invite", "newsletter signup", "none")

2. "patterns": array of strings - recurring patterns across these posts
3. "overused_themes": array of strings - themes that are overused or generic
4. "gaps": array of strings - content gaps and missed opportunities competitors aren't covering
5. "suggested_angles": array of strings - unique angles a SaaS product (AI chatbot for customer support) could use to differentiate

Return ONLY valid JSON, no markdown fences.`,
            },
            {
              role: "user",
              content: postsText,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const analysis = JSON.parse(content);

      // Save post analyses to competitor_posts
      if (competitor_id && analysis.post_analyses) {
        for (let i = 0; i < posts.length; i++) {
          const pa = analysis.post_analyses[i];
          if (pa) {
            await supabase.from("competitor_posts").insert({
              user_id: user.id,
              competitor_id,
              content: posts[i],
              hook_style: pa.hook_style,
              tone: pa.tone,
              topic: pa.topic,
              cta_type: pa.cta_type,
            });
          }
        }
      }

      // Save insights
      if (competitor_id) {
        await supabase.from("competitor_insights").insert({
          user_id: user.id,
          competitor_id,
          patterns: analysis.patterns || [],
          overused_themes: analysis.overused_themes || [],
          gaps: analysis.gaps || [],
          suggested_angles: analysis.suggested_angles || [],
        });
      }

      return new Response(JSON.stringify({ analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "generate_from_gaps") {
      // Generate content ideas from competitor gaps
      if (!competitor_id) throw new Error("competitor_id is required");

      // Fetch latest insights for this competitor
      const { data: insights } = await supabase
        .from("competitor_insights")
        .select("*")
        .eq("competitor_id", competitor_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!insights) throw new Error("No insights found. Analyze competitor posts first.");

      const knowledgeBlock = knowledge
        ? `\n\nProduct context:\n- Product: ${knowledge.productDescription || "AI chatbot for customer support"}\n- Features: ${knowledge.features || ""}\n- Target audience: ${knowledge.targetAudience || ""}`
        : "";

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a B2B SaaS content strategist. Based on competitor analysis data, generate LinkedIn content ideas that exploit gaps and differentiate.${knowledgeBlock}

Return a JSON object with:
"ideas": array of 4-6 objects, each with:
  - "title": catchy idea title
  - "angle": the unique angle
  - "why_it_works": why this gap is an opportunity
  - "suggested_hook": a strong opening hook
  - "post_style": one of "product_insight", "pain_solution", "founder_tone", "educational", "soft_promotion"

Return ONLY valid JSON, no markdown fences.`,
            },
            {
              role: "user",
              content: `Competitor gaps: ${JSON.stringify(insights.gaps)}
Overused themes to avoid: ${JSON.stringify(insights.overused_themes)}
Suggested angles: ${JSON.stringify(insights.suggested_angles)}
Patterns they use: ${JSON.stringify(insights.patterns)}`,
            },
          ],
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Please try again." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (aiResponse.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error("AI gateway error");
      }

      const aiData = await aiResponse.json();
      let content = aiData.choices?.[0]?.message?.content || "";
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const result = JSON.parse(content);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (err) {
    console.error("analyze-competitor error:", err);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
