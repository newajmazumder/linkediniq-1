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

      {/* Why it worked — causal logic, not just tags */}
      {(pattern?.hook || pattern?.cta || pattern?.format) && (
        <div className="rounded-md bg-muted/40 p-3 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
            Why it worked
          </p>
          <ul className="text-xs text-foreground space-y-0.5">
            {pattern?.hook && (
              <li>• <span className="capitalize">{pattern.hook.replace(/_/g, " ")}</span> hook → {hookEffect(pattern.hook)}</li>
            )}
            {pattern?.format && (
              <li>• <span className="capitalize">{pattern.format.replace(/_/g, " ")}</span> format → {formatEffect(pattern.format)}</li>
            )}
            {pattern?.cta && (
              <li>• <span className="capitalize">{pattern.cta.replace(/_/g, " ")}</span> CTA → {ctaEffect(pattern.cta)}</li>
            )}
          </ul>
        </div>
      )}

      <div className="pt-1">
        <Button
          size="sm"
          variant="outline"
          className="w-full justify-between"
          onClick={() => navigate(`/create?campaign_id=${campaignId}&clone_post=${top.post_number}`)}
        >
          Apply this pattern to next 3 posts
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// Causal mapping: pattern attribute → why it likely drove the outcome
const hookEffect = (h: string) => {
  const k = h.toLowerCase();
  if (k.includes("loss") || k.includes("financial") || k.includes("fear")) return "high urgency";
  if (k.includes("question")) return "high engagement";
  if (k.includes("contrarian") || k.includes("controversial")) return "high attention";
  if (k.includes("story") || k.includes("personal")) return "high relatability";
  if (k.includes("data") || k.includes("stat")) return "high credibility";
  if (k.includes("how") || k.includes("tutorial")) return "high practical value";
  return "strong attention capture";
};

const formatEffect = (f: string) => {
  const k = f.toLowerCase();
  if (k.includes("story") || k.includes("narrative")) return "high retention";
  if (k.includes("carousel")) return "high dwell time";
  if (k.includes("list")) return "high scannability";
  if (k.includes("image")) return "high visual stop";
  if (k.includes("video")) return "high completion";
  return "good readability";
};

const ctaEffect = (c: string) => {
  const k = c.toLowerCase();
  if (k.includes("direct") || k.includes("hard") || k.includes("demo") || k.includes("book")) return "high conversion";
  if (k.includes("soft") || k.includes("comment")) return "high social proof";
  if (k.includes("dm") || k.includes("message")) return "high qualified intent";
  return "clear next step";
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
