import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket, CheckCircle2, XCircle, Flame, ArrowRight } from "lucide-react";

interface WinningPosition {
  do_this?: string[];
  do_not_do?: string[];
  dominate_with?: string[];
  focus_audience?: string;
  messaging_approach?: string;
  cta_strategy?: string;
}

export function WinningPositionCard({
  position,
  onApplyStrategy,
}: {
  position: WinningPosition;
  onApplyStrategy?: () => void;
}) {
  if (!position || (!position.do_this?.length && !position.do_not_do?.length)) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Your Winning Position</h3>
        </div>
        {onApplyStrategy && (
          <Button size="sm" onClick={onApplyStrategy} className="h-7 text-[10px] px-3">
            <ArrowRight className="h-3 w-3 mr-0.5" /> Apply Strategy
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {position.do_this && position.do_this.length > 0 && (
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> DO THIS
            </p>
            {position.do_this.map((item, i) => (
              <p key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                <span className="text-green-600 shrink-0">→</span> {item}
              </p>
            ))}
          </div>
        )}

        {position.do_not_do && position.do_not_do.length > 0 && (
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-destructive uppercase tracking-wider flex items-center gap-1">
              <XCircle className="h-3 w-3" /> DO NOT DO
            </p>
            {position.do_not_do.map((item, i) => (
              <p key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                <span className="text-destructive shrink-0">✕</span> {item}
              </p>
            ))}
          </div>
        )}

        {position.dominate_with && position.dominate_with.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              <Flame className="h-3 w-3" /> DOMINATE WITH
            </p>
            {position.dominate_with.map((item, i) => (
              <p key={i} className="text-[11px] text-foreground flex items-start gap-1.5">
                <span className="text-primary shrink-0">⚡</span> {item}
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {position.focus_audience && (
          <Badge variant="outline" className="text-[9px] h-5 px-2 bg-primary/5">
            🎯 Audience: {position.focus_audience}
          </Badge>
        )}
        {position.messaging_approach && (
          <Badge variant="outline" className="text-[9px] h-5 px-2">
            💬 {position.messaging_approach}
          </Badge>
        )}
        {position.cta_strategy && (
          <Badge variant="outline" className="text-[9px] h-5 px-2 bg-green-500/5">
            📢 CTA: {position.cta_strategy}
          </Badge>
        )}
      </div>
    </div>
  );
}
