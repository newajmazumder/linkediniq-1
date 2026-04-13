import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Send, Check } from "lucide-react";

const GOAL_OPTIONS = [
  { label: "Generate Demo Bookings", value: "demo_bookings" },
  { label: "Drive Free Trial Signups", value: "signups" },
  { label: "Brand Awareness / Education", value: "awareness" },
  { label: "Lead Generation (Whitepaper/Guide)", value: "leads" },
  { label: "Grow Followers", value: "followers" },
  { label: "Get More DMs / Conversations", value: "dms" },
];

type GoalStepProps = {
  onSubmit: (goal: string, customText: string) => void;
  loading: boolean;
};

const GoalStep = ({ onSubmit, loading }: GoalStepProps) => {
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");

  const handleSubmit = () => {
    if (!selectedGoal) return;
    const goalLabel = GOAL_OPTIONS.find((o) => o.value === selectedGoal)?.label || selectedGoal;
    const message = customText.trim()
      ? `${goalLabel}. ${customText.trim()}`
      : goalLabel;
    onSubmit(selectedGoal, message);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Business Goal</span>
          <span className="text-xs text-muted-foreground">Step 1 of 7</span>
        </div>
      </div>

      <Progress value={(1 / 7) * 100} className="h-1.5" />

      <div>
        <h3 className="text-sm font-medium text-foreground">What's the main goal for this campaign?</h3>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedGoal(opt.value)}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm text-left transition-all flex items-center gap-3",
              selectedGoal === opt.value
                ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
            )}
          >
            <div className={cn(
              "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
              selectedGoal === opt.value ? "border-primary" : "border-muted-foreground/40"
            )}>
              {selectedGoal === opt.value && <div className="h-2 w-2 rounded-full bg-primary" />}
            </div>
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <div />
        <Button
          onClick={handleSubmit}
          disabled={!selectedGoal || loading}
          size="sm"
          className="gap-1.5"
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default GoalStep;
