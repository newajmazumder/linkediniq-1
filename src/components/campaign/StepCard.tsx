import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Sparkles, ArrowLeft, ArrowRight, Check } from "lucide-react";

export type StepQuestion = {
  id: string;
  label: string;
  options: string[];
  multiSelect?: boolean;
};

export type StepConfig = {
  key: string;
  title: string;
  subtitle: string;
  questions: StepQuestion[];
};

export const STEP_CONFIGS: StepConfig[] = [
  {
    key: "targets",
    title: "Measurable Targets",
    subtitle: "Define what success looks like for this campaign.",
    questions: [
      {
        id: "target_metric",
        label: "What metric matters most?",
        options: ["Followers", "DMs / Conversations", "Leads", "Demo Bookings", "Free Trial Signups", "Profile Visits", "Engagement Rate"],
      },
      {
        id: "target_quantity",
        label: "What's your target number?",
        options: ["25", "50", "100", "200", "500"],
      },
      {
        id: "target_timeframe",
        label: "Over what timeframe?",
        options: ["2 weeks", "30 days", "60 days", "90 days"],
      },
    ],
  },
  {
    key: "structure",
    title: "Campaign Structure",
    subtitle: "How long and how often should we post?",
    questions: [
      {
        id: "duration_weeks",
        label: "Campaign duration",
        options: ["2 weeks", "4 weeks", "6 weeks", "8 weeks"],
      },
      {
        id: "posts_per_week",
        label: "Posts per week",
        options: ["1 post/week", "2 posts/week", "3 posts/week", "5 posts/week"],
      },
      {
        id: "post_formats",
        label: "Content formats",
        options: ["Text only", "Image + Text", "Carousel", "Mix of all"],
        multiSelect: true,
      },
    ],
  },
  {
    key: "audience",
    title: "Audience & Pain",
    subtitle: "Who are you trying to reach and what do they struggle with?",
    questions: [
      {
        id: "audience_type",
        label: "Who is your primary audience?",
        options: ["Founders / CEOs", "Marketing Managers", "Product Managers", "Developers", "Sales Leaders", "HR / People Ops"],
      },
      {
        id: "awareness_level",
        label: "How aware are they of solutions like yours?",
        options: ["Unaware — don't know the problem", "Problem-aware — feel the pain", "Solution-aware — comparing options", "Product-aware — know your product"],
      },
    ],
  },
  {
    key: "product",
    title: "Product & Offer",
    subtitle: "What are you promoting and what makes it valuable?",
    questions: [
      {
        id: "product_angle",
        label: "What's the campaign focus?",
        options: ["Flagship feature", "Free trial / Freemium", "Case study / Results", "New launch / Update", "Thought leadership"],
      },
      {
        id: "proof_type",
        label: "What proof do you have?",
        options: ["Customer testimonials", "Data / Numbers", "Case studies", "Awards / Recognition", "Before & After", "No proof yet"],
      },
    ],
  },
  {
    key: "style",
    title: "Campaign Style",
    subtitle: "How should this campaign feel?",
    questions: [
      {
        id: "content_style",
        label: "Content style",
        options: ["Educational — teach and inform", "Story-driven — personal narratives", "Authority — data and expertise", "Contrarian — challenge norms", "Mix — balanced approach"],
      },
      {
        id: "cta_strength",
        label: "Call-to-action intensity",
        options: ["Soft — follow, comment, share", "Medium — DM me, check link", "Direct — book a demo, sign up now"],
      },
    ],
  },
];

type StepCardProps = {
  stepIndex: number;
  totalSteps: number;
  config: StepConfig;
  onSubmit: (answers: Record<string, string | string[]>, customText: string) => void;
  onBack?: () => void;
  onSkip?: () => void;
  loading: boolean;
  isLast: boolean;
};

const StepCard = ({ stepIndex, totalSteps, config, onSubmit, onBack, onSkip, loading, isLast }: StepCardProps) => {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [customText, setCustomText] = useState("");

  const selectOption = (questionId: string, value: string, multi?: boolean) => {
    setAnswers((prev) => {
      if (multi) {
        const arr = Array.isArray(prev[questionId]) ? [...(prev[questionId] as string[])] : [];
        const idx = arr.indexOf(value);
        if (idx >= 0) arr.splice(idx, 1);
        else arr.push(value);
        return { ...prev, [questionId]: arr };
      }
      return { ...prev, [questionId]: value };
    });
  };

  const isSelected = (questionId: string, value: string) => {
    const val = answers[questionId];
    if (Array.isArray(val)) return val.includes(value);
    return val === value;
  };

  const canProceed = config.questions.every((q) => {
    const val = answers[q.id];
    if (Array.isArray(val)) return val.length > 0;
    return Boolean(val);
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{config.title}</span>
          <span className="text-xs text-muted-foreground">Step {stepIndex} of {totalSteps}</span>
        </div>
        {onSkip && (
          <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip & Generate
          </button>
        )}
      </div>

      <Progress value={(stepIndex / totalSteps) * 100} className="h-1.5" />

      <p className="text-sm text-muted-foreground">{config.subtitle}</p>

      <div className="space-y-5">
        {config.questions.map((question) => (
          <div key={question.id} className="space-y-2.5">
            <label className="text-sm font-medium text-foreground">{question.label}</label>
            <div className="flex flex-wrap gap-2">
              {question.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => selectOption(question.id, opt, question.multiSelect)}
                  className={cn(
                    "rounded-lg border px-3.5 py-2 text-sm transition-all",
                    isSelected(question.id, opt)
                      ? "border-primary bg-primary/10 text-primary font-medium ring-1 ring-primary/20"
                      : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-accent"
                  )}
                >
                  {isSelected(question.id, opt) && (
                    <Check className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                  )}
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-2 border-t border-border">
        <label className="text-xs font-medium text-muted-foreground">Add custom input (optional)</label>
        <Textarea
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Add any extra context, override options, or refine your answers..."
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        ) : <div />}
        <Button
          onClick={() => onSubmit(answers, customText)}
          disabled={!canProceed || loading}
          size="sm"
          className="gap-1.5"
        >
          {isLast ? (
            <><Sparkles className="h-3.5 w-3.5" /> Generate Blueprint</>
          ) : (
            <>Next <ArrowRight className="h-3.5 w-3.5" /></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default StepCard;
