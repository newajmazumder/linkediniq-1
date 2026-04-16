import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Calendar, Swords, Zap, Target, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";

interface BestMoveProps {
  competitorName: string;
  winStrategy: any;
  topAngle: any;
  predictedOutcomes: any;
  userProduct?: string;
  userAudience?: string;
  onExecuteBestMove: () => void;
  onBuildCampaign: () => void;
  onExploitWeakness: () => void;
}

export function BestMoveCard({
  competitorName,
  winStrategy,
  topAngle,
  predictedOutcomes,
  userProduct,
  userAudience,
  onExecuteBestMove,
  onBuildCampaign,
  onExploitWeakness,
}: BestMoveProps) {
  if (!winStrategy?.primary_weakness) return null;

  const bestAction = topAngle?.title || winStrategy?.winning_strategy?.[0] || "Generate a competing post";
  const expectedOutcome = topAngle?.expected_outcome || predictedOutcomes?.engagement_improvement || "+30% engagement";
  const reason = winStrategy?.primary_weakness
    ? `${competitorName} is losing conversions due to ${winStrategy.primary_weakness.toLowerCase()}`
    : "Competitor has exploitable gaps in their content strategy";

  return (
    <div className="relative rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-card to-primary/8 p-6 space-y-5 shadow-lg shadow-primary/5">
      {/* Urgency ribbon */}
      <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
        🔥 Highest Impact Action
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center ring-2 ring-primary/20">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Your Best Move Right Now</h3>
          <p className="text-xs text-muted-foreground">Against {competitorName} — Act now for maximum impact</p>
        </div>
      </div>

      {/* Primary Action Block */}
      <div className="bg-card border-2 border-primary/25 rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Target className="h-6 w-6 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <p className="text-sm font-bold text-foreground leading-snug">{bestAction}</p>
            {userProduct && (
              <p className="text-xs text-primary/80 font-medium">
                Using: {userProduct}
              </p>
            )}
            {userAudience && (
              <p className="text-xs text-muted-foreground">
                🎯 Target: {userAudience}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/8 border border-green-500/25 rounded-lg p-3">
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Expected Outcome</p>
            <p className="text-sm font-bold text-foreground mt-1 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-600" /> {expectedOutcome}
            </p>
          </div>
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <p className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Why This Works
            </p>
            <p className="text-xs text-foreground mt-1 leading-relaxed">{reason}</p>
          </div>
        </div>
      </div>

      {/* Urgency message */}
      <div className="bg-amber-500/8 border border-amber-500/25 rounded-lg px-4 py-2.5">
        <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
          ⚡ You're leaving engagement on the table by not acting on this weakness. Every day without a counter-post is a missed opportunity.
        </p>
      </div>

      {/* CTA Buttons - Primary is visually dominant */}
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onExecuteBestMove} className="h-11 text-sm gap-2 font-bold shadow-md shadow-primary/20 flex-1 min-w-[200px]">
          <Rocket className="h-4 w-4" /> Start Executing Now
          <ArrowRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onBuildCampaign} className="h-11 text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Preview Plan
        </Button>
        <Button size="sm" variant="ghost" onClick={onExploitWeakness} className="h-11 text-xs gap-1.5 text-muted-foreground">
          <Swords className="h-3.5 w-3.5" /> Different Weakness
        </Button>
      </div>

      {/* Context tags */}
      {(userProduct || userAudience) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/50">
          {userProduct && (
            <Badge variant="outline" className="text-[9px] h-5 px-2 bg-primary/5">
              🏢 {userProduct}
            </Badge>
          )}
          {userAudience && (
            <Badge variant="outline" className="text-[9px] h-5 px-2">
              🎯 {userAudience}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
