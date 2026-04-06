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

    // Fetch all posted drafts with performance data
    const { data: drafts, error: draftErr } = await supabase
      .from("drafts")
      .select("id, custom_content, status, ideas(idea_title, instruction)")
      .eq("status", "posted")
      .eq("user_id", user.id);

    if (draftErr) throw draftErr;

    const { data: performances, error: perfErr } = await supabase
      .from("post_performance")
      .select("*")
      .eq("user_id", user.id);

    if (perfErr) throw perfErr;

    // Build enriched dataset
    const enriched = (drafts || []).map((d: any) => {
      const perf = (performances || []).find((p: any) => p.draft_id === d.id);
      return {
        title: d.ideas?.idea_title || "Untitled",
        content_preview: (d.custom_content || "").slice(0, 200),
        impressions: perf?.impressions || 0,
        likes: perf?.likes || 0,
        comments: perf?.comments || 0,
        engagement_rate: perf && perf.impressions > 0
          ? ((perf.likes + perf.comments) / perf.impressions * 100).toFixed(2) + "%"
          : "0%",
      };
    });

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
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `You are a LinkedIn content strategist. Analyze these post performance metrics and provide actionable insights.

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
  }
}

Be specific and reference the actual data. If there's limited data, still provide your best analysis. Return ONLY valid JSON.`;

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
