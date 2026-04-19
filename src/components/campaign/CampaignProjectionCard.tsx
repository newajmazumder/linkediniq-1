// Predictive layer: at current pace, will the campaign hit its target?
// Surfaces time-vs-goal comparison + expected outcome + next best action.

import { TrendingUp, TrendingDown, Clock, Target, AlertTriangle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeProjection, trajectoryMeta, buildNextBestAction } from "@/lib/campaign-projection";
import { goalMetricLabel } from "@/lib/goal-metrics";

type Props = {
  startedAt?: string | null;
  targetEndAt?: string | null;
  currentValue: number;
  target?: number | null;
  goalMetric?: string | null;
  contributionRows?: { post_number: number; contribution: number; clicks: number; impressions: number }[];
  className?: string;
};

const CampaignProjectionCard = ({
  startedAt,
  targetEndAt,
  currentValue,
  target,
  goalMetric,
  contributionRows = [],
  className,
}: Props) => {
  const proj = computeProjection(startedAt, targetEndAt, currentValue, target);
  const meta = trajectoryMeta[proj.trajectory];
  const label = goalMetricLabel(goalMetric);
  const isOverachieving = proj.gap < 0;
  const Icon = isOverachieving ? TrendingUp : proj.trajectory === "behind" || proj.trajectory === "critical" ? TrendingDown : Target;

  const nextAction = buildNextBestAction(contributionRows, label, Math.max(0, proj.gap));

  if (proj.trajectory === "unknown") {
    return (
      <div className={cn("rounded-lg border border-border bg-card p-4 space-y-2", className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-semibold text-foreground">Projection</p>
        </div>
        <p className="text-xs text-muted-foreground">{meta.verdict}</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border", meta.bg, className)}>
      {/* Header: verdict */}
      <div className="border-b border-border/50 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4", meta.tone)} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Projection · current pace
            </p>
            <p className={cn("text-sm font-semibold", meta.tone)}>{meta.verdict}</p>
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            meta.tone,
            "bg-background/40",
          )}
        >
          {meta.label}
        </span>
      </div>

      {/* Body: time vs goal + expected outcome */}
      <div className="px-4 py-4 space-y-4">
        {/* Time vs Goal comparison */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <p className="text-[10px] uppercase tracking-wide">Time elapsed</p>
            </div>
            <p className="mt-0.5 text-lg font-semibold text-foreground tabular-nums">
              {proj.timeProgressPct}%
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              Day {proj.daysElapsed} / {proj.totalDays}
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-muted-foreground/50 transition-all"
                style={{ width: `${Math.min(100, proj.timeProgressPct)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Target className="h-3 w-3" />
              <p className="text-[10px] uppercase tracking-wide">Goal achieved</p>
            </div>
            <p className={cn("mt-0.5 text-lg font-semibold tabular-nums", meta.tone)}>
              {proj.goalProgressPct}%
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {currentValue} / {target ?? "?"} {label}
            </p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full transition-all", meta.tone.replace("text-", "bg-"))}
                style={{ width: `${Math.min(100, proj.goalProgressPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Pace verdict line */}
        {proj.paceDelta > 5 || proj.paceDelta < -5 ? (
          <div className={cn("rounded-md px-3 py-2 text-xs flex items-center gap-2", meta.bg)}>
            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", meta.tone)} />
            <span className={cn("font-medium", meta.tone)}>{proj.paceDeltaLabel}</span>
          </div>
        ) : null}

        {/* Expected outcome */}
        {target && target > 0 ? (
          <div className="rounded-md border border-border bg-card/60 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Expected outcome at end
            </p>
            <div className="mt-1 flex items-baseline justify-between gap-3 flex-wrap">
              <p className={cn("text-2xl font-semibold tabular-nums", meta.tone)}>
                {proj.expectedAtEnd}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / {target} {label}
                </span>
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {proj.gap > 0 ? (
                  <>Gap: <span className="text-destructive font-semibold">−{proj.gap}</span> {label}</>
                ) : proj.gap < 0 ? (
                  <>Overshoot: <span className="text-emerald-600 font-semibold">+{Math.abs(proj.gap)}</span> {label}</>
                ) : (
                  <>On target</>
                )}
              </p>
            </div>
          </div>
        ) : null}

        {/* Next best action */}
        {nextAction && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-3 space-y-1">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-primary">
              Next best action
            </p>
            <p className="text-sm font-semibold text-foreground">{nextAction.headline}</p>
            <p className="text-xs text-muted-foreground">{nextAction.detail}</p>
            <p className="text-[11px] font-medium text-primary">{nextAction.expectedImpact}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignProjectionCard;
