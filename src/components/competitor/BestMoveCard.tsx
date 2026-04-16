import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Zap, Target, TrendingUp, AlertTriangle, ArrowRight } from "lucide-react";

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
    ? `${competitorName} is bleeding conversions because of ${winStrategy.primary_weakness.toLowerCase()}. Every day you wait, they keep winning audience you could own.`
    : "Competitor has critical gaps you can exploit right now.";

  return (
    <div className="sticky top-0 z-20 relative rounded-2xl border-2 border-primary bg-gradient-to-br from-primary/15 via-card to-primary/10 p-6 space-y-4 shadow-xl shadow-primary/10">
      {/* Urgency ribbon */}
      <div className="absolute -top-3 left-6 bg-primary text-primary-foreground text-[11px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-full shadow-lg animate-pulse">
        🔥 Your #1 Move Right Now
      </div>

      {/* Main content - single clear action */}
      <div className="pt-2 space-y-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center ring-2 ring-primary/30 shrink-0">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-lg font-bold text-foreground leading-tight">{bestAction}</p>
            <p className="text-sm text-muted-foreground leading-relaxed">{reason}</p>
          </div>
        </div>

        {/* Impact metrics - side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <TrendingUp className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xl font-bold text-foreground">{expectedOutcome}</p>
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider">Expected Result</p>
          </div>
          <div className="bg-destructive/8 border border-destructive/25 rounded-xl p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <p className="text-sm font-bold text-foreground">Losing ground daily</p>
            <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Cost of Inaction</p>
          </div>
        </div>

        {/* SINGLE dominant CTA */}
        <Button size="lg" onClick={onExecuteBestMove} className="w-full h-14 text-base gap-3 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all">
          <Rocket className="h-5 w-5" /> Start Executing Now
          <ArrowRight className="h-5 w-5" />
        </Button>

        {/* Secondary options - subtle */}
        <div className="flex gap-2 justify-center">
          <Button size="sm" variant="ghost" onClick={onBuildCampaign} className="h-8 text-xs text-muted-foreground">
            or Preview Full Campaign Plan
          </Button>
          <span className="text-muted-foreground/30 self-center">|</span>
          <Button size="sm" variant="ghost" onClick={onExploitWeakness} className="h-8 text-xs text-muted-foreground">
            Target Different Weakness
          </Button>
        </div>
      </div>

      {/* Context tags - minimal */}
      {(userProduct || userAudience) && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-primary/10">
          {userProduct && (
            <Badge variant="outline" className="text-[9px] h-5 px-2 bg-primary/5 border-primary/20">
              🏢 {userProduct}
            </Badge>
          )}
          {userAudience && (
            <Badge variant="outline" className="text-[9px] h-5 px-2 border-primary/20">
              🎯 {userAudience}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
