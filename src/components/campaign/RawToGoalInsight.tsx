// Connects raw platform metrics to goal outcome.
// Answers: "11 clicks → 7 bookings = 64% conversion → strong CTA effectiveness"

import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { goalMetricLabel } from "@/lib/goal-metrics";

type Props = {
  clicks: number;
  impressions: number;
  postsContribution: number;
  goalMetric?: string | null;
};

const interpret = (rate: number) => {
  if (rate >= 50) return { tone: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", label: "Very strong CTA effectiveness" };
  if (rate >= 20) return { tone: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", label: "Strong conversion — CTA is working" };
  if (rate >= 5) return { tone: "text-yellow-600 dark:text-yellow-400", bar: "bg-yellow-500", label: "Moderate — CTA could be sharper" };
  return { tone: "text-destructive", bar: "bg-destructive", label: "Weak — CTA isn't converting clicks" };
};

const RawToGoalInsight = ({ clicks, impressions, postsContribution, goalMetric }: Props) => {
  const label = goalMetricLabel(goalMetric);
  if (clicks === 0 && postsContribution === 0) {
    return (
      <div className="rounded-md bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        Mark contributions on posted posts to see how raw signals convert into {label}.
      </div>
    );
  }

  // Conversion = goal_contribution / clicks (% of clicks that converted to outcome)
  const conversionRate = clicks > 0 ? (postsContribution / clicks) * 100 : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const tone = interpret(conversionRate);

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Zap className={cn("h-3 w-3", tone.tone)} />
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          Conversion insight
        </p>
      </div>
      <p className="text-xs text-foreground">
        <span className="font-semibold tabular-nums">{clicks}</span> clicks →{" "}
        <span className="font-semibold tabular-nums">{postsContribution}</span> {label} ={" "}
        <span className={cn("font-semibold tabular-nums", tone.tone)}>
          {clicks > 0 ? `${conversionRate.toFixed(0)}% conversion` : "no clicks yet"}
        </span>
      </p>
      <p className={cn("text-[11px] font-medium", tone.tone)}>→ {tone.label}</p>
      {impressions > 0 && (
        <p className="text-[10px] text-muted-foreground tabular-nums">
          Click-through rate: {ctr.toFixed(2)}% · {impressions.toLocaleString()} impressions
        </p>
      )}
    </div>
  );
};

export default RawToGoalInsight;
