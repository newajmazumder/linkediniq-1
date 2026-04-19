// The single most important action for this campaign right now.
// Follows Observation → Interpretation → Impact → Recommendation → Confidence schema.
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, RefreshCw, Sparkles, Clock, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNextBestAction, PRIORITY_TONE, ACTION_TYPE_META, type NextBestAction } from "@/lib/campaign-intelligence";
import type { Confidence } from "@/lib/campaign-brain";
import ConfidenceBadge from "./ConfidenceBadge";

export default function NextBestActionCard({
  campaignId,
  onAction,
  refreshKey,
}: {
  campaignId: string;
  onAction?: (action: NextBestAction) => void;
  refreshKey?: number;
}) {
  const [action, setAction] = useState<NextBestAction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const storageKey = `nba-dismissed-${campaignId}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v) {
        const { hash, until } = JSON.parse(v);
        if (until && Date.now() < until) setDismissed(true);
        // store hash to compare after load
        (window as any).__nbaDismissedHash = hash;
      }
    } catch {}
  }, [campaignId]);

  const load = async () => {
    setLoading(true);
    const a = await getNextBestAction(campaignId);
    setAction(a);
    setLoading(false);
    // If a new action arrives that differs from dismissed one, re-show
    if (a) {
      const hash = `${a.action_type}|${a.title}`;
      if ((window as any).__nbaDismissedHash && (window as any).__nbaDismissedHash !== hash) {
        setDismissed(false);
        localStorage.removeItem(storageKey);
      }
    }
  };

  useEffect(() => { load(); }, [campaignId, refreshKey]);

  if (dismissed) return null;
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Computing next best action…
      </div>
    );
  }
  if (!action) return null;

  const handleDismiss = () => {
    const hash = `${action.action_type}|${action.title}`;
    // Hide for 24 hours or until the action signature changes
    const until = Date.now() + 24 * 60 * 60 * 1000;
    try { localStorage.setItem(storageKey, JSON.stringify({ hash, until })); } catch {}
    (window as any).__nbaDismissedHash = hash;
    setDismissed(true);
  };

  const tone = PRIORITY_TONE[action.priority];
  const typeMeta = ACTION_TYPE_META[action.action_type] || ACTION_TYPE_META.steady;

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", tone.ring)}>
      <div className={cn("border-l-[3px] px-5 py-4 sm:px-6 sm:py-5", tone.ring)}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              <span className={cn("font-medium uppercase tracking-wider", tone.text)}>Next best action</span>
              <span className="text-border">·</span>
              <span className={cn("font-medium", typeMeta.tone)}>{typeMeta.icon} {typeMeta.label}</span>
              <span className="text-border">·</span>
              <span className="text-muted-foreground capitalize">{tone.label}</span>
              <ConfidenceBadge level={action.confidence} className="ml-1" />
              {action.signal_strength && <SignalStrengthPill level={action.signal_strength} reason={action.signal_reason} />}
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
              {action.title}
            </h3>

            {!collapsed && (
              <>
                {action.why_now && (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border/60 px-3 py-2">
                    <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Why now</p>
                      <p className="text-xs sm:text-sm text-foreground leading-relaxed mt-0.5">{action.why_now}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-xs sm:text-sm">
                  <Row label="Observation" value={action.observation} />
                  <Row label="Why" value={action.interpretation} />
                  <Row label="Impact" value={action.impact} muted />
                  <Row label="Do this" value={action.recommendation} highlight />
                  {action.alternative_path && <Row label="Alternative" value={action.alternative_path} alternative />}
                </div>

                {action.cta_label && (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => onAction?.(action)}
                      className="h-8"
                    >
                      {action.cta_action === "generate_plan" ? <Sparkles className="h-3.5 w-3.5 mr-1" /> : <ArrowRight className="h-3.5 w-3.5 mr-1" />}
                      {action.cta_label}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
                      disabled={refreshing}
                      className="h-8 px-2 text-xs text-muted-foreground"
                    >
                      {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCollapsed(c => !c)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label={collapsed ? "Expand" : "Collapse"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", collapsed && "-rotate-90")} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
              title="Dismiss for 24h (auto-returns when the action changes)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, muted, highlight, alternative }: { label: string; value: string; muted?: boolean; highlight?: boolean; alternative?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className={cn(
        "shrink-0 w-[78px] text-[10px] uppercase tracking-wider pt-0.5",
        alternative ? "text-muted-foreground/60" : muted ? "text-muted-foreground/70" : "text-muted-foreground",
      )}>
        {label}
      </span>
      <p className={cn(
        "flex-1 leading-relaxed",
        alternative ? "text-muted-foreground italic text-[11px] sm:text-xs" :
        highlight ? "text-foreground font-medium" :
        muted ? "text-muted-foreground" : "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}

const SIGNAL_TONE: Record<Confidence, { dot: string; ring: string; label: string; tip: string }> = {
  high:   { dot: "bg-emerald-500", ring: "border-emerald-500/40 text-emerald-700 dark:text-emerald-400", label: "Signal: high",   tip: "Clear winning pattern detected." },
  medium: { dot: "bg-amber-500",   ring: "border-amber-500/40 text-amber-700 dark:text-amber-400",     label: "Signal: medium", tip: "Emerging pattern — needs confirmation." },
  low:    { dot: "bg-muted-foreground", ring: "border-border text-muted-foreground",                      label: "Signal: low",    tip: "Not enough data to detect what works." },
};

function SignalStrengthPill({ level, reason }: { level: Confidence; reason?: string }) {
  const t = SIGNAL_TONE[level];
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", t.ring)}
      title={reason || t.tip}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {t.label}
    </span>
  );
}
