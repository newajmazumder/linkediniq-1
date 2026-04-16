import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, Calendar, ArrowRight } from "lucide-react";

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
  if (!plan || plan.length === 0) return null;

  const goalColors: Record<string, string> = {
    "Stop scroll": "bg-red-500/10 text-red-700 border-red-500/30",
    "Relatability": "bg-blue-500/10 text-blue-700 border-blue-500/30",
    "Comments + engagement": "bg-green-500/10 text-green-700 border-green-500/30",
    "DMs / leads": "bg-purple-500/10 text-purple-700 border-purple-500/30",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">7-Day Execution Plan</h3>
        <Badge variant="secondary" className="text-[9px]">Battle Plan</Badge>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-border" />

        <div className="space-y-3">
          {plan.map((day, i) => {
            const goalColor = Object.entries(goalColors).find(([k]) =>
              day.goal?.toLowerCase().includes(k.toLowerCase())
            )?.[1] || "bg-muted text-muted-foreground border-border";

            return (
              <div key={i} className="flex gap-3 items-start relative">
                {/* Day circle */}
                <div className="h-12 w-12 rounded-full border-2 border-primary/30 bg-card flex flex-col items-center justify-center shrink-0 z-10">
                  <span className="text-[9px] text-muted-foreground uppercase leading-none">Day</span>
                  <span className="text-sm font-bold text-foreground leading-none">{day.day}</span>
                </div>

                {/* Content */}
                <div className="flex-1 border border-border rounded-lg p-3 bg-card space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-foreground">{day.post_title}</p>
                    {onGeneratePost && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px] px-2 text-primary hover:text-primary"
                        onClick={() => onGeneratePost(day)}
                      >
                        Generate Post <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                      </Button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${goalColor}`}>
                      <Calendar className="h-2.5 w-2.5 mr-0.5" /> {day.goal}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                      Hook: {day.hook_type}
                    </Badge>
                    {day.cta && day.cta !== "None" && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20">
                        CTA: {day.cta}
                      </Badge>
                    )}
                  </div>

                  {day.why_this_day && (
                    <p className="text-[10px] text-muted-foreground italic">→ {day.why_this_day}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
