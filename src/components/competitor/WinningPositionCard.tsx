import { Badge } from "@/components/ui/badge";
import { Rocket, ArrowRight } from "lucide-react";

interface WinningPosition {
  focus_audience?: string;
  messaging_approach?: string;
  cta_strategy?: string;
  local_context?: string;
  key_moves?: string[];
}

export function WinningPositionCard({ position }: { position: WinningPosition }) {
  if (!position || !position.key_moves?.length) return null;

  return (
    <div className="border border-primary/20 rounded-lg bg-primary/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Your Winning Position</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {position.focus_audience && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Focus Audience</p>
            <p className="text-xs text-foreground">{position.focus_audience}</p>
          </div>
        )}
        {position.messaging_approach && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Messaging</p>
            <p className="text-xs text-foreground">{position.messaging_approach}</p>
          </div>
        )}
        {position.cta_strategy && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">CTA Strategy</p>
            <p className="text-xs text-foreground">{position.cta_strategy}</p>
          </div>
        )}
        {position.local_context && (
          <div className="space-y-0.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Local Context</p>
            <p className="text-xs text-foreground">{position.local_context}</p>
          </div>
        )}
      </div>

      <div className="space-y-1.5 pt-1">
        <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">You Should:</p>
        {position.key_moves?.map((move, i) => (
          <div key={i} className="flex items-start gap-2">
            <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground">{move}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
