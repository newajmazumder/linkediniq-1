import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { competitor_id, competitor_name, posts } = await req.json();
    if (!competitor_id || !posts || posts.length < 2) {
      throw new Error("Need at least 2 posts to analyze");
    }

    const postsText = posts.map((p: any, i: number) =>
      `POST ${i + 1}${p.topic ? ` (Topic: ${p.topic})` : ""}:\n${p.content}`
    ).join("\n\n---\n\n");

    const prompt = `You are a competitive content intelligence analyst for LinkedIn. Analyze these ${posts.length} posts from competitor "${competitor_name || "Unknown"}".

${postsText}

Provide a strategic analysis as JSON with this EXACT structure:
{
  "patterns": ["<pattern 1: recurring content structure, hook style, posting rhythm, etc.>", "<pattern 2>", "<pattern 3>"],
  "gaps": ["<gap 1: topic/angle they're NOT covering that could be an opportunity>", "<gap 2>", "<gap 3>"],
  "overused_themes": ["<theme 1: themes they repeat too much, creating audience fatigue>", "<theme 2>"],
  "suggested_angles": ["<angle 1: specific content angle the user could use to differentiate>", "<angle 2>", "<angle 3>"],
  "hook_styles": ["<hook style 1 they frequently use>", "<hook style 2>"],
  "tone_profile": "<brief description of their overall tone>",
  "cta_patterns": ["<CTA pattern 1>", "<CTA pattern 2>"]
}

Also classify each post. Return an additional "post_classifications" array:
[
  {"index": 0, "hook_style": "<type>", "tone": "<type>", "cta_type": "<type or none>"}
]

Return ONLY valid JSON with both top-level keys: the analysis object AND "post_classifications" array.
Wrap everything in a single JSON object.`;

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

    if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);

    const aiData = await aiResp.json();
    const raw = aiData.choices?.[0]?.message?.content || "{}";
    let cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(cleaned);

    // Update post classifications
    if (parsed.post_classifications && Array.isArray(parsed.post_classifications)) {
      for (const cls of parsed.post_classifications) {
        const post = posts[cls.index];
        if (post?.id) {
          await supabase.from("competitor_posts").update({
            hook_style: cls.hook_style || null,
            tone: cls.tone || null,
            cta_type: cls.cta_type || null,
          }).eq("id", post.id);
        }
      }
    }

    // Upsert insights
    await supabase.from("competitor_insights").upsert({
      user_id: user.id,
      competitor_id,
      patterns: parsed.patterns || [],
      gaps: parsed.gaps || [],
      overused_themes: parsed.overused_themes || [],
      suggested_angles: parsed.suggested_angles || [],
    }, { onConflict: "competitor_id" });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
