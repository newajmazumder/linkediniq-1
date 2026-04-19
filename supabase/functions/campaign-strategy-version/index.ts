// Strategy Versioning — captures the current strategy as v1, then can revise
// to v2/v3 based on observed evidence. Each version is immutable history.
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

    const body = await req.json().catch(() => ({}));
    const campaign_id: string | undefined = body.campaign_id;
    const action: "snapshot" | "revise" | "list" = body.action || "snapshot";
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- LIST ----
    if (action === "list") {
      const { data: versions } = await supabase
        .from("campaign_strategy_versions")
        .select("*")
        .eq("campaign_id", campaign_id)
        .order("version_number", { ascending: true });
      return new Response(JSON.stringify({ ok: true, versions: versions || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull current state
    const [
      { data: campaign },
      { data: weekPlans },
      { data: postPlans },
      { data: signals },
      { data: existingVersions },
    ] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabase.from("campaign_week_plans").select("*").eq("campaign_id", campaign_id).order("week_number"),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("post_signals").select("*").eq("campaign_id", campaign_id),
      supabase.from("campaign_strategy_versions").select("*").eq("campaign_id", campaign_id).order("version_number"),
    ]);

    if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const allPlans = postPlans || [];
    const allSignals = signals || [];
    const totalPosts = allPlans.length;
    const posted = allPlans.filter((p: any) => p.status === "posted" || !!p.linked_post_id).length;
    const postingPct = totalPosts > 0 ? Math.round((posted / totalPosts) * 100) : 0;
    const goalCurrent = campaign.current_goal_value || 0;
    const goalTarget = campaign.target_quantity || 0;
    const goalPct = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;

    // Build evidence snapshot used for both snapshot + revise
    const evidence = {
      execution: { total_posts: totalPosts, posted, posting_pct: postingPct },
      performance: {
        signals: allSignals.length,
        goal_current: goalCurrent,
        goal_target: goalTarget,
        goal_pct: goalPct,
      },
      captured_at: new Date().toISOString(),
    };

    // Helper: derive default phase plan from week plans
    const defaultPhasePlan = (weekPlans || []).map((w: any) => ({
      week: w.week_number,
      purpose: w.week_purpose || w.weekly_goal,
      message: w.primary_message,
      cta: w.cta_strategy,
      post_count: w.recommended_post_count || 2,
    }));

    // ---- SNAPSHOT v1 ----
    if (action === "snapshot") {
      // Idempotent: only create v1 if none exists
      if ((existingVersions || []).length > 0) {
        return new Response(JSON.stringify({
          ok: true,
          skipped: true,
          message: "Strategy versions already exist",
          versions: existingVersions,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const v1 = {
        user_id: user.id,
        campaign_id,
        version_number: 1,
        is_active: true,
        strategy_thesis: campaign.core_message ||
          `Drive ${campaign.target_quantity || ""} ${campaign.target_metric || "results"} via a ${(campaign.tone || "friendly")} ${(campaign.primary_objective || "awareness")} sequence.`,
        phase_plan: defaultPhasePlan,
        cta_progression: defaultPhasePlan.map((p: any) => p.cta).filter(Boolean),
        hypotheses: [
          { hypothesis: "Awareness posts will drive enough engagement to support proof posts later.", confidence: "untested" },
          { hypothesis: `${campaign.cta_type || "soft"} CTAs are the right pressure for ${campaign.target_metric || "this goal"}.`, confidence: "untested" },
        ],
        evidence_snapshot: evidence,
        reason_for_revision: null,
      };

      const { data: inserted, error: insErr } = await supabase
        .from("campaign_strategy_versions")
        .insert(v1)
        .select()
        .single();
      if (insErr) throw insErr;

      return new Response(JSON.stringify({ ok: true, version: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- REVISE → create new version ----
    if (action === "revise") {
      const versions = existingVersions || [];
      const lastVersion = versions[versions.length - 1];
      const nextNum = (lastVersion?.version_number || 0) + 1;

      // Pattern aggregation for evidence-driven revision
      const byHook: Record<string, { count: number; conv: number }> = {};
      const byCta: Record<string, { count: number; conv: number }> = {};
      for (const s of allSignals as any[]) {
        if (s.hook_type) { byHook[s.hook_type] ||= { count: 0, conv: 0 }; byHook[s.hook_type].count++; byHook[s.hook_type].conv += s.conversion_signal_score || 0; }
        if (s.cta_type) { byCta[s.cta_type] ||= { count: 0, conv: 0 }; byCta[s.cta_type].count++; byCta[s.cta_type].conv += s.conversion_signal_score || 0; }
      }
      const winningHook = Object.entries(byHook)
        .map(([k, v]) => ({ k, avg: v.conv / Math.max(1, v.count), n: v.count }))
        .filter(x => x.n >= 2)
        .sort((a, b) => b.avg - a.avg)[0];
      const winningCta = Object.entries(byCta)
        .map(([k, v]) => ({ k, avg: v.conv / Math.max(1, v.count), n: v.count }))
        .filter(x => x.n >= 2)
        .sort((a, b) => b.avg - a.avg)[0];

      // Use AI to articulate the thesis change
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      let aiRevision: any = null;
      if (LOVABLE_API_KEY && allSignals.length >= 2) {
        const prompt = `You are a senior LinkedIn campaign strategist. The user's current strategy needs revision based on evidence.

CURRENT STRATEGY (v${lastVersion?.version_number || 1}):
- Thesis: ${lastVersion?.strategy_thesis || campaign.core_message}
- Goal: ${campaign.target_quantity} ${campaign.target_metric}
- CTA style: ${campaign.cta_type}

EVIDENCE FROM ${allSignals.length} POSTED POSTS:
- Goal progress: ${goalPct}% (${goalCurrent}/${goalTarget})
- Execution: ${postingPct}% of plan posted
- Winning hook (avg conv score): ${winningHook ? `${winningHook.k} (${Math.round(winningHook.avg)} across ${winningHook.n} posts)` : "no clear pattern yet"}
- Winning CTA: ${winningCta ? `${winningCta.k} (${Math.round(winningCta.avg)} across ${winningCta.n} posts)` : "no clear pattern yet"}

User-provided reason: ${body.reason || "Performance below target."}

Return STRICT JSON:
{
  "new_thesis": "1-sentence revised strategic thesis",
  "reason_for_revision": "2-3 sentence honest explanation of WHY the strategy is changing",
  "phase_changes": ["bullet of what's different in phase plan"],
  "cta_progression": ["soft", "medium", "direct"],
  "hypotheses": [{"hypothesis": "...", "confidence": "low|medium|high"}]
}`;
        try {
          const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [{ role: "user", content: prompt }],
            }),
          });
          if (r.ok) {
            const j = await r.json();
            let raw = j.choices?.[0]?.message?.content?.trim() || "";
            if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
            aiRevision = JSON.parse(raw);
          }
        } catch (e) {
          console.error("AI revision failed", e);
        }
      }

      const newVersion = {
        user_id: user.id,
        campaign_id,
        version_number: nextNum,
        is_active: true,
        strategy_thesis: aiRevision?.new_thesis || lastVersion?.strategy_thesis || campaign.core_message,
        phase_plan: defaultPhasePlan,
        cta_progression: aiRevision?.cta_progression || lastVersion?.cta_progression || [],
        hypotheses: aiRevision?.hypotheses || [
          { hypothesis: winningHook ? `Doubling down on ${winningHook.k} hook will keep engagement up.` : "Need more data.", confidence: winningHook && winningHook.n >= 3 ? "medium" : "low" },
        ],
        evidence_snapshot: { ...evidence, winning_hook: winningHook || null, winning_cta: winningCta || null },
        reason_for_revision: aiRevision?.reason_for_revision || body.reason || `Goal at ${goalPct}%, execution at ${postingPct}%. Time to revise.`,
      };

      // Deactivate previous
      if (lastVersion) {
        await supabase.from("campaign_strategy_versions")
          .update({ is_active: false })
          .eq("id", lastVersion.id);
      }

      const { data: inserted, error: insErr } = await supabase
        .from("campaign_strategy_versions")
        .insert(newVersion)
        .select()
        .single();
      if (insErr) throw insErr;

      return new Response(JSON.stringify({ ok: true, version: inserted }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campaign-strategy-version error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
