// Campaign Brain — assembles the live "Campaign Intelligence Memory" object
// from all relevant tables. Single source of truth for AI prompts and UI.
// Also detects critical info gaps and creates proactive Advisor questions.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Severity = "low" | "medium" | "high";
type Confidence = "low" | "medium" | "high";

function confidenceFromSamples(n: number): Confidence {
  if (n >= 6) return "high";
  if (n >= 3) return "medium";
  return "low";
}

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
    if (!campaign_id) return new Response(JSON.stringify({ error: "campaign_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ---- 1. Pull every relevant slice in parallel ----
    const [
      { data: campaign },
      { data: business },
      { data: signals },
      { data: plans },
      { data: weekPlans },
      { data: blueprint },
      { data: existingQuestions },
    ] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).maybeSingle(),
      supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("post_signals").select("*").eq("campaign_id", campaign_id),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", campaign_id).order("post_number"),
      supabase.from("campaign_week_plans").select("*").eq("campaign_id", campaign_id).order("week_number"),
      supabase.from("campaign_blueprints").select("*").eq("campaign_id", campaign_id).maybeSingle(),
      supabase.from("campaign_advisor_questions").select("*").eq("campaign_id", campaign_id),
    ]);

    if (!campaign) return new Response(JSON.stringify({ error: "Campaign not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Personas (optional)
    const personaIds = [campaign.primary_persona_id, campaign.secondary_persona_id].filter(Boolean);
    const { data: personas } = personaIds.length
      ? await supabase.from("audience_personas").select("*").in("id", personaIds as string[])
      : { data: [] as any[] };

    // ---- 2. Aggregate execution state ----
    const allPlans = plans || [];
    const totalPlanned = allPlans.length;

    // Self-heal: a plan also counts as posted if its draft has a published linkedin_post.
    const draftIds = allPlans.map((p: any) => p.linked_draft_id).filter(Boolean);
    let publishedDraftIds = new Set<string>();
    if (draftIds.length) {
      const { data: liPosts } = await supabase
        .from("linkedin_posts")
        .select("linked_draft_id")
        .in("linked_draft_id", draftIds as string[]);
      publishedDraftIds = new Set((liPosts || []).map((r: any) => r.linked_draft_id).filter(Boolean));
    }
    const isPosted = (p: any) =>
      p.status === "posted" || !!p.linked_post_id || (p.linked_draft_id && publishedDraftIds.has(p.linked_draft_id));

    const posted = allPlans.filter(isPosted).length;
    const drafted = allPlans.filter((p: any) => !isPosted(p) && p.status === "drafted").length;
    const missed = allPlans.filter((p: any) => p.status === "missed").length;
    const postingPct = totalPlanned > 0 ? Math.round((posted / totalPlanned) * 100) : 0;

    // ---- 3. Aggregate performance ----
    const allSignals = signals || [];
    const signalsCount = allSignals.length;
    const totalImpressions = allSignals.reduce((a: number, s: any) => a + (s.impressions || 0), 0);
    const totalClicks = allSignals.reduce((a: number, s: any) => a + (s.clicks || 0), 0);
    const totalEngagement = allSignals.reduce((a: number, s: any) => a + (s.engagement || 0), 0);
    const goalCurrent = campaign.current_goal_value || 0;
    const goalTarget = campaign.target_quantity || 0;
    const goalPct = goalTarget > 0 ? Math.round((goalCurrent / goalTarget) * 100) : 0;

    // ---- 4. Pattern aggregation (Layer 5) ----
    const byHook: Record<string, { count: number; engage: number; convert: number }> = {};
    const byCta: Record<string, { count: number; engage: number; convert: number }> = {};
    const byFormat: Record<string, { count: number; engage: number; convert: number }> = {};
    for (const s of allSignals as any[]) {
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
      if (s.format) {
        const f = byFormat[s.format] ||= { count: 0, engage: 0, convert: 0 };
        f.count++; f.engage += eng; f.convert += conv;
      }
    }
    const summarize = (m: Record<string, { count: number; engage: number; convert: number }>) =>
      Object.entries(m).map(([k, v]) => ({
        key: k,
        sample_count: v.count,
        avg_engagement: Math.round(v.engage / Math.max(1, v.count)),
        avg_conversion: Math.round(v.convert / Math.max(1, v.count)),
        confidence: confidenceFromSamples(v.count),
      })).sort((a, b) => b.avg_conversion - a.avg_conversion);

    const hookPatterns = summarize(byHook);
    const ctaPatterns = summarize(byCta);
    const formatPatterns = summarize(byFormat);

    const winningHook = hookPatterns.find(p => p.confidence !== "low" && p.avg_conversion > 0) || null;
    const winningCta = ctaPatterns.find(p => p.confidence !== "low" && p.avg_conversion > 0) || null;
    const overallConfidence = confidenceFromSamples(signalsCount);

    // ---- 5. Build the Campaign Intelligence Memory object ----
    const intelligence = {
      generated_at: new Date().toISOString(),
      confidence: overallConfidence,
      business: business ? {
        company: business.company_summary,
        product: business.product_summary,
        target_audience: business.target_audience,
        differentiators: business.differentiators || [],
        valid_ctas: business.valid_ctas || [],
        offers: business.offers_campaigns || [],
        brand_tone: business.brand_tone,
      } : null,
      campaign: {
        name: campaign.name,
        goal_metric: campaign.target_metric,
        target: campaign.target_quantity,
        primary_objective: campaign.primary_objective,
        timeframe: campaign.target_timeframe,
        offer: campaign.offer,
        cta_type: campaign.cta_type,
        core_message: campaign.core_message,
        started_at: campaign.started_at,
        target_start_date: campaign.target_start_date,
        execution_status: campaign.execution_status,
      },
      personas: (personas || []).map((p: any) => ({
        name: p.name, awareness_level: p.awareness_level,
        pain_points: p.pain_points, goals: p.goals, objections: p.objections,
      })),
      execution: {
        total_planned: totalPlanned,
        posted, drafted, missed,
        posting_pct: postingPct,
        weeks: (weekPlans || []).length,
      },
      performance: {
        signals_count: signalsCount,
        total_impressions: totalImpressions,
        total_clicks: totalClicks,
        total_engagement: totalEngagement,
        goal_current: goalCurrent,
        goal_target: goalTarget,
        goal_pct: goalPct,
      },
      learning: {
        confidence: overallConfidence,
        hook_patterns: hookPatterns.slice(0, 5),
        cta_patterns: ctaPatterns.slice(0, 5),
        format_patterns: formatPatterns.slice(0, 5),
        winning_hook: winningHook,
        winning_cta: winningCta,
      },
    };

    // ---- 6. Advisor: detect missing critical info ----
    type GapQ = { key: string; question: string; why: string; severity: Severity };
    const detected: GapQ[] = [];

    const isConversionGoal = ["demo_bookings", "leads", "dms", "sales", "signups"].includes(
      String(campaign.target_metric || "").toLowerCase().replace(/\s+/g, "_"),
    );

    if (isConversionGoal && !campaign.offer) {
      detected.push({
        key: "missing_offer",
        question: `Your goal is "${campaign.target_metric}" but no offer is defined. What exactly are you offering people who say yes?`,
        why: "Without a clear offer, the AI cannot generate CTAs that convert — only soft awareness posts.",
        severity: "high",
      });
    }

    if (isConversionGoal && totalClicks > 5 && goalCurrent === 0) {
      detected.push({
        key: "missing_landing_page",
        question: "We see clicks but zero attributed conversions. Where does your CTA send people?",
        why: "We can interpret performance honestly only if we know whether the landing page or the post is the bottleneck.",
        severity: "high",
      });
    }

    if (!campaign.primary_persona_id) {
      detected.push({
        key: "missing_persona",
        question: "No primary persona is selected for this campaign. Who specifically are you trying to reach?",
        why: "Persona drives hook style, pain framing, and CTA tone. Generic targeting → generic posts.",
        severity: "medium",
      });
    }

    if (!campaign.core_message) {
      detected.push({
        key: "missing_core_message",
        question: "What's the one core message this campaign should hammer across every post?",
        why: "Without a unifying thesis, posts drift and the audience never builds a single mental association.",
        severity: "medium",
      });
    }

    if (postingPct < 50 && totalPlanned >= 4 && goalPct < 20) {
      detected.push({
        key: "execution_gap",
        question: `Only ${posted}/${totalPlanned} planned posts are live. Is something blocking execution?`,
        why: "Underperformance here is an execution problem, not a strategy problem. Strategy revisions won't help.",
        severity: "high",
      });
    }

    // Upsert advisor questions (idempotent on question_key)
    const existingKeys = new Set((existingQuestions || []).map((q: any) => q.question_key));
    const toInsert = detected
      .filter(d => !existingKeys.has(d.key))
      .map(d => ({
        user_id: user.id,
        campaign_id,
        question_key: d.key,
        question: d.question,
        why_it_matters: d.why,
        severity: d.severity,
        status: "open",
      }));
    if (toInsert.length > 0) {
      await supabase.from("campaign_advisor_questions").insert(toInsert);
    }

    // ---- 7. Persist intelligence snapshot on campaigns ----
    await supabase.from("campaigns")
      .update({
        intelligence_snapshot: intelligence,
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq("id", campaign_id);

    // Re-fetch advisor questions so caller has full state
    const { data: advisorQuestions } = await supabase
      .from("campaign_advisor_questions")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("created_at", { ascending: false });

    return new Response(JSON.stringify({
      ok: true,
      intelligence,
      advisor_questions: advisorQuestions || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("campaign-brain error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
