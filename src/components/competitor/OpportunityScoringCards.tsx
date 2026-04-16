import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, ArrowUp, ArrowDown, ArrowRight, Flame, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OpportunityScore {
  opportunity: string;
  score: number;
  impact: string;
  effort: string;
  priority: string;
  reasoning: string;
  action: string;
  expected_impact?: string;
  why_it_works?: string;
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  do_first: { label: "🔴 Do First", className: "bg-red-500/10 text-red-700 border-red-500/30" },
  do_next: { label: "🟡 Do Next", className: "bg-amber-500/10 text-amber-700 border-amber-500/30" },
  optional: { label: "⚪ Later", className: "bg-muted text-muted-foreground border-border" },
};

const impactIcons: Record<string, React.ReactNode> = {
  high: <ArrowUp className="h-3 w-3 text-green-600" />,
  medium: <ArrowRight className="h-3 w-3 text-amber-600" />,
  low: <ArrowDown className="h-3 w-3 text-muted-foreground" />,
};

export function OpportunityScoringCards({
  scores,
  onExecuteOpportunity,
  onGeneratePost,
}: {
  scores: OpportunityScore[];
  onExecuteOpportunity?: (opp: OpportunityScore) => void;
  onGeneratePost?: (opp: OpportunityScore) => void;
}) {
  if (!scores || scores.length === 0) return null;

  const sorted = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">What You Should Do First</h3>
      </div>

      <div className="space-y-2">
        {sorted.map((opp, i) => {
          const pConfig = priorityConfig[opp.priority] || priorityConfig.optional;
          const isTop = i === 0;

          return (
            <div key={i} className={cn(
              "border rounded-lg p-4 bg-card flex gap-4 items-start transition-all",
              isTop
                ? "border-primary/40 ring-1 ring-primary/20 shadow-md shadow-primary/5"
                : "border-border"
            )}>
              {/* Score circle */}
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center shrink-0 font-bold text-lg relative",
                opp.score >= 8 ? "bg-green-500/10 text-green-700 border-2 border-green-500/30"
                  : opp.score >= 6 ? "bg-amber-500/10 text-amber-700 border-2 border-amber-500/30"
                  : "bg-muted text-muted-foreground border-2 border-border"
              )}>
                {opp.score}
                {isTop && (
                  <div className="absolute -top-1.5 -right-1.5">
                    <Flame className="h-4 w-4 text-orange-500 fill-orange-500" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {isTop && (
                    <Badge className="text-[9px] h-5 px-2 bg-primary text-primary-foreground border-0 font-bold">
                      🔥 START HERE
                    </Badge>
                  )}
                  {!isTop && i === 1 && (
                    <Badge variant="outline" className="text-[9px] h-5 px-2 bg-amber-500/10 text-amber-700 border-amber-500/30">
                      Next Step
                    </Badge>
                  )}
                  {!isTop && i > 1 && (
                    <Badge variant="outline" className="text-[9px] h-5 px-2">
                      <Clock className="h-2.5 w-2.5 mr-0.5" /> Later
                    </Badge>
                  )}
                  <p className={cn("text-xs font-semibold text-foreground", isTop && "text-sm")}>{opp.opportunity}</p>
                </div>

                {/* Opinionated reasoning */}
                <p className={cn("text-[11px]", isTop ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {opp.reasoning}
                </p>

                {opp.why_it_works && (
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-[10px] text-foreground">
                      <strong>Why this will work:</strong> {opp.why_it_works}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1">
                    {impactIcons[opp.impact] || impactIcons.medium}
                    Impact: <strong className="capitalize">{opp.impact}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Effort: <strong className="capitalize">{opp.effort}</strong>
                  </span>
                </div>

                {opp.expected_impact && (
                  <p className="text-[10px] text-primary font-medium">📈 {opp.expected_impact}</p>
                )}

                <p className="text-[10px] text-primary font-medium">→ {opp.action}</p>

                {/* Action buttons - more prominent for top item */}
                <div className="flex gap-2 pt-1">
                  {onGeneratePost && (
                    <Button
                      size="sm"
                      className={cn("text-[10px] px-3", isTop ? "h-8" : "h-6 px-2")}
                      onClick={() => onGeneratePost(opp)}
                    >
                      <Zap className="h-2.5 w-2.5 mr-0.5" /> {isTop ? "Execute This Now" : "Generate Post"}
                    </Button>
                  )}
                  {onExecuteOpportunity && !isTop && (
                    <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onExecuteOpportunity(opp)}>
                      <ArrowRight className="h-2.5 w-2.5 mr-0.5" /> Use as Brief
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
