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
  target?: number | null;
};

const PostContributionTable = ({ rows, goalMetric, target }: Props) => {
  const label = goalMetricLabel(goalMetric);
  // A row counts as "posted" when it's either marked posted OR a LinkedIn post
  // is already linked (plan status sometimes lags behind the publish action).
  const posted = rows.filter((r) => r.status === "posted" || !!r.linkedin_post_id);
  const totalContributed = posted.reduce((s, r) => s + (r.contribution || 0), 0);

  if (posted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Trophy className="mx-auto h-6 w-6 text-muted-foreground/50" />
        <p className="mt-2 text-xs text-muted-foreground">No posted posts yet — contribution data appears after you mark posts as posted.</p>
      </div>
    );
  }

  const maxContribution = Math.max(1, ...posted.map((r) => r.contribution));

  const top3 = posted.slice().sort((a, b) => b.contribution - a.contribution).slice(0, 3).filter((r) => r.contribution > 0);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">Post → {label}</p>
          <span className="text-[10px] text-muted-foreground">Ranked by attributed {label}</span>
        </div>
        {/* Top contributors at-a-glance — answers "which post gave what impact" without scrolling */}
        {top3.length > 0 && (
          <div className="rounded-md bg-muted/30 px-3 py-2 space-y-1.5">
            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Top contributors</p>
            <div className="space-y-1">
              {top3.map((r, i) => {
                const widthPct = (r.contribution / Math.max(1, top3[0].contribution)) * 100;
                return (
                  <div key={r.post_plan_id} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      i === 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                    )}>{i + 1}</span>
                    <span className="text-foreground shrink-0 w-14">Post {r.post_number}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn("h-full", i === 0 ? "bg-primary" : "bg-primary/50")} style={{ width: `${widthPct}%` }} />
                    </div>
                    <span className="text-foreground font-semibold tabular-nums shrink-0 w-10 text-right">
                      {r.contribution}
                    </span>
                    <span className="text-muted-foreground tabular-nums shrink-0 w-16 text-right text-[10px]">
                      {r.clicks > 0 ? `${r.conversion_rate.toFixed(0)}% conv` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      <div className="border-t border-border bg-muted/20 px-4 py-2 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Total contributed from posts</span>
        <span className="text-foreground font-semibold tabular-nums">
          {totalContributed}{target ? <span className="text-muted-foreground font-normal"> / {target} {label}</span> : null}
        </span>
      </div>
    </div>
  );
};

export default PostContributionTable;
