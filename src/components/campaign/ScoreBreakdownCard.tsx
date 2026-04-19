// Causal explanation of the campaign Strategy Score.
// Replaces the "3.5/10 feels like punishment" UX with a transparent breakdown
// that shows what each pillar contributes and why.

import { cn } from "@/lib/utils";
import type { StrategyScoreBreakdown } from "@/lib/strategy";

type Pillar = {
  label: string;
  value: number;       // 0-10
  weight: number;      // 0-1
  hint: string;        // causal explanation
};

type Props = {
  score: StrategyScoreBreakdown;
  pillars: Pillar[];
  className?: string;
};

const pillarTone = (v: number) => {
  if (v >= 7) return { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "strong" };
  if (v >= 4) return { bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "developing" };
  return { bar: "bg-destructive", text: "text-destructive", label: "low impact" };
};

const ScoreBreakdownCard = ({ score, pillars, className }: Props) => {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4 space-y-3", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          Why this score
        </p>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {score.total.toFixed(1)} / 10
        </span>
      </div>

      <div className="space-y-2.5">
        {pillars.map((p) => {
          const tone = pillarTone(p.value);
          const widthPct = Math.max(2, Math.min(100, p.value * 10));
          const contribution = (p.value * p.weight).toFixed(1);
          return (
            <div key={p.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-foreground">{p.label}</span>
                  <span className={cn("text-[10px] uppercase tracking-wide", tone.text)}>
                    {tone.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums text-muted-foreground">
                  <span className="text-foreground font-medium">{p.value}/10</span>
                  <span className="text-border">·</span>
                  <span>+{contribution} pts</span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full transition-all", tone.bar)} style={{ width: `${widthPct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">{p.hint}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ScoreBreakdownCard;
