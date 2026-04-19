// ExecutionDashboard — surfaces the closed-loop execution metrics
// (Execution Score, Velocity Gap, Missed Posts, Predicted Outcome)
// with CAUSAL copy that ties every number back to the goal.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, ArrowRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  computeExecutionMetrics, deriveExecutionStatus, buildExecutionDiagnostic,
  predictOutcome, EXECUTION_STATUS_META, type ExecutionStatus, type PostPlanLite, type PostSignalLite,
} from "@/lib/execution";
import { computeRequiredVelocity } from "@/lib/campaign-projection";
import { toast } from "sonner";

type Props = {
  campaignId: string;
  campaign: {
    execution_status?: string | null;
    started_at?: string | null;
    target_start_date?: string | null;
    target_quantity?: number | null;
    target_metric?: string | null;
    current_goal_value?: number | null;
  };
  postPlans: PostPlanLite[];
  weekCount: number;
  /** Optional contribution rows from goal aggregator — enables required-velocity. */
  contributionRows?: { contribution: number }[];
  onChange?: () => void;
};

const ExecutionDashboard = ({ campaignId, campaign, postPlans, weekCount, contributionRows = [], onChange }: Props) => {
  const [signals, setSignals] = useState<PostSignalLite[]>([]);
  const [adapting, setAdapting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [adaptations, setAdaptations] = useState<any[]>([]);
  const [insufficientEvidence, setInsufficientEvidence] = useState<string | null>(null);
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);

  const reloadAdaptations = async () => {
    const { data: adapts } = await supabase
      .from("campaign_adaptations")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(3);
    setAdaptations(adapts || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: sigs }, { data: adapts }] = await Promise.all([
        supabase.from("post_signals").select("*").eq("campaign_id", campaignId),
        supabase.from("campaign_adaptations").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(3),
      ]);
      if (!alive) return;
      setSignals((sigs || []) as any);
      setAdaptations(adapts || []);
    })();
    return () => { alive = false; };
  }, [campaignId]);

  const endsAt = useMemo(() => {
    const start = campaign.started_at ? new Date(campaign.started_at) : (campaign.target_start_date ? new Date(campaign.target_start_date) : null);
    if (!start || weekCount <= 0) return null;
    return new Date(start.getTime() + weekCount * 7 * 24 * 60 * 60 * 1000).toISOString();
  }, [campaign.started_at, campaign.target_start_date, weekCount]);

  const m = useMemo(() => computeExecutionMetrics(postPlans, campaign.started_at || campaign.target_start_date, endsAt, signals), [postPlans, campaign.started_at, campaign.target_start_date, endsAt, signals]);

  const currentStatus = (campaign.execution_status || "planned") as ExecutionStatus;
  const derived = deriveExecutionStatus(currentStatus, m, false);
  const diag = buildExecutionDiagnostic(derived, m);
  const meta = EXECUTION_STATUS_META[derived];
  const predict = predictOutcome(m, campaign.target_quantity ?? null, signals);

  // Required velocity to actually hit the goal — anchors execution to outcome.
  const requiredVelocity = computeRequiredVelocity(
    campaign.current_goal_value ?? 0,
    campaign.target_quantity,
    m.daysRemaining,
    contributionRows,
  );
  const goalLabel = (campaign.target_metric || "outcomes").replace(/_/g, " ");

  const startCampaign = async () => {
    setStarting(true);
    try {
      const { error } = await supabase.from("campaigns").update({
        execution_status: "active",
        started_at: new Date().toISOString(),
      }).eq("id", campaignId);
      if (error) throw error;
      toast.success("Campaign activated");
      onChange?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to start");
    } finally {
      setStarting(false);
    }
  };

  const runAdapt = async () => {
    setAdapting(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-adapt", { body: { campaign_id: campaignId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const { data: adapts } = await supabase.from("campaign_adaptations").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(3);
      setAdaptations(adapts || []);
      toast.success(`${data.adjustments?.length || 0} recommendations from ${data.signals_count || 0} signals`);
    } catch (e: any) {
      toast.error(e.message || "Adapt failed");
    } finally {
      setAdapting(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Execution</p>
          <p className={cn("mt-0.5 text-sm font-medium", meta.tone)}>{meta.label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{diag.reasonShort}</p>
        </div>
        {currentStatus === "planned" && (
          <Button size="sm" onClick={startCampaign} disabled={starting}>
            {starting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
            Start campaign
          </Button>
        )}
      </div>

      {/* 4-up metric grid — bigger numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border border-border rounded-md overflow-hidden">
        <Metric label="Execution score" value={`${m.executionScore.toFixed(1)}`} suffix="/10" />
        <Metric
          label="Velocity"
          value={`${m.velocityActual}`}
          suffix={`/ ${m.velocityRequired} per wk`}
          hint={
            requiredVelocity
              ? `Need ${requiredVelocity.postsPerWeek} posts/wk to hit target`
              : (m.velocityScore >= 1 ? "On pace" : `${Math.max(0, (m.velocityRequired - m.velocityActual)).toFixed(1)} short / wk`)
          }
          hintTone={m.velocityScore >= 1 ? "muted" : "warn"}
        />
        <Metric
          label="Missed posts"
          value={`${m.missed}`}
          suffix={m.totalPlanned ? ` / ${m.totalPlanned}` : ""}
          hintTone={m.missed > 0 ? "warn" : "muted"}
          hint={m.missed > 0 ? "Need recovery" : "None"}
        />
        <Metric
          label="At current pace"
          value={`${campaign.current_goal_value ?? 0}`}
          suffix={campaign.target_quantity ? ` / ${campaign.target_quantity}` : ""}
          hint={
            requiredVelocity && campaign.target_quantity
              ? `→ ${campaign.current_goal_value ?? 0} ${goalLabel} · gap ${Math.max(0, campaign.target_quantity - (campaign.current_goal_value ?? 0))}`
              : `${predict.trajectory.replace("_", " ")} · ${predict.confidence} conf.`
          }
          hintTone={predict.trajectory === "behind" ? "warn" : "muted"}
        />
      </div>

      {/* Diagnostic fixes — impact-tagged when we know the gap */}
      {diag.fixes.length > 0 && (
        <div className="rounded-md bg-muted/40 px-4 py-3 space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Do this now</p>
          <ul className="space-y-1">
            {diag.fixes.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <ArrowRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span className="flex-1">
                  {f}
                  {requiredVelocity && i === 0 && (
                    <span className="ml-1 text-xs text-muted-foreground">
                      → +{requiredVelocity.avgContributionPerPost} {goalLabel} per post
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Adaptive engine — command-style rendering */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Adaptive recommendations</p>
            <p className="text-xs text-muted-foreground">Patterns from {signals.length} measured post{signals.length === 1 ? "" : "s"}.</p>
          </div>
          <Button size="sm" variant="outline" onClick={runAdapt} disabled={adapting || signals.length === 0}>
            {adapting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {adaptations.length > 0 ? "Refresh" : "Generate"}
          </Button>
        </div>
        {adaptations.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            {signals.length === 0 ? "Mark posts as posted to start collecting performance signals." : "No recommendations yet — click Generate."}
          </p>
        ) : (
          <div className="space-y-2">
            {adaptations[0].adjustments?.map?.((a: any, i: number) => {
              const where = a.where || a.target;
              const what = a.what || a.change;
              const why = a.why || a.rationale;
              const impact = a.expected_impact;
              return (
                <div key={i} className="rounded-md border border-border p-3 space-y-1">
                  <p className="text-sm leading-snug">
                    {where && (
                      <span className="font-semibold text-foreground">{where} → </span>
                    )}
                    <span className="font-medium text-foreground">{what}</span>
                  </p>
                  {why && <p className="text-xs text-muted-foreground leading-snug">{why}</p>}
                  {impact && (
                    <p className="text-[11px] font-semibold text-primary tabular-nums">{impact}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Metric = ({ label, value, suffix, hint, hintTone = "muted" }: { label: string; value: string; suffix?: string; hint?: string; hintTone?: "muted" | "warn" }) => (
  <div className="px-4 py-3">
    <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    <p className="mt-1 text-2xl font-semibold text-foreground tabular-nums leading-none">
      {value}
      {suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{suffix}</span>}
    </p>
    {hint && (
      <p className={cn("mt-1 text-[11px] tabular-nums", hintTone === "warn" ? "text-yellow-600" : "text-muted-foreground")}>{hint}</p>
    )}
  </div>
);

export default ExecutionDashboard;
