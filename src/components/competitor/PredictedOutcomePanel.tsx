import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, BarChart3, Rocket, ArrowRight, Lightbulb, CheckCircle2 } from "lucide-react";

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

const confidenceMessages: Record<string, string> = {
  high: "Strong signal — consistent patterns detected across all analyzed posts. This strategy will very likely outperform.",
  medium: "Moderate signal — some patterns detected. Results may vary but direction is solid.",
  low: "Early signal — limited data. More competitor posts needed for stronger predictions.",
};

export function PredictedOutcomePanel({
  outcomes,
  onApplyStrategy,
  onCreatePost,
  onCreateCampaign,
}: {
  outcomes: PredictedOutcomes;
  onApplyStrategy?: () => void;
  onCreatePost?: () => void;
  onCreateCampaign?: () => void;
}) {
  if (!outcomes || !outcomes.engagement_improvement) return null;

  return (
    <div className="border border-border rounded-xl bg-gradient-to-r from-green-500/5 to-blue-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-bold text-foreground">What to Expect When You Execute</h3>
        {outcomes.confidence && (
          <Badge variant="outline" className={`text-[9px] h-5 px-2 ml-auto ${confidenceColors[outcomes.confidence] || ""}`}>
            {outcomes.confidence === "high" ? "✅" : outcomes.confidence === "medium" ? "⚠️" : "❓"} {outcomes.confidence} confidence
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-3 text-center space-y-1">
          <TrendingUp className="h-4 w-4 text-green-600 mx-auto" />
          <p className="text-[10px] text-muted-foreground">Engagement Lift</p>
          <p className="text-lg font-bold text-green-700">{outcomes.engagement_improvement}</p>
          <p className="text-[9px] text-green-600 font-medium">probability: High</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center space-y-1">
          <TrendingUp className="h-4 w-4 text-blue-600 mx-auto" />
          <p className="text-[10px] text-muted-foreground">DM / Lead Conversion</p>
          <p className="text-lg font-bold text-blue-700">{outcomes.conversion_improvement}</p>
          <p className="text-[9px] text-blue-600 font-medium">probability: Medium</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center space-y-1">
          <BarChart3 className="h-4 w-4 text-purple-600 mx-auto" />
          <p className="text-[10px] text-muted-foreground">Reach Potential</p>
          <p className="text-lg font-bold text-purple-700 capitalize">{outcomes.reach_potential}</p>
        </div>
      </div>

      {outcomes.tied_to_goal && (
        <p className="text-xs text-muted-foreground">
          🎯 {outcomes.tied_to_goal}
        </p>
      )}

      {outcomes.confidence && (
        <div className={`rounded-lg p-3 ${outcomes.confidence === "high" ? "bg-green-500/8 border border-green-500/20" : outcomes.confidence === "medium" ? "bg-amber-500/8 border border-amber-500/20" : "bg-muted border border-border"}`}>
          <p className={`text-[11px] font-medium flex items-center gap-1.5 ${outcomes.confidence === "high" ? "text-green-700" : outcomes.confidence === "medium" ? "text-amber-700" : "text-muted-foreground"}`}>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {confidenceMessages[outcomes.confidence] || confidenceMessages.low}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        {onApplyStrategy && (
          <Button size="sm" onClick={onApplyStrategy} className="h-8 text-xs gap-1">
            <Rocket className="h-3.5 w-3.5" /> Apply Strategy Now
          </Button>
        )}
        {onCreatePost && (
          <Button size="sm" variant="outline" onClick={onCreatePost} className="h-8 text-xs gap-1">
            <ArrowRight className="h-3.5 w-3.5" /> Create Post
          </Button>
        )}
        {onCreateCampaign && (
          <Button size="sm" variant="outline" onClick={onCreateCampaign} className="h-8 text-xs gap-1">
            <Lightbulb className="h-3.5 w-3.5" /> Build Campaign
          </Button>
        )}
      </div>
    </div>
  );
}
