import { Badge } from "@/components/ui/badge";
import { TrendingUp, BarChart3 } from "lucide-react";

interface PredictedOutcomes {
  engagement_improvement?: string;
  conversion_improvement?: string;
  reach_potential?: string;
  confidence?: string;
  tied_to_goal?: string;
}

export function PredictedOutcomePanel({ outcomes }: { outcomes: PredictedOutcomes }) {
  if (!outcomes || !outcomes.engagement_improvement) return null;

  return (
    <div className="border border-border rounded-lg bg-gradient-to-r from-green-500/5 to-blue-500/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Expected Performance Advantage</h3>
        {outcomes.confidence && (
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-auto">
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
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <TrendingUp className="h-4 w-4 text-blue-600 mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground">Conversion (DMs/Leads)</p>
          <p className="text-sm font-bold text-blue-700">{outcomes.conversion_improvement}</p>
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
    </div>
  );
}
