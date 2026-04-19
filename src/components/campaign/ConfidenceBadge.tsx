import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CONFIDENCE_LABEL, CONFIDENCE_HINT, type Confidence } from "@/lib/campaign-brain";

const TONE: Record<Confidence, string> = {
  low: "text-muted-foreground border-border bg-muted/40",
  medium: "text-foreground border-border bg-card",
  high: "text-foreground border-foreground/20 bg-foreground/[0.04]",
};

export default function ConfidenceBadge({
  level,
  sampleCount,
  className,
}: {
  level: Confidence;
  sampleCount?: number;
  className?: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
              TONE[level],
              className,
            )}
          >
            <Shield className="h-2.5 w-2.5" />
            {CONFIDENCE_LABEL[level]}
            {typeof sampleCount === "number" && (
              <span className="text-muted-foreground">· {sampleCount}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {CONFIDENCE_HINT[level]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
