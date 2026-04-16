import { Badge } from "@/components/ui/badge";
import { Shield, BarChart3 } from "lucide-react";

interface ConfidenceLayer {
  level: string;
  posts_analyzed: number;
  pattern_consistency: string;
  reasoning: string;
}

const levelConfig: Record<string, { color: string; label: string }> = {
  high: { color: "bg-green-500/10 text-green-700 border-green-500/30", label: "High Confidence" },
  medium: { color: "bg-amber-500/10 text-amber-700 border-amber-500/30", label: "Medium Confidence" },
  low: { color: "bg-red-500/10 text-red-700 border-red-500/30", label: "Low Confidence" },
};

export function ConfidenceIndicator({ confidence }: { confidence: ConfidenceLayer }) {
  if (!confidence || !confidence.level) return null;

  const config = levelConfig[confidence.level] || levelConfig.medium;

  return (
    <div className={`border rounded-lg p-3 flex items-start gap-3 ${config.color}`}>
      <Shield className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{config.label}</span>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
            <BarChart3 className="h-2.5 w-2.5 mr-0.5" /> {confidence.posts_analyzed} posts analyzed
          </Badge>
          <Badge variant="outline" className="text-[9px] h-4 px-1.5">
            Pattern: {confidence.pattern_consistency}
          </Badge>
        </div>
        <p className="text-[11px] opacity-80">{confidence.reasoning}</p>
      </div>
    </div>
  );
}
