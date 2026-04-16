import { Button } from "@/components/ui/button";
import { Rocket, Calendar, Swords, Zap } from "lucide-react";

interface DecisionHeaderProps {
  competitorName: string;
  hasInsights: boolean;
  onGeneratePost: () => void;
  onBuildCampaign: () => void;
  onExploitWeakness: () => void;
}

export function DecisionHeader({
  competitorName,
  hasInsights,
  onGeneratePost,
  onBuildCampaign,
  onExploitWeakness,
}: DecisionHeaderProps) {
  if (!hasInsights) return null;

  return (
    <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border border-primary/20 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">
          What do you want to do against {competitorName}?
        </h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onGeneratePost} className="h-9 text-xs gap-1.5">
          <Rocket className="h-3.5 w-3.5" /> Generate Winning Post
        </Button>
        <Button size="sm" variant="outline" onClick={onBuildCampaign} className="h-9 text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Build Campaign from Competitor
        </Button>
        <Button size="sm" variant="outline" onClick={onExploitWeakness} className="h-9 text-xs gap-1.5">
          <Swords className="h-3.5 w-3.5" /> Find Weakness to Exploit
        </Button>
      </div>
    </div>
  );
}
