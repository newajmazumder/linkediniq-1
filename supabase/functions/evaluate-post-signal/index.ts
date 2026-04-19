// Evaluates a posted post: AI-scores comment quality + conversion intent + tags.
// Stores result in post_signals for the learning system.
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
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { post_plan_id, draft_id, content, hook_type, post_style, cta_type, format, phase, campaign_id } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let evaluation: any = { comment_quality: "unknown", conversion_signal_score: 0, conversion_intent: "" };

    if (LOVABLE_API_KEY && content) {
      const prompt = `Evaluate this LinkedIn post for likely engagement quality and conversion intent. Return strict JSON only.

POST: """${content.slice(0, 2000)}"""
HOOK_TYPE: ${hook_type || "?"}
CTA_TYPE: ${cta_type || "?"}
PHASE: ${phase || "?"}

Score:
- comment_quality: "shallow" (likes-bait), "medium" (drives comments), or "deep" (drives discussion / DMs)
- conversion_signal_score: 0-100 — how strongly this post moves the audience toward the goal
- conversion_intent: one short phrase like "demo interest", "list-builder", "brand awareness", "objection raised"

Return JSON: {"comment_quality":"...","conversion_signal_score":0,"conversion_intent":"..."}`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          let raw = j.choices?.[0]?.message?.content?.trim() || "";
          if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          evaluation = { ...evaluation, ...JSON.parse(raw) };
        }
      } catch (e) {
        console.error("ai eval failed", e);
      }
    }

    // Upsert signal
    const { data: existing } = await supabase
      .from("post_signals").select("id")
      .eq("user_id", user.id)
      .eq("post_plan_id", post_plan_id || "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    const payload = {
      user_id: user.id,
      campaign_id: campaign_id || null,
      post_plan_id: post_plan_id || null,
      draft_id: draft_id || null,
      hook_type: hook_type || null,
      post_style: post_style || null,
      cta_type: cta_type || null,
      format: format || null,
      phase: phase || null,
      comment_quality: evaluation.comment_quality || "unknown",
      conversion_signal_score: evaluation.conversion_signal_score || 0,
      conversion_intent: evaluation.conversion_intent || null,
      ai_evaluation: evaluation,
    };

    if (existing?.id) {
      await supabase.from("post_signals").update(payload).eq("id", existing.id);
    } else {
      await supabase.from("post_signals").insert(payload);
    }

    return new Response(JSON.stringify({ ok: true, evaluation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-post-signal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
