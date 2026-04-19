// Connects raw totals → which posts actually drove the outcome.
// Sits under the Raw Performance metrics block so the user sees:
//   "11 clicks · 7 bookings → Post 1 drove 5, Post 3 drove 1, Post 4 drove 1"

import { Trophy } from "lucide-react";
import { goalMetricLabel } from "@/lib/goal-metrics";

type Row = {
  post_number: number;
  contribution: number;
  clicks?: number;
  impressions?: number;
};

type Props = {
  rows: Row[];
  goalMetric?: string | null;
  limit?: number;
};

const TopContributorsStrip = ({ rows, goalMetric, limit = 5 }: Props) => {
  const positive = (rows || []).filter((r) => (r.contribution || 0) > 0);
  if (positive.length === 0) return null;
  const total = positive.reduce((s, r) => s + r.contribution, 0);
  const top = [...positive].sort((a, b) => b.contribution - a.contribution).slice(0, limit);
  const label = goalMetricLabel(goalMetric);

  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <Trophy className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
          Top contributors
        </p>
        <span className="text-[10px] text-muted-foreground tabular-nums">
          · {total} {label} from {positive.length} {positive.length === 1 ? "post" : "posts"}
        </span>
      </div>
      <ul className="space-y-1">
        {top.map((r) => {
          const share = total > 0 ? Math.round((r.contribution / total) * 100) : 0;
          return (
            <li key={r.post_number} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground shrink-0 w-12">Post {r.post_number}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-emerald-500/70"
                  style={{ width: `${Math.max(4, share)}%` }}
                />
              </div>
              <span className="text-foreground tabular-nums font-medium shrink-0 w-24 text-right">
                {r.contribution} {label}
              </span>
              <span className="text-muted-foreground tabular-nums shrink-0 w-10 text-right">
                {share}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default TopContributorsStrip;
