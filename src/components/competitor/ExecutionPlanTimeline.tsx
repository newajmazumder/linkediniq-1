import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, Calendar, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";

interface ExecutionDay {
  day: number;
  post_title: string;
  goal: string;
  hook_type: string;
  cta: string;
  why_this_day?: string;
}

export function ExecutionPlanTimeline({
  plan,
  onGeneratePost,
}: {
  plan: ExecutionDay[];
  onGeneratePost?: (day: ExecutionDay) => void;
}) {
  const [showFullPlan, setShowFullPlan] = useState(false);

  if (!plan || plan.length === 0) return null;

  const firstStep = plan[0];
  const remainingSteps = plan.slice(1);

  const goalColors: Record<string, string> = {
    "Stop scroll": "bg-red-500/10 text-red-700 border-red-500/30",
    "Relatability": "bg-blue-500/10 text-blue-700 border-blue-500/30",
    "Comments + engagement": "bg-green-500/10 text-green-700 border-green-500/30",
    "DMs / leads": "bg-purple-500/10 text-purple-700 border-purple-500/30",
  };

  const getGoalColor = (goal?: string) =>
    Object.entries(goalColors).find(([k]) => goal?.toLowerCase().includes(k.toLowerCase()))?.[1] ||
    "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Execution Plan</h3>
        <Badge variant="secondary" className="text-[9px]">Start here, then expand</Badge>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">First action</p>
            <p className="text-sm font-bold text-foreground mt-1">{firstStep.post_title}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] h-5 px-2 ${getGoalColor(firstStep.goal)}`}>
            <Calendar className="h-2.5 w-2.5 mr-1" /> Day {firstStep.day}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] h-5 px-2">Hook: {firstStep.hook_type}</Badge>
          {firstStep.cta && firstStep.cta !== "None" && (
            <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/5 text-primary border-primary/20">
              CTA: {firstStep.cta}
            </Badge>
          )}
        </div>

        {firstStep.why_this_day && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {firstStep.why_this_day}
          </p>
        )}

        {onGeneratePost && (
          <Button size="sm" className="w-full h-9 text-xs gap-1.5" onClick={() => onGeneratePost(firstStep)}>
            <Rocket className="h-3.5 w-3.5" /> Generate this first post now
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {remainingSteps.length > 0 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowFullPlan((prev) => !prev)}
            className="flex items-center gap-2 text-xs text-primary hover:underline"
          >
            {showFullPlan ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            View remaining days ({remainingSteps.length})
          </button>

          {showFullPlan && (
            <div className="space-y-2">
              {remainingSteps.map((day, i) => (
                <div key={i} className="flex gap-3 items-start rounded-lg border border-border bg-card p-3">
                  <div className="h-9 w-9 rounded-full border border-primary/20 bg-primary/5 flex flex-col items-center justify-center shrink-0">
                    <span className="text-[8px] text-muted-foreground uppercase leading-none">Day</span>
                    <span className="text-xs font-bold text-foreground leading-none">{day.day}</span>
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{day.post_title}</p>
                      {onGeneratePost && (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-primary" onClick={() => onGeneratePost(day)}>
                          Generate
                        </Button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${getGoalColor(day.goal)}`}>{day.goal}</Badge>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">{day.hook_type}</Badge>
                    </div>
                    {day.why_this_day && <p className="text-[10px] text-muted-foreground">{day.why_this_day}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
