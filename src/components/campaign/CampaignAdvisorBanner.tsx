// Proactive Advisor — surfaces critical missing info as questions the user
// can answer or dismiss. Sits at the top of the campaign page when active.
import { useState } from "react";
import { AlertCircle, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  answerAdvisorQuestion, dismissAdvisorQuestion,
  type AdvisorQuestion,
} from "@/lib/campaign-brain";
import { toast } from "sonner";

const SEVERITY_TONE = {
  high:   { dot: "bg-destructive", text: "text-destructive", label: "Blocking decision quality" },
  medium: { dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400", label: "Improves recommendations" },
  low:    { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Optional context" },
} as const;

export default function CampaignAdvisorBanner({
  questions,
  onChange,
}: {
  questions: AdvisorQuestion[];
  onChange?: () => void;
}) {
  const open = questions.filter(q => q.status === "open");
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (open.length === 0) return null;

  const top = open[0];
  const tone = SEVERITY_TONE[top.severity];

  async function submit(q: AdvisorQuestion) {
    if (!answer.trim()) {
      toast.error("Add an answer first");
      return;
    }
    setSubmitting(true);
    const { error } = await answerAdvisorQuestion(q.id, answer.trim());
    setSubmitting(false);
    if (error) {
      toast.error("Could not save answer");
      return;
    }
    toast.success("Got it — recommendations will improve");
    setActiveId(null);
    setAnswer("");
    onChange?.();
  }

  async function dismiss(q: AdvisorQuestion) {
    const { error } = await dismissAdvisorQuestion(q.id);
    if (error) { toast.error("Could not dismiss"); return; }
    onChange?.();
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-l-[3px] border-foreground/40 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              <span className={cn("font-medium uppercase tracking-wider", tone.text)}>Advisor</span>
              <span className="text-muted-foreground">· {tone.label}</span>
              {open.length > 1 && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground tabular-nums">{open.length} questions</span>
                </>
              )}
            </div>
            <p className="text-sm text-foreground leading-snug">{top.question}</p>
            {top.why_it_matters && (
              <p className="text-xs text-muted-foreground leading-relaxed">{top.why_it_matters}</p>
            )}

            {activeId === top.id ? (
              <div className="pt-2 space-y-2">
                <Textarea
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer…"
                  className="min-h-[72px] text-sm"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => submit(top)} disabled={submitting}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Save answer
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setAnswer(""); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="pt-1.5 flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => { setActiveId(top.id); setAnswer(top.answer || ""); }}>
                  Answer
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => dismiss(top)}>
                  <X className="h-3 w-3 mr-1" /> Not now
                </Button>
                {open.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {expanded ? "Hide" : `+${open.length - 1} more`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && open.length > 1 && (
          <div className="mt-4 ml-7 space-y-3 border-t border-border pt-3">
            {open.slice(1).map((q) => {
              const t = SEVERITY_TONE[q.severity];
              return (
                <div key={q.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                    <span className={cn("font-medium uppercase tracking-wider", t.text)}>{q.severity}</span>
                  </div>
                  <p className="text-sm text-foreground">{q.question}</p>
                  {q.why_it_matters && <p className="text-xs text-muted-foreground">{q.why_it_matters}</p>}
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => { setActiveId(q.id); setAnswer(q.answer || ""); setExpanded(false); }}>
                      Answer
                    </Button>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => dismiss(q)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
