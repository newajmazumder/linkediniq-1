import { Button } from "@/components/ui/button";
import { Calendar, Rocket, FileText, Swords } from "lucide-react";

interface QuickActionsPanelProps {
  onGenerate7DayPlan: () => void;
  onGenerate4WeekCampaign: () => void;
  onCreatePostsFromAngles: () => void;
  onApplyStrategy: () => void;
  hasInsights: boolean;
}

export function QuickActionsPanel({
  onGenerate7DayPlan,
  onGenerate4WeekCampaign,
  onCreatePostsFromAngles,
  onApplyStrategy,
  hasInsights,
}: QuickActionsPanelProps) {
  if (!hasInsights) return null;

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onGenerate7DayPlan} className="h-8 text-xs">
        <Calendar className="h-3.5 w-3.5 mr-1" /> 7-Day Plan
      </Button>
      <Button size="sm" variant="outline" onClick={onGenerate4WeekCampaign} className="h-8 text-xs">
        <Rocket className="h-3.5 w-3.5 mr-1" /> 4-Week Campaign
      </Button>
      <Button size="sm" variant="outline" onClick={onCreatePostsFromAngles} className="h-8 text-xs">
        <FileText className="h-3.5 w-3.5 mr-1" /> Posts from Angles
      </Button>
      <Button size="sm" variant="outline" onClick={onApplyStrategy} className="h-8 text-xs">
        <Swords className="h-3.5 w-3.5 mr-1" /> Apply Strategy
      </Button>
    </div>
  );
}
