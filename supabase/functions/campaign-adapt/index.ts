// Weekly adaptive engine. Reads post_signals + plan, generates pattern insights
// and concrete adjustments (hook, CTA, cadence) for upcoming weeks.
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

    const { campaign_id } = await req.json();
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const [{ data: campaign }, { data: signals }, { data: plans }] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabase.from("post_signals").select("*").eq("campaign_id", campaign_id),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
    ]);

    if (!campaign) throw new Error("Campaign not found");

    // Aggregate patterns by hook_type and cta_type
    const byHook: Record<string, { count: number; engage: number; convert: number }> = {};
    const byCta: Record<string, { count: number; engage: number; convert: number }> = {};
    for (const s of (signals || []) as any[]) {
      const eng = s.engagement || 0;
      const conv = s.conversion_signal_score || 0;
      if (s.hook_type) {
        const h = byHook[s.hook_type] ||= { count: 0, engage: 0, convert: 0 };
        h.count++; h.engage += eng; h.convert += conv;
      }
      if (s.cta_type) {
        const c = byCta[s.cta_type] ||= { count: 0, engage: 0, convert: 0 };
        c.count++; c.engage += eng; c.convert += conv;
      }
    }

    const summarize = (m: Record<string, { count: number; engage: number; convert: number }>) =>
      Object.entries(m).map(([k, v]) => ({
        key: k, count: v.count,
        avg_engagement: Math.round(v.engage / Math.max(1, v.count)),
        avg_conversion: Math.round(v.convert / Math.max(1, v.count)),
      })).sort((a, b) => b.avg_conversion - a.avg_conversion);

    const hookPatterns = summarize(byHook);
    const ctaPatterns = summarize(byCta);

    const upcomingPlans = (plans || []).filter((p: any) => p.status === "planned" || p.status === "drafted");

    let adjustments: any[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY) {
      const prompt = `You are a LinkedIn campaign strategist. Based on real performance signals from this campaign, recommend 2-4 SPECIFIC adjustments for upcoming posts.

CAMPAIGN GOAL: ${campaign.target_quantity || "?"} ${campaign.target_metric || campaign.primary_objective}
HOOK PERFORMANCE (sorted by conversion): ${JSON.stringify(hookPatterns.slice(0, 5))}
CTA PERFORMANCE (sorted by conversion): ${JSON.stringify(ctaPatterns.slice(0, 5))}
UPCOMING POSTS: ${upcomingPlans.length}
SIGNALS COLLECTED: ${(signals || []).length}

Return strict JSON:
{
  "patterns_observed": "one-line insight",
  "predicted_impact": "what changes if these are applied",
  "adjustments": [
    {"type": "hook_shift|cta_change|cadence|format", "target": "which posts/weeks", "change": "specific action", "rationale": "why"}
  ]
}`;
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          let raw = j.choices?.[0]?.message?.content?.trim() || "";
          if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          const parsed = JSON.parse(raw);
          adjustments = parsed.adjustments || [];

          await supabase.from("campaign_adaptations").insert({
            user_id: user.id,
            campaign_id,
            trigger_reason: "weekly_review",
            adjustments,
            patterns_observed: { hooks: hookPatterns, ctas: ctaPatterns, summary: parsed.patterns_observed },
            predicted_impact: parsed.predicted_impact || null,
            status: "pending",
          });
        }
      } catch (e) {
        console.error("ai adapt failed", e);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      adjustments,
      patterns: { hooks: hookPatterns, ctas: ctaPatterns },
      signals_count: (signals || []).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("campaign-adapt error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
