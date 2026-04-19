// Daily cron worker. Recomputes execution metrics for every campaign,
// flips state (planned → active → at_risk → completed/failed),
// and marks overdue posts as MISSED.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const dayMs = 24 * 60 * 60 * 1000;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

type CampaignRow = {
  id: string;
  user_id: string;
  execution_status: string;
  started_at: string | null;
  target_start_date: string | null;
  target_quantity: number | null;
  target_metric: string | null;
};

async function tickCampaign(supabase: any, campaign: CampaignRow): Promise<{ id: string; state: string; missed: number; execScore: number }> {
  // 1) Load post plans + signals
  const [{ data: plans }, { data: signals }, { data: progress }] = await Promise.all([
    supabase.from("campaign_post_plans").select("id, status, planned_date, posted_at, week_number").eq("campaign_id", campaign.id),
    supabase.from("post_signals").select("conversion_signal_score, cta_type, hook_type").eq("campaign_id", campaign.id),
    supabase.from("campaign_progress").select("current_value, target_value").eq("campaign_id", campaign.id).maybeSingle(),
  ]);

  const postPlans = plans || [];
  const postSignals = signals || [];
  const now = new Date();

  // 2) Mark MISSED: planned_date < now AND status in (planned/drafted/scheduled)
  const overdue = postPlans.filter((p: any) =>
    p.planned_date && new Date(p.planned_date).getTime() < now.getTime() - dayMs &&
    ["planned", "drafted", "scheduled"].includes(p.status || "planned")
  );
  if (overdue.length > 0) {
    await supabase
      .from("campaign_post_plans")
      .update({ status: "missed", missed_at: now.toISOString() })
      .in("id", overdue.map((p: any) => p.id));
    overdue.forEach((p: any) => { p.status = "missed"; });
  }

  // 3) Recompute metrics
  const totalPlanned = postPlans.length;
  const posted = postPlans.filter((p: any) => p.status === "posted").length;
  const missed = postPlans.filter((p: any) => p.status === "missed").length;
  const scheduled = postPlans.filter((p: any) => p.status === "scheduled").length;
  const drafted = postPlans.filter((p: any) => p.status === "drafted").length;

  const onTimePosts = postPlans.filter((p: any) => {
    if (p.status !== "posted" || !p.posted_at || !p.planned_date) return false;
    return new Date(p.posted_at).getTime() <= new Date(p.planned_date).getTime() + dayMs;
  }).length;

  const ctaRate = postSignals.length > 0
    ? postSignals.filter((s: any) => s.cta_type && s.cta_type !== "none").length / postSignals.length
    : 0;

  const start = campaign.started_at ? new Date(campaign.started_at) : (campaign.target_start_date ? new Date(campaign.target_start_date) : null);
  const totalWeeks = Math.max(1, Math.ceil(totalPlanned / 5)); // approx 5 posts/wk
  const end = start ? new Date(start.getTime() + totalWeeks * 7 * dayMs) : null;
  const daysTotal = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs)) : 7;
  const daysElapsed = start ? clamp(Math.round((now.getTime() - start.getTime()) / dayMs), 0, daysTotal) : 0;
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);
  const weeksElapsed = Math.max(1, daysElapsed / 7);
  const weeksTotal = Math.max(1, daysTotal / 7);
  const velocityActual = Math.round((posted / weeksElapsed) * 10) / 10;
  const velocityRequired = Math.round((totalPlanned / weeksTotal) * 10) / 10;
  const velocityScore = velocityRequired > 0 ? clamp(velocityActual / velocityRequired, 0, 1.5) : 0;

  const postedRate = totalPlanned > 0 ? posted / totalPlanned : 0;
  const onTimeRate = posted > 0 ? onTimePosts / posted : 0;
  const executionScore = Math.round((postedRate * 0.5 + onTimeRate * 0.3 + ctaRate * 0.2) * 100) / 10;

  // 4) Derive new state
  let nextState = campaign.execution_status;
  const goalReached = !!(progress?.current_value && progress?.target_value && progress.current_value >= progress.target_value);
  if (!["paused", "completed", "failed"].includes(campaign.execution_status)) {
    if (campaign.execution_status === "planned") {
      if (posted > 0 || scheduled > 0 || daysElapsed > 0) nextState = "active";
    } else {
      const ended = daysRemaining === 0 && daysTotal > 0;
      if (ended) {
        nextState = goalReached || posted >= totalPlanned * 0.8 ? "completed" : "failed";
      } else {
        const missedRate = totalPlanned > 0 ? missed / totalPlanned : 0;
        const inConversion = daysElapsed / Math.max(1, daysTotal) > 0.66;
        const noCtaInConversion = inConversion && ctaRate < 0.3;
        if (missedRate > 0.3 || velocityScore < 0.5 || noCtaInConversion) nextState = "at_risk";
        else nextState = "active";
      }
    }
  }

  // 5) Persist
  const updates: any = {
    execution_status: nextState,
    execution_score: executionScore,
    velocity_score: Math.round(velocityScore * 100) / 100,
    last_evaluated_at: now.toISOString(),
  };
  if (nextState !== "planned" && !campaign.started_at) updates.started_at = now.toISOString();
  if (nextState === "completed" || nextState === "failed") updates.completed_at = now.toISOString();

  await supabase.from("campaigns").update(updates).eq("id", campaign.id);

  return { id: campaign.id, state: nextState, missed: overdue.length, execScore: executionScore };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Service-role client — this runs unauthenticated from cron.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let campaignFilter: { id?: string } = {};
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.campaign_id) campaignFilter.id = body.campaign_id;
      } catch { /* ignore */ }
    }

    let q = supabase.from("campaigns").select("id, user_id, execution_status, started_at, target_start_date, target_quantity, target_metric");
    if (campaignFilter.id) q = q.eq("id", campaignFilter.id);
    const { data: campaigns, error } = await q;
    if (error) throw error;

    const results = [];
    for (const c of (campaigns || []) as CampaignRow[]) {
      try {
        results.push(await tickCampaign(supabase, c));
      } catch (e) {
        console.error("tick failed for", c.id, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("execution-tick error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
