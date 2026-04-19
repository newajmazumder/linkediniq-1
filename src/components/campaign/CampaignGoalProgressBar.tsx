// Reusable campaign goal progress bar with overachievement support.
// States: not_started | in_progress | achieved | overachieved
// Variants: "compact" (one-line strip) and "full" (with breakdown)

import { CheckCircle2, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGoalProgress, goalMetricLabel, type GoalStatus } from "@/lib/goal-metrics";

type Props = {
  currentValue: number;
  target?: number | null;
  goalMetric?: string | null;
  variant?: "compact" | "full";
  className?: string;
};

const statusStyles: Record<GoalStatus, { bar: string; text: string; bg: string }> = {
  not_started: {
    bar: "bg-muted-foreground/40",
    text: "text-muted-foreground",
    bg: "bg-muted/30",
  },
  in_progress: {
    bar: "bg-primary",
    text: "text-foreground",
    bg: "bg-primary/5",
  },
  achieved: {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  overachieved: {
    bar: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

const CampaignGoalProgressBar = ({
  currentValue,
  target,
  goalMetric,
  variant = "full",
  className,
}: Props) => {
  const { pct, barPct, status, remaining, overTarget } = formatGoalProgress(currentValue, target);
  const label = goalMetricLabel(goalMetric);
  const styles = statusStyles[status];
  const isAchieved = status === "achieved" || status === "overachieved";

  const statusBadge = () => {
    if (status === "not_started") return "Not started";
    if (status === "achieved") return "Goal achieved";
    if (status === "overachieved") return `+${overTarget} over target`;
    return `${remaining} remaining`;
  };

  if (variant === "compact") {
    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">
            Goal · {currentValue} / {target ?? "?"} {label}
          </span>
          <span className={cn("font-medium tabular-nums", styles.text)}>
            {target ? `${pct}%` : "—"}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full transition-all", styles.bar)}
            style={{ width: `${barPct}%` }}
          />
        </div>
        {isAchieved ? (
          <p className={cn("text-[10px] font-medium", styles.text)}>
            {status === "overachieved" ? `Overachieved +${overTarget}` : "Goal achieved"}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border p-4", styles.bg, status === "overachieved" || status === "achieved" ? "border-emerald-500/40" : "border-border", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isAchieved ? (
            <CheckCircle2 className={cn("h-4 w-4", styles.text)} />
          ) : (
            <Target className="h-4 w-4 text-primary" />
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Campaign Goal Progress
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            isAchieved
              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : status === "not_started"
              ? "bg-muted text-muted-foreground"
              : "bg-primary/15 text-primary",
          )}
        >
          {status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tabular-nums text-foreground">
            {currentValue}
            <span className="ml-1 text-base font-normal text-muted-foreground">
              / {target ?? "?"} {label}
            </span>
          </p>
          <p className={cn("mt-0.5 text-xs font-medium", styles.text)}>
            {target ? `${pct}%` : "Set a target to see progress"} · {statusBadge()}
          </p>
        </div>
        {status === "overachieved" ? (
          <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/20 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            <div className="text-right leading-tight">
              <div className="tabular-nums">+{overTarget} over target</div>
              <div className="text-[10px] font-normal opacity-80">{pct}% of goal</div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", styles.bar)}
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Overachievement celebration line */}
      {status === "overachieved" && (
        <p className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 leading-snug">
          🎉 Goal smashed. Use the AI Insight panel to capture what worked so the next campaign starts here.
        </p>
      )}
    </div>
  );
};

export default CampaignGoalProgressBar;
