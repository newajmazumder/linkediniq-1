// Surfaces the single highest-contributing post + a "Replicate this" action.
// Hidden when no posts have any contribution yet.

import { useEffect, useState } from "react";
import { Trophy, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { goalMetricLabel } from "@/lib/goal-metrics";

type Row = {
  post_number: number;
  contribution: number;
  clicks: number;
  impressions: number;
  linkedin_post_id?: string | null;
  draft_id?: string | null;
  post_plan_id?: string | null;
};

type Props = {
  rows: Row[];
  goalMetric?: string | null;
  campaignId: string;
  className?: string;
};

type Pattern = { hook?: string | null; cta?: string | null; format?: string | null };

const TopPerformerCard = ({ rows, goalMetric, campaignId, className }: Props) => {
  const navigate = useNavigate();
  const [pattern, setPattern] = useState<Pattern | null>(null);

  const top = [...rows]
    .filter((r) => (r.contribution || 0) > 0)
    .sort((a, b) => b.contribution - a.contribution)[0];

  const totalContribution = rows.reduce((s, r) => s + (r.contribution || 0), 0);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!top) return;
      // Try post_signals first (has hook_type / cta_type / format)
      const { data: sig } = await supabase
        .from("post_signals")
        .select("hook_type, cta_type, format, post_plan_id")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!alive) return;
      // Match by post_plan_id if available, else fall back to post_number from plans
      const { data: plans } = await supabase
        .from("campaign_post_plans")
        .select("id, post_number, suggested_hook_type, suggested_cta_type, recommended_format")
        .eq("campaign_id", campaignId);
      if (!alive) return;
      const plan = (plans || []).find((p: any) => p.post_number === top.post_number);
      const matched = plan ? (sig || []).find((s: any) => s.post_plan_id === plan.id) : null;
      setPattern({
        hook: matched?.hook_type || plan?.suggested_hook_type || null,
        cta: matched?.cta_type || plan?.suggested_cta_type || null,
        format: matched?.format || plan?.recommended_format || null,
      });
    })();
    return () => { alive = false; };
  }, [top?.post_number, campaignId]);

  if (!top) return null;

  const label = goalMetricLabel(goalMetric);
  const pct = totalContribution > 0 ? Math.round((top.contribution / totalContribution) * 100) : 0;
  const conv = top.clicks > 0 ? Math.round((top.contribution / top.clicks) * 100) : null;

  return (
    <div className={cn("rounded-lg border border-border bg-card border-l-2 border-l-emerald-500 p-4 space-y-3", className)}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Trophy className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
            Top performer
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">
          {pct}% of total
        </span>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <p className="text-3xl font-semibold text-foreground tabular-nums leading-none">
          {top.contribution}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{label}</span>
        </p>
        <p className="text-xs text-muted-foreground">from <span className="font-medium text-foreground">Post {top.post_number}</span></p>
      </div>

      {/* Pattern fingerprint */}
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {pattern?.hook && <Tag label="Hook" value={pattern.hook} />}
        {pattern?.cta && <Tag label="CTA" value={pattern.cta} />}
        {pattern?.format && <Tag label="Format" value={pattern.format} />}
        {conv !== null && <Tag label="Conv." value={`${conv}%`} accent />}
      </div>

      <div className="pt-1">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={() => navigate(`/create?campaign_id=${campaignId}&clone_post=${top.post_number}`)}
        >
          Replicate this pattern
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

const Tag = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
  <span className={cn(
    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
    accent ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400" : "border-border text-muted-foreground",
  )}>
    <span className="uppercase tracking-wide text-[9px] opacity-70">{label}</span>
    <span className="font-medium capitalize">{String(value).replace(/_/g, " ")}</span>
  </span>
);

export default TopPerformerCard;
