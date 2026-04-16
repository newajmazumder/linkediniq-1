import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Flame, TrendingUp, ArrowRight, Zap, Rocket } from "lucide-react";

interface WinStrategy {
  competitor_name?: string;
  primary_weakness?: string;
  user_advantage?: string;
  winning_strategy?: string[];
  expected_engagement_lift?: string;
  expected_conversion_lift?: string;
}

export function WinStrategySummary({
  strategy,
  onGenerateFromWeakness,
  onUseStrategy,
  onApplyToCampaign,
}: {
  strategy: WinStrategy;
  onGenerateFromWeakness?: () => void;
  onUseStrategy?: () => void;
  onApplyToCampaign?: () => void;
}) {
  if (!strategy || !strategy.primary_weakness) return null;

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-primary/5 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <h3 className="text-lg font-bold text-foreground">
            How You Can Beat {strategy.competitor_name || "This Competitor"}
          </h3>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1">Primary Weakness</p>
            <p className="text-sm text-foreground font-medium">{strategy.primary_weakness}</p>
          </div>

          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider mb-1">Your Advantage</p>
            <p className="text-sm text-foreground font-medium">{strategy.user_advantage}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-2">Winning Strategy</p>
            <div className="space-y-1.5">
              {strategy.winning_strategy?.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground">{s}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {strategy.expected_engagement_lift && (
              <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/30 gap-1">
                <TrendingUp className="h-3 w-3" />
                Engagement: {strategy.expected_engagement_lift}
              </Badge>
            )}
            {strategy.expected_conversion_lift && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 border-blue-500/30 gap-1">
                <TrendingUp className="h-3 w-3" />
                Conversion: {strategy.expected_conversion_lift}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-primary/10">
        {onGenerateFromWeakness && (
          <Button size="sm" onClick={onGenerateFromWeakness} className="h-8 text-xs">
            <Zap className="h-3.5 w-3.5 mr-1" /> Generate Post from Weakness
          </Button>
        )}
        {onUseStrategy && (
          <Button size="sm" variant="outline" onClick={onUseStrategy} className="h-8 text-xs">
            <ArrowRight className="h-3.5 w-3.5 mr-1" /> Use Winning Strategy
          </Button>
        )}
        {onApplyToCampaign && (
          <Button size="sm" variant="outline" onClick={onApplyToCampaign} className="h-8 text-xs">
            <Rocket className="h-3.5 w-3.5 mr-1" /> Apply to Campaign
          </Button>
        )}
      </div>
    </div>
  );
}
