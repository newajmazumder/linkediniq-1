// Predictive layer: at current pace, will the campaign hit its target?
// Confidence-aware — suppresses hard numbers when sample is too thin.
// Minimalist: thin left-border accent + colored verdict text only.

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
  /** When true, render without outer card chrome (border, bg, rounded). Used when embedded inside another container. */
  embedded?: boolean;
};

const borderTone: Record<string, string> = {
  ahead: "border-l-emerald-500",
  on_pace: "border-l-emerald-500",
  behind: "border-l-yellow-500",
  critical: "border-l-destructive",
  unknown: "border-l-border",
};

const CampaignProjectionCard = ({
  startedAt,
  targetEndAt,
  currentValue,
  target,
  goalMetric,
  contributionRows = [],
  className,
  embedded = false,
}: Props) => {
  const proj = computeProjection(startedAt, targetEndAt, currentValue, target, contributionRows);
  const meta = trajectoryMeta[proj.trajectory];
  const label = goalMetricLabel(goalMetric);
  const isOverachieving = (proj.gap ?? 0) < 0;
  const Icon = isOverachieving
    ? TrendingUp
    : proj.trajectory === "behind" || proj.trajectory === "critical"
      ? TrendingDown
      : Target;

  const nextAction = proj.stable ? buildNextBestAction(contributionRows, label, Math.max(0, proj.gap)) : null;

  // Unstable / unknown — calm, honest empty state
  if (!proj.stable) {
    return (
      <div className={cn("rounded-lg border border-border bg-card border-l-2 p-4 space-y-2", borderTone.unknown, className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
            Projection · pending
          </p>
        </div>
        <p className="text-sm text-foreground">
          {proj.postsWithContribution === 0
            ? "Need posts with contributions to project."
            : `Projection unstable — based on ${proj.postsWithContribution} post${proj.postsWithContribution === 1 ? "" : "s"} only.`}
        </p>
        <p className="text-xs text-muted-foreground">
          We&apos;ll start projecting once you have 3+ posts and at least 10% of the timeline elapsed.
        </p>
        {/* Always show time / goal even when projection is suppressed */}
        {target && target > 0 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <MiniBar label="Time elapsed" value={`${proj.timeProgressPct}%`} sub={`Day ${proj.daysElapsed} / ${proj.totalDays}`} pct={proj.timeProgressPct} />
            <MiniBar label="Goal achieved" value={`${proj.goalProgressPct}%`} sub={`${currentValue} / ${target} ${label}`} pct={proj.goalProgressPct} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card border-l-2", borderTone[proj.trajectory], className)}>
      {/* Header: verdict (tone color on text only, no fill tint) */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className={cn("h-4 w-4", meta.tone)} />
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              Projection · current pace
            </p>
            <p className={cn("text-sm font-semibold", meta.tone)}>{meta.verdict}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {proj.confidence} conf.
          </span>
          <span className={cn("text-[11px] font-semibold uppercase tracking-wide", meta.tone)}>
            {meta.label}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4 space-y-4">
        {/* Time vs Goal comparison */}
        <div className="grid grid-cols-2 gap-3">
          <MiniBar label="Time elapsed" value={`${proj.timeProgressPct}%`} sub={`Day ${proj.daysElapsed} / ${proj.totalDays}`} pct={proj.timeProgressPct} />
          <MiniBar label="Goal achieved" value={`${proj.goalProgressPct}%`} sub={`${currentValue} / ${target ?? "?"} ${label}`} pct={proj.goalProgressPct} valueClass={meta.tone} />
        </div>

        {/* Pace verdict line */}
        {(proj.paceDelta > 5 || proj.paceDelta < -5) && (
          <div className="flex items-center gap-2 text-xs">
            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", meta.tone)} />
            <span className={cn("font-medium", meta.tone)}>{proj.paceDeltaLabel}</span>
          </div>
        )}

        {/* Brutal-clarity outcome callout — the single most important number on the card */}
        {target && target > 0 && proj.expectedAtEnd !== null && (
          <div className={cn(
            "rounded-md border-2 px-4 py-4",
            proj.trajectory === "behind" || proj.trajectory === "critical"
              ? "border-destructive/40 bg-destructive/5"
              : isOverachieving
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-border",
          )}>
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
              At current pace
            </p>
            <p className={cn("mt-1 text-4xl sm:text-5xl font-bold tabular-nums leading-none", meta.tone)}>
              {proj.expectedAtEnd}
              <span className="ml-2 text-base font-normal text-muted-foreground">
                / {target} {label}
              </span>
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm tabular-nums">
                {proj.gap > 0 ? (
                  <>Gap: <span className="text-destructive font-bold text-base">−{proj.gap}</span> <span className="text-muted-foreground">{label}</span></>
                ) : proj.gap < 0 ? (
                  <>Overshoot: <span className="text-emerald-600 font-bold text-base">+{Math.abs(proj.gap)}</span> <span className="text-muted-foreground">{label}</span></>
                ) : (
                  <span className="text-foreground font-medium">On target</span>
                )}
              </p>
              {proj.expectedLow !== null && proj.expectedHigh !== null && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  Range: {proj.expectedLow}–{proj.expectedHigh} (±30%)
                </p>
              )}
            </div>
          </div>
        )}

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

const MiniBar = ({
  label, value, sub, pct, valueClass,
}: { label: string; value: string; sub: string; pct: number; valueClass?: string }) => (
  <div>
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Clock className="h-3 w-3" />
      <p className="text-[10px] uppercase tracking-wide">{label}</p>
    </div>
    <p className={cn("mt-0.5 text-2xl font-semibold tabular-nums leading-none", valueClass ?? "text-foreground")}>
      {value}
    </p>
    <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">{sub}</p>
    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full transition-all", valueClass ? valueClass.replace("text-", "bg-") : "bg-muted-foreground/50")}
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  </div>
);

export default CampaignProjectionCard;
