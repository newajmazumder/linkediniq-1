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
      <div>
        <h3 className="text-sm font-semibold text-foreground">What's the main goal for this campaign?</h3>
        <p className="text-xs text-muted-foreground mt-1">Select one objective. You can add context below.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {GOAL_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelectedGoal(opt.value)}
            className={cn(
              "rounded-lg border px-3.5 py-2.5 text-sm text-left transition-all",
              selectedGoal === opt.value
                ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
            )}
          >
            {selectedGoal === opt.value && <Check className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />}
            {opt.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Add context (optional)</label>
        <Textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="e.g., We're launching a new feature next month and want to drive signups..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={!selectedGoal || loading}
        className="w-full gap-2"
      >
        <Send className="h-3.5 w-3.5" /> Continue
      </Button>
    </div>
  );
};

export default GoalStep;
