import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Rocket, Calendar } from "lucide-react";

interface CampaignWeek {
  week: number;
  theme: string;
  posts: Array<{ type: string; angle: string; hook_type: string; cta: string }>;
}

interface CampaignBlueprint {
  duration_weeks?: number;
  posts_per_week?: number;
  total_posts?: number;
  weeks?: CampaignWeek[];
}

export function CampaignFromCompetitor({
  blueprint,
  competitorName,
  onGenerateCampaign,
}: {
  blueprint: CampaignBlueprint;
  competitorName: string;
  onGenerateCampaign: () => void;
}) {
  if (!blueprint || !blueprint.weeks?.length) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Campaign Blueprint vs {competitorName}</h3>
          <Badge variant="secondary" className="text-[9px]">
            {blueprint.duration_weeks || 4} weeks • {blueprint.total_posts || 8} posts
          </Badge>
        </div>
        <Button size="sm" onClick={onGenerateCampaign} className="h-8 text-xs">
          <Rocket className="h-3.5 w-3.5 mr-1" /> Generate Winning Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {blueprint.weeks?.map((week) => (
          <div key={week.week} className="border border-border rounded-lg p-3 bg-card space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-bold">W{week.week}</Badge>
              <p className="text-[10px] font-semibold text-foreground truncate">{week.theme}</p>
            </div>
            <div className="space-y-1.5">
              {week.posts?.map((post, pi) => (
                <div key={pi} className="bg-muted/50 rounded p-2 space-y-1">
                  <p className="text-[10px] font-medium text-foreground">{post.angle}</p>
                  <div className="flex gap-1 flex-wrap">
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">{post.type}</Badge>
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">{post.hook_type}</Badge>
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1">{post.cta}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
