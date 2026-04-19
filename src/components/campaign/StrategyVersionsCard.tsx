// Shows v1 → v2 → v3 strategy history. Lets user revise to next version
// when evidence supports it.
import { useEffect, useState } from "react";
import { GitBranch, Loader2, Plus, ChevronDown, ChevronUp, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { listStrategyVersions, snapshotStrategyV1, reviseStrategy, type StrategyVersion } from "@/lib/campaign-intelligence";
import { toast } from "sonner";

export default function StrategyVersionsCard({
  campaignId,
  hasPlan,
  onRevised,
}: {
  campaignId: string;
  hasPlan: boolean;
  onRevised?: () => void;
}) {
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [revising, setRevising] = useState(false);
  const [showRevise, setShowRevise] = useState(false);
  const [reason, setReason] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let v = await listStrategyVersions(campaignId);
    // Auto-snapshot v1 if a plan exists but no version recorded yet
    if (v.length === 0 && hasPlan) {
      await snapshotStrategyV1(campaignId);
      v = await listStrategyVersions(campaignId);
    }
    setVersions(v);
    setExpandedId(v[v.length - 1]?.id || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [campaignId, hasPlan]);

  const handleRevise = async () => {
    if (!reason.trim()) {
      toast.error("Tell the AI why you want to revise");
      return;
    }
    setRevising(true);
    const { data, error } = await reviseStrategy(campaignId, reason.trim());
    setRevising(false);
    if (error || data?.error) {
      toast.error("Revision failed — try again");
      return;
    }
    toast.success(`Strategy v${data?.version?.version_number} created`);
    setReason("");
    setShowRevise(false);
    await load();
    onRevised?.();
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading strategy history…
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-border border-dashed bg-card p-5 text-sm text-muted-foreground">
        Generate a campaign plan first — strategy versions track changes over time.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Strategy versions</h3>
          <span className="text-xs text-muted-foreground tabular-nums">· {versions.length}</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setShowRevise(!showRevise)}
        >
          <Plus className="h-3 w-3 mr-1" /> Revise to v{versions.length + 1}
        </Button>
      </div>

      {showRevise && (
        <div className="px-5 py-3 border-b border-border bg-muted/30 space-y-2">
          <p className="text-xs text-muted-foreground">
            Why does the strategy need to change? The AI will use evidence + your reason to draft v{versions.length + 1}.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Engagement is fine but no demos. CTAs feel too soft."
            className="min-h-[60px] text-sm bg-card"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRevise} disabled={revising}>
              {revising ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <GitBranch className="h-3.5 w-3.5 mr-1" />}
              Create v{versions.length + 1}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowRevise(false); setReason(""); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ol className="px-5 py-3 space-y-3">
        {versions.map((v) => {
          const isExpanded = expandedId === v.id;
          return (
            <li key={v.id} className="relative">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums",
                    v.is_active ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                  )}>
                    v{v.version_number}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    className="w-full text-left flex items-start justify-between gap-2 group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        {v.is_active && <span className="text-foreground font-medium uppercase tracking-wider">Active</span>}
                        {!v.is_active && <span className="text-muted-foreground uppercase tracking-wider">Superseded</span>}
                        <span className="text-border">·</span>
                        <span className="text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm text-foreground mt-0.5 leading-snug line-clamp-2 group-hover:text-foreground">
                        {v.strategy_thesis || "No thesis recorded"}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3 text-xs">
                      {v.reason_for_revision && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Reason for revision</p>
                          <p className="text-foreground mt-0.5">{v.reason_for_revision}</p>
                        </div>
                      )}
                      {v.hypotheses && v.hypotheses.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Hypotheses</p>
                          <ul className="mt-1 space-y-1">
                            {v.hypotheses.map((h: any, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
                                <span className="text-foreground flex-1">{h.hypothesis}</span>
                                <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{h.confidence}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {v.cta_progression && v.cta_progression.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">CTA progression</p>
                          <p className="text-foreground mt-0.5">{v.cta_progression.join(" → ")}</p>
                        </div>
                      )}
                      {v.evidence_snapshot && (
                        <div className="text-[11px] text-muted-foreground border-t border-border pt-2 flex items-center gap-3 flex-wrap">
                          <History className="h-3 w-3" />
                          {v.evidence_snapshot.execution && (
                            <span>Posted {v.evidence_snapshot.execution.posted}/{v.evidence_snapshot.execution.total_posts}</span>
                          )}
                          {v.evidence_snapshot.performance && v.evidence_snapshot.performance.goal_target > 0 && (
                            <span>· Goal {v.evidence_snapshot.performance.goal_pct}%</span>
                          )}
                          {v.evidence_snapshot.performance && (
                            <span>· {v.evidence_snapshot.performance.signals} signals</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
