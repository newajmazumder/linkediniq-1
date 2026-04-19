// Section 2 of the goal-aware analytics tab: ranks posts by their measured
// contribution to the campaign's primary goal metric, with efficiency
// (contribution per 1k impressions) so users can spot "high reach, low conversion"
// vanity posts vs. quiet-but-converting ones.

import { Link } from "react-router-dom";
import { ExternalLink, Trophy } from "lucide-react";
import { goalMetricLabel } from "@/lib/goal-metrics";
import { cn } from "@/lib/utils";

type Row = {
  post_plan_id: string;
  linkedin_post_id: string | null;
  post_number: number;
  week_number: number;
  status: string | null;
  contribution: number;
  impressions: number;
  clicks: number;
  efficiency: number; // per 1k impressions
  conversion_rate: number; // %
};

type Props = {
  rows: Row[];
  goalMetric?: string | null;
};

const PostContributionTable = ({ rows, goalMetric }: Props) => {
  const label = goalMetricLabel(goalMetric);
  const posted = rows.filter((r) => r.status === "posted");

  if (posted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Trophy className="mx-auto h-6 w-6 text-muted-foreground/50" />
        <p className="mt-2 text-xs text-muted-foreground">No posted posts yet — contribution data appears after you mark posts as posted.</p>
      </div>
    );
  }

  const maxContribution = Math.max(1, ...posted.map((r) => r.contribution));

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs font-semibold text-foreground">Post → {label}</p>
        <p className="text-[11px] text-muted-foreground">
          Ranked by attributed {label}. Efficiency = {label} per 1k impressions.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2">Post</th>
              <th className="text-right font-medium px-2 py-2">Contribution</th>
              <th className="text-right font-medium px-2 py-2">Impressions</th>
              <th className="text-right font-medium px-2 py-2">Efficiency</th>
              <th className="text-right font-medium px-4 py-2">Conv. rate</th>
            </tr>
          </thead>
          <tbody>
            {posted.map((r, i) => {
              const widthPct = (r.contribution / maxContribution) * 100;
              return (
                <tr key={r.post_plan_id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        i === 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {i + 1}
                      </span>
                      <span className="text-foreground">Post {r.post_number}</span>
                      <span className="text-muted-foreground">· wk {r.week_number}</span>
                      {r.linkedin_post_id && (
                        <Link
                          to={`/performance/${r.linkedin_post_id}`}
                          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                          title="Open post details"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden md:block w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${widthPct}%` }} />
                      </div>
                      <span className="font-semibold text-foreground tabular-nums">{r.contribution}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right text-muted-foreground tabular-nums">
                    {r.impressions.toLocaleString()}
                  </td>
                  <td className="px-2 py-2 text-right text-foreground tabular-nums">
                    {r.efficiency > 0 ? r.efficiency.toFixed(2) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right text-foreground tabular-nums">
                    {r.clicks > 0 ? `${r.conversion_rate.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PostContributionTable;
