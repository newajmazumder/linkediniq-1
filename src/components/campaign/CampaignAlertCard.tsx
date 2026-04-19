// Single, dismissible advisor alert. Renders ONLY when a trigger fires.
// Silence is the default; this card earns its presence.
import { useState, useEffect } from "react";
import { AlertTriangle, ArrowRight, X, Sparkles, TrendingDown, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITY_TONE, type CampaignAlert } from "@/lib/campaign-triggers";

const KIND_ICON = {
  stagnation: Activity,
  execution_failure: AlertTriangle,
  forecast_risk: TrendingDown,
  performance_failure: AlertTriangle,
  pattern_detected: Sparkles,
} as const;

interface Props {
  campaignId: string;
  alert: CampaignAlert;
  onAction?: (action: CampaignAlert["cta"] extends infer T ? T extends { action: infer A } ? A : never : never) => void;
}

export default function CampaignAlertCard({ campaignId, alert, onAction }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `campaign-alert-dismissed-${campaignId}`;

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (!v) return;
      const { hash, until } = JSON.parse(v);
      if (until && Date.now() < until && hash === alert.kind + "|" + alert.delta) {
        setDismissed(true);
      } else {
        // Trigger changed → reset
        setDismissed(false);
      }
    } catch {
      // ignore
    }
  }, [campaignId, alert.kind, alert.delta, storageKey]);

  if (dismissed) return null;

  const tone = SEVERITY_TONE[alert.severity];
  const Icon = KIND_ICON[alert.kind] ?? AlertTriangle;

  const handleDismiss = () => {
    const until = Date.now() + 24 * 60 * 60 * 1000;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ hash: alert.kind + "|" + alert.delta, until }),
      );
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  return (
    <div className={cn("rounded-xl border bg-card overflow-hidden", tone.ring)}>
      <div className={cn("border-l-[3px] px-5 py-4 sm:px-6 sm:py-5", tone.ring, tone.bg)}>
        <div className="flex items-start gap-4">
          <div className={cn("mt-0.5 shrink-0 rounded-full p-1.5", tone.bg, tone.ring, "border")}>
            <Icon className={cn("h-4 w-4", tone.text)} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              <span className={cn("font-medium uppercase tracking-wider", tone.text)}>
                {tone.label}
              </span>
              <span className="text-border">·</span>
              <span className="text-muted-foreground capitalize">
                {alert.kind.replace(/_/g, " ")}
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
              {alert.headline}
            </h3>

            <p className={cn("text-sm font-medium leading-snug", tone.text)}>
              {alert.delta}
            </p>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {alert.body}
            </p>

            {alert.cta && (
              <div className="pt-1">
                <Button
                  size="sm"
                  onClick={() => onAction?.(alert.cta!.action)}
                  className="h-8"
                >
                  {alert.cta.label}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
            title="Dismiss for 24h (auto-returns when the situation changes)"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
