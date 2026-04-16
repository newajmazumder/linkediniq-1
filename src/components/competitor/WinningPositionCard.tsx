import { Badge } from "@/components/ui/badge";
import { Rocket, ArrowRight, Ban, Flame } from "lucide-react";

interface WinningPosition {
  do_this?: string[];
  do_not_do?: string[];
  dominate_with?: string[];
  focus_audience?: string;
  messaging_approach?: string;
  cta_strategy?: string;
  local_context?: string;
  key_moves?: string[];
}

export function WinningPositionCard({ position }: { position: WinningPosition }) {
  if (!position) return null;

  const hasDo = position.do_this?.length;
  const hasDont = position.do_not_do?.length;
  const hasDominate = position.dominate_with?.length;
  const hasLegacy = position.key_moves?.length;

  if (!hasDo && !hasDont && !hasDominate && !hasLegacy) return null;

  return (
    <div className="border border-primary/20 rounded-lg bg-primary/5 p-5 space-y-4">
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
      </div>

      {/* DO THIS */}
      {hasDo && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
            <ArrowRight className="h-3 w-3" /> DO THIS
          </p>
          {position.do_this!.map((move, i) => (
            <div key={i} className="flex items-start gap-2 bg-green-500/5 border border-green-500/20 rounded p-2">
              <ArrowRight className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">{move}</p>
            </div>
          ))}
        </div>
      )}

      {/* DO NOT DO */}
      {hasDont && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
            <Ban className="h-3 w-3" /> DO NOT DO
          </p>
          {position.do_not_do!.map((move, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-500/5 border border-red-500/20 rounded p-2">
              <Ban className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">{move}</p>
            </div>
          ))}
        </div>
      )}

      {/* DOMINATE WITH */}
      {hasDominate && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
            <Flame className="h-3 w-3" /> DOMINATE WITH
          </p>
          {position.dominate_with!.map((move, i) => (
            <div key={i} className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded p-2">
              <Flame className="h-3 w-3 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground font-medium">{move}</p>
            </div>
          ))}
        </div>
      )}

      {/* Legacy fallback */}
      {!hasDo && hasLegacy && (
        <div className="space-y-1.5 pt-1">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">You Should:</p>
          {position.key_moves!.map((move, i) => (
            <div key={i} className="flex items-start gap-2">
              <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">{move}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
