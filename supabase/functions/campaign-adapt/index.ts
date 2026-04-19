// Weekly adaptive engine. Reads post_signals + plan, generates pattern insights
// and concrete IMPACT-DRIVEN COMMANDS (where / what / why / expected_impact)
// for upcoming posts — no abstract tips.
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

    const body = await req.json();
    const { campaign_id, action, adaptation_id, adjustment_index } = body || {};
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- APPLY ACTION: actually mutate the plan based on a stored adjustment ----
    if (action === "apply" && adaptation_id) {
      const { data: adaptation, error: aErr } = await supabase
        .from("campaign_adaptations").select("*").eq("id", adaptation_id).maybeSingle();
      if (aErr || !adaptation) {
        return new Response(JSON.stringify({ error: "Adaptation not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const adj = (adaptation.adjustments || [])[adjustment_index ?? 0];
      if (!adj) return new Response(JSON.stringify({ error: "No such adjustment" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Parse "Post N" target → mutate that plan row
      const m = String(adj.where || adj.target || "").match(/Post\s*(\d+)/i);
      const applied: any[] = [];
      if (m) {
        const postNumber = parseInt(m[1], 10);
        const { data: planRow } = await supabase
          .from("campaign_post_plans")
          .select("*")
          .eq("campaign_id", campaign_id)
          .eq("post_number", postNumber)
          .maybeSingle();
        if (planRow) {
          const updates: Record<string, any> = {};
          const what = String(adj.what || adj.change || "").toLowerCase();
          // Pattern-match command verbs onto plan fields
          if (adj.type === "hook_shift" || /hook|headline|opening/.test(what)) {
            // Try to extract a hook type from the command itself
            const hookMatch = String(adj.what || "").match(/(financial[-\s]?loss|pain|curiosity|story|stat|contrarian|question|authority|how[-\s]?to)/i);
            if (hookMatch) updates.suggested_hook_type = hookMatch[1].toLowerCase().replace(/[\s-]/g, "_");
          }
          if (adj.type === "cta_change" || /cta/.test(what)) {
            const ctaMatch = String(adj.what || "").match(/(direct|soft|book|demo|signup|download|reply|comment)/i);
            if (ctaMatch) updates.suggested_cta_type = ctaMatch[1].toLowerCase();
          }
          if (adj.type === "format" || /format|carousel|video|text/.test(what)) {
            const fmtMatch = String(adj.what || "").match(/(text|carousel|video|image)/i);
            if (fmtMatch) updates.recommended_format = fmtMatch[1].toLowerCase();
          }
          // Always append the AI rationale to strategic_rationale so the user sees why
          const reasonAppend = `[Adapted: ${adj.what || ""} — ${adj.why || ""}]`;
          updates.strategic_rationale = planRow.strategic_rationale
            ? `${planRow.strategic_rationale}\n${reasonAppend}`
            : reasonAppend;

          await supabase.from("campaign_post_plans").update(updates).eq("id", planRow.id);
          applied.push({ post_number: postNumber, updates });
        }
      }

      const newApplied = [...(adaptation.applied_changes || []), { adjustment, applied, applied_at: new Date().toISOString() } as any];
      // Rename to keep compiler happy without unused var warning
      const adjustment = adj;
      const persistedApplied = [...(adaptation.applied_changes || []), { adjustment, applied, applied_at: new Date().toISOString() }];
      await supabase.from("campaign_adaptations")
        .update({ applied_changes: persistedApplied, status: applied.length ? "applied" : adaptation.status, applied_at: new Date().toISOString() })
        .eq("id", adaptation_id);

      return new Response(JSON.stringify({ ok: true, applied }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    const upcomingSummary = upcomingPlans.slice(0, 8).map((p: any) => ({
      post: `Post ${p.post_number}`,
      week: p.week_number,
      hook: p.suggested_hook_type,
      cta: p.suggested_cta_type,
      format: p.recommended_format,
      objective: p.post_objective,
    }));

    let adjustments: any[] = [];
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY) {
      const prompt = `You are a LinkedIn campaign strategist. Convert the performance evidence below into 2-4 IMPACT-DRIVEN COMMANDS for specific upcoming posts.

EVIDENCE
- Goal: ${campaign.target_quantity || "?"} ${campaign.target_metric || campaign.primary_objective}
- Hook performance (sorted by conversion): ${JSON.stringify(hookPatterns.slice(0, 5))}
- CTA performance (sorted by conversion): ${JSON.stringify(ctaPatterns.slice(0, 5))}
- Signals collected: ${(signals || []).length}
- Upcoming posts: ${JSON.stringify(upcomingSummary)}

RULES
- Each command MUST target a specific upcoming post (use "Post N" from the upcoming list).
- Each command MUST cite the evidence (e.g., "Hook X has 71% higher conversion than Y").
- Each command MUST give an expected impact range tied to the goal metric.
- No vague advice ("test more", "improve hook"). Be surgical.

Return STRICT JSON in this shape (no prose, no markdown):
{
  "patterns_observed": "one-line insight",
  "predicted_impact": "what changes if all commands are applied",
  "adjustments": [
    {
      "type": "hook_shift" | "cta_change" | "cadence" | "format",
      "where": "Post 3",
      "what": "Rewrite headline using Financial-loss hook",
      "why": "Posts 1 & 4 with this hook drove 71% of bookings",
      "expected_impact": "+2-4 bookings"
    }
  ]
}`;
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (aiRes.ok) {
          const j = await aiRes.json();
          let raw = j.choices?.[0]?.message?.content?.trim() || "";
          if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          const parsed = JSON.parse(raw);
          adjustments = (parsed.adjustments || []).map((a: any) => ({
            type: a.type || "hook_shift",
            where: a.where || a.target || "upcoming posts",
            what: a.what || a.change || "",
            why: a.why || a.rationale || "",
            expected_impact: a.expected_impact || a.impact || "",
            // keep legacy fields too for older renderers
            target: a.where || a.target || "",
            change: a.what || a.change || "",
            rationale: a.why || a.rationale || "",
          }));

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
