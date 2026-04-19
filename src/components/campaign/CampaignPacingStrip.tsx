// Time-aware pacing feedback strip — sits above the Next Best Action card.
// Shows: Expected by today · Actual · Status (with delta)
// Color-coded by PacingState so the user instantly knows where they stand
// in calendar time, not just task progress.
import { Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { PACING_STATE_META, type Pacing } from "@/lib/execution";

export default function CampaignPacingStrip({ pacing }: { pacing: Pacing }) {
  const meta = PACING_STATE_META[pacing.state];
  const deltaLabel = pacing.delta === 0
    ? "on pace"
    : pacing.delta > 0
      ? `+${pacing.delta} ahead`
      : `${pacing.delta} behind`;

  return (
    <div className={cn(
      "rounded-lg border px-4 py-3 flex items-center justify-between gap-4 flex-wrap",
      meta.ring, meta.bg,
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-muted-foreground">Expected by today:</span>
          <span className="font-semibold text-foreground tabular-nums">{pacing.expectedByNow} {pacing.expectedByNow === 1 ? "post" : "posts"}</span>
          <span className="text-border">·</span>
          <span className="text-muted-foreground">Actual:</span>
          <span className="font-semibold text-foreground tabular-nums">{pacing.actual}</span>
          <span className="text-border">·</span>
          <span className={cn("inline-flex items-center gap-1 font-medium", meta.text)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
            {pacing.state !== "NOT_STARTED" && pacing.actual > 0 && (
              <span className="text-muted-foreground/80 font-normal">({deltaLabel})</span>
            )}
          </span>
        </div>
      </div>

      {pacing.daysRemaining > 0 && pacing.postsRemaining > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
          <Clock className="h-3 w-3" />
          <span>{pacing.daysRemaining}d left · need {pacing.requiredVelocity}/wk</span>
        </div>
      )}
    </div>
  );
}
