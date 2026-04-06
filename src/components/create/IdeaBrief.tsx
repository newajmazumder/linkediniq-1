import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type Idea = {
  id: string;
  idea_title: string | null;
  target_audience: string | null;
  objective: string | null;
  core_message: string | null;
  suggested_cta: string | null;
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
        <div className="border-t border-border px-4 py-3 space-y-2">
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
        </div>
      )}
    </div>
  );
};

export default IdeaBrief;
