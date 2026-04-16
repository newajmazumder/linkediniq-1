import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, ArrowUp, ArrowDown, ArrowRight, Flame, Clock, AlertTriangle } from "lucide-react";
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

const impactIcons: Record<string, React.ReactNode> = {
  high: <ArrowUp className="h-3 w-3 text-green-600" />,
  medium: <ArrowRight className="h-3 w-3 text-amber-600" />,
  low: <ArrowDown className="h-3 w-3 text-muted-foreground" />,
};

const emotionalLabels: Record<string, string> = {
  high: "High-impact growth lever you're ignoring",
  medium: "Moderate upside — worth your time",
  low: "Nice to have, low urgency",
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
  const top = sorted[0];
  const rest = sorted.slice(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Your Priority Stack</h3>
      </div>

      {/* TOP ITEM — visually dominant "Do This NOW" */}
      <div className="border-2 border-primary/40 rounded-xl p-5 bg-gradient-to-r from-primary/8 to-card shadow-md shadow-primary/5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center font-bold text-xl text-primary border-2 border-primary/30 relative shrink-0">
            {top.score}
            <Flame className="h-5 w-5 text-orange-500 fill-orange-500 absolute -top-2 -right-1" />
          </div>
          <div className="flex-1 min-w-0">
            <Badge className="text-[10px] h-5 px-2 bg-primary text-primary-foreground border-0 font-bold mb-1">
              🔥 DO THIS NOW
            </Badge>
            <p className="text-sm font-bold text-foreground">{top.opportunity}</p>
          </div>
        </div>

        <p className="text-xs text-foreground font-medium">{top.reasoning}</p>

        {top.why_it_works && (
          <div className="bg-green-500/8 border border-green-500/20 rounded-lg p-3">
            <p className="text-[11px] text-foreground">
              <strong className="text-green-700">Why this will work:</strong> {top.why_it_works}
            </p>
          </div>
        )}

        <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2">
          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {emotionalLabels[top.impact] || "You're leaving results on the table by not acting on this."}
          </p>
        </div>

        {top.expected_impact && (
          <p className="text-xs text-primary font-semibold">📈 {top.expected_impact}</p>
        )}

        {onGeneratePost && (
          <Button onClick={() => onGeneratePost(top)} className="w-full h-10 text-sm gap-2 font-bold">
            <Zap className="h-4 w-4" /> Execute This Now
          </Button>
        )}
      </div>

      {/* REMAINING ITEMS — condensed */}
      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map((opp, i) => (
            <div key={i} className="border border-border rounded-lg p-3 bg-card flex gap-3 items-start">
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm",
                opp.score >= 7 ? "bg-amber-500/10 text-amber-700 border border-amber-500/30"
                  : "bg-muted text-muted-foreground border border-border"
              )}>
                {opp.score}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] h-5 px-2">
                    {i === 0 ? (
                      <><Clock className="h-2.5 w-2.5 mr-0.5" /> Next Step</>
                    ) : (
                      <><Clock className="h-2.5 w-2.5 mr-0.5" /> Later</>
                    )}
                  </Badge>
                  <p className="text-xs font-semibold text-foreground truncate">{opp.opportunity}</p>
                </div>
                <p className="text-[11px] text-muted-foreground">{opp.reasoning}</p>
                <div className="flex items-center gap-4 text-[10px]">
                  <span className="flex items-center gap-1">
                    {impactIcons[opp.impact] || impactIcons.medium}
                    Impact: <strong className="capitalize">{opp.impact}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    Effort: <strong className="capitalize">{opp.effort}</strong>
                  </span>
                </div>
                {onGeneratePost && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 mt-1" onClick={() => onGeneratePost(opp)}>
                    <Zap className="h-2.5 w-2.5 mr-0.5" /> Generate Post
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
