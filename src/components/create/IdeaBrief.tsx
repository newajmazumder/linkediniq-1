import { ChevronDown, ChevronUp, Target, Heart, Lightbulb } from "lucide-react";
import { useState } from "react";

type Idea = {
  id: string;
  idea_title: string | null;
  target_audience: string | null;
  objective: string | null;
  core_message: string | null;
  suggested_cta: string | null;
  persona_fit: string | null;
  emotional_trigger: string | null;
  resonance_reason: string | null;
};

type Props = { idea: Idea };

const IdeaBrief = ({ idea }: Props) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <p className="text-sm font-medium text-foreground">{idea.idea_title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground capitalize">{idea.objective}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-muted-foreground">Audience</span>
              <p className="text-foreground mt-0.5">{idea.target_audience}</p>
            </div>
            <div>
              <span className="text-muted-foreground">CTA</span>
              <p className="text-foreground mt-0.5">{idea.suggested_cta}</p>
            </div>
          </div>
          <div className="text-xs">
            <span className="text-muted-foreground">Core message</span>
            <p className="text-foreground mt-0.5">{idea.core_message}</p>
          </div>

          {/* Persona-aware fields */}
          {(idea.persona_fit || idea.emotional_trigger || idea.resonance_reason) && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              {idea.persona_fit && (
                <div className="flex gap-2 text-xs">
                  <Target className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <span className="font-medium text-foreground">Persona Fit</span>
                    <p className="text-muted-foreground mt-0.5">{idea.persona_fit}</p>
                  </div>
                </div>
              )}
              {idea.emotional_trigger && (
                <div className="flex gap-2 text-xs">
                  <Heart className="h-3.5 w-3.5 mt-0.5 shrink-0 text-destructive" />
                  <div>
                    <span className="font-medium text-foreground">Emotional Trigger</span>
                    <p className="text-muted-foreground mt-0.5">{idea.emotional_trigger}</p>
                  </div>
                </div>
              )}
              {idea.resonance_reason && (
                <div className="flex gap-2 text-xs">
                  <Lightbulb className="h-3.5 w-3.5 mt-0.5 shrink-0 text-accent-foreground" />
                  <div>
                    <span className="font-medium text-foreground">Why This Resonates</span>
                    <p className="text-muted-foreground mt-0.5">{idea.resonance_reason}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default IdeaBrief;
