import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Rocket } from "lucide-react";

interface PredictedOutcomes {
  engagement_improvement?: string;
  conversion_improvement?: string;
  reach_potential?: string;
  confidence?: string;
  tied_to_goal?: string;
}

const confidenceColors: Record<string, string> = {
  high: "text-green-700 bg-green-500/10 border-green-500/30",
  medium: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  low: "text-red-700 bg-red-500/10 border-red-500/30",
};

export function PredictedOutcomePanel({
  outcomes,
  onApplyStrategy,
}: {
  outcomes: PredictedOutcomes;
  onApplyStrategy?: () => void;
}) {
  if (!outcomes || !outcomes.engagement_improvement) return null;

  return (
    <div className="border border-border rounded-lg bg-gradient-to-r from-green-500/5 to-blue-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Expected Performance Advantage</h3>
        {outcomes.confidence && (
          <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ml-auto ${confidenceColors[outcomes.confidence] || ""}`}>
            Confidence: {outcomes.confidence}
          </Badge>
        )}
      </div>

      <p className="text-xs text-muted-foreground">If you apply this strategy:</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Engagement</p>
          <p className="text-sm font-bold text-green-700">{outcomes.engagement_improvement}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">probability: High</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="h-4 w-4 text-blue-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">DM Conversion</p>
          <p className="text-sm font-bold text-blue-700">{outcomes.conversion_improvement}</p>
          <p className="text-[9px] text-muted-foreground mt-0.5">probability: Medium</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <BarChart3 className="h-4 w-4 text-purple-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Reach Potential</p>
          <p className="text-sm font-bold text-purple-700 capitalize">{outcomes.reach_potential}</p>
        </div>
      </div>

      {outcomes.tied_to_goal && (
        <p className="text-[10px] text-muted-foreground italic">
          🎯 {outcomes.tied_to_goal}
        </p>
      )}

      {outcomes.confidence === "high" && (
        <div className="bg-green-500/5 border border-green-500/20 rounded p-2">
          <p className="text-[10px] text-green-700 font-medium">
            ✅ High confidence — consistent patterns detected across analyzed posts
          </p>
        </div>
      )}

      {onApplyStrategy && (
        <div className="pt-1">
          <Button size="sm" onClick={onApplyStrategy} className="h-8 text-xs">
            <Rocket className="h-3.5 w-3.5 mr-1" /> Apply This Strategy Now
          </Button>
        </div>
      )}
    </div>
  );
}
