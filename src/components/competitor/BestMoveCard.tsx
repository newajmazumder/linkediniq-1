import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Calendar, Swords, Zap, ArrowRight, Target, TrendingUp } from "lucide-react";

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

  // Derive the single best action
  const bestAction = topAngle?.title || winStrategy?.winning_strategy?.[0] || "Generate a competing post";
  const expectedOutcome = topAngle?.expected_outcome || predictedOutcomes?.engagement_improvement || "+30% engagement";
  const reason = winStrategy?.primary_weakness
    ? `${competitorName} is losing conversions due to ${winStrategy.primary_weakness.toLowerCase()}`
    : "Competitor has exploitable gaps in their content strategy";

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Your Best Move Right Now</h3>
          <p className="text-[10px] text-muted-foreground">Against {competitorName}</p>
        </div>
      </div>

      {/* Best Action Card */}
      <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-xs font-bold text-foreground">{bestAction}</p>
            {userProduct && (
              <p className="text-[10px] text-primary/80">
                Using your product: {userProduct}
              </p>
            )}
            {userAudience && (
              <p className="text-[10px] text-muted-foreground">
                🎯 Target: {userAudience}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-500/5 border border-green-500/20 rounded p-2">
            <p className="text-[9px] font-semibold text-green-700 uppercase tracking-wider">Expected Outcome</p>
            <p className="text-xs font-bold text-foreground mt-0.5 flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-600" /> {expectedOutcome}
            </p>
          </div>
          <div className="bg-destructive/5 border border-destructive/20 rounded p-2">
            <p className="text-[9px] font-semibold text-destructive uppercase tracking-wider">Why This Works</p>
            <p className="text-[10px] text-foreground mt-0.5">{reason}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onExecuteBestMove} className="h-9 text-xs gap-1.5">
          <Rocket className="h-3.5 w-3.5" /> Execute This Now
        </Button>
        <Button size="sm" variant="outline" onClick={onBuildCampaign} className="h-9 text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Build Full Campaign
        </Button>
        <Button size="sm" variant="outline" onClick={onExploitWeakness} className="h-9 text-xs gap-1.5">
          <Swords className="h-3.5 w-3.5" /> Exploit Different Weakness
        </Button>
      </div>

      {/* Personalization context */}
      {(userProduct || userAudience) && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
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
