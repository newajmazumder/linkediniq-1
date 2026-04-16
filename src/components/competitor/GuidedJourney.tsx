import { CheckCircle2, Rocket, FileText, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuidedJourneyProps {
  hasInsights: boolean;
  hasPosts: boolean;
  postCount: number;
}

const steps = [
  { id: 1, label: "Add Posts & Analyze", icon: FileText, description: "Add competitor posts, then run Full Analysis" },
  { id: 2, label: "Execute Best Move", icon: Rocket, description: "Generate your first post from the strategy" },
  { id: 3, label: "Track & Improve", icon: BarChart3, description: "Measure results, refine your strategy" },
];

export function GuidedJourney({ hasInsights, hasPosts, postCount }: GuidedJourneyProps) {
  const currentStep = !hasPosts ? 1 : !hasInsights ? 1 : 2;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-primary/5 p-4">
      <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-3">🎯 Your Path to Beating This Competitor</p>
      <div className="flex items-center gap-2">
        {steps.map((step, i) => {
          const isDone = step.id < currentStep || (step.id === 1 && hasInsights);
          const isActive = step.id === currentStep || (step.id === 2 && hasInsights);
          const Icon = step.icon;
          
          return (
            <div key={step.id} className="flex items-center gap-2 flex-1">
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 flex-1 transition-all",
                isDone && "bg-green-500/10 border border-green-500/20",
                isActive && !isDone && "bg-primary/10 border-2 border-primary/30 shadow-sm shadow-primary/10",
                !isDone && !isActive && "bg-muted/30 border border-border opacity-50",
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <div className={cn(
                    "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {step.id}
                  </div>
                )}
                <div className="min-w-0">
                  <p className={cn(
                    "text-[11px] font-semibold truncate",
                    isDone && "text-green-700",
                    isActive && !isDone && "text-primary",
                    !isDone && !isActive && "text-muted-foreground",
                  )}>{step.label}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{step.description}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <div className={cn(
                  "h-0.5 w-4 shrink-0",
                  isDone ? "bg-green-500/40" : "bg-border"
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
