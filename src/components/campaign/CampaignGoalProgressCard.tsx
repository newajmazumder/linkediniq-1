// Section 3 of the goal-aware analytics tab. NEW model:
// - Posts contribution is the AUTO-ROLLED source of truth (read-only).
// - Manual input is only for EXTERNAL / off-platform contributions
//   (e.g. "12 demo bookings came from cold DMs"), not the campaign total.
// - Total = posts + external. Bar handles overachievement.

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { goalMetricLabel, goalUpdatedEvent } from "@/lib/goal-metrics";
import CampaignGoalProgressBar from "./CampaignGoalProgressBar";

type Props = {
  campaignId: string;
  goalMetric?: string | null;
  target?: number | null;
  /** Sum of post_metrics.goal_contribution — auto-rolled */
  postsContribution: number;
  /** Manually-entered external contributions (cold DMs, events, etc.) */
  unattributed: number;
  /** posts + unattributed */
  currentGoalValue: number;
  onSaved: () => void;
};

const CampaignGoalProgressCard = ({
  campaignId,
  goalMetric,
  target,
  postsContribution,
  unattributed,
  currentGoalValue,
  onSaved,
}: Props) => {
  const [value, setValue] = useState<string>(String(unattributed ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(unattributed ?? 0));
  }, [unattributed]);

  const label = goalMetricLabel(goalMetric);
  const dirty = Number(value) !== unattributed;

  const save = async () => {
    setSaving(true);
    try {
      const next = Math.max(0, parseInt(value || "0", 10) || 0);
      const { error } = await supabase
        .from("campaigns")
        .update({ unattributed_goal_value: next, goal_value_updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      // Re-aggregate so progress + score recompute and the rolled-up
      // current_goal_value is rewritten on the campaign row.
      try {
        await supabase.functions.invoke("aggregate-campaign-goals", { body: { campaign_id: campaignId } });
      } catch { /* non-blocking */ }
      // Broadcast for any other open views (hero header, strategy list)
      window.dispatchEvent(new CustomEvent(goalUpdatedEvent(campaignId)));
      toast.success(`Updated external ${label}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress bar — primary signal */}
      <CampaignGoalProgressBar
        currentValue={currentGoalValue}
        target={target}
        goalMetric={goalMetric}
        variant="full"
      />

      {/* Breakdown grid */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">From posts</p>
            <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{postsContribution}</p>
            <p className="text-[10px] text-muted-foreground">auto-rolled from contributions</p>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">External</p>
            <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{unattributed}</p>
            <p className="text-[10px] text-muted-foreground">other channels</p>
          </div>
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <p className="text-[10px] uppercase tracking-wide text-primary">Total</p>
            <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{currentGoalValue}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>

        <div className="space-y-1.5 border-t border-border pt-4">
          <label className="block text-[11px] text-muted-foreground">
            External / off-platform {label} (e.g. cold DMs, events, calls)
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 text-sm"
              placeholder="0"
            />
            <Button size="sm" onClick={save} disabled={saving || !dirty}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
              Save
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Post contributions roll up automatically as you save them per post. Use this only for outcomes that didn't come from a LinkedIn post.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CampaignGoalProgressCard;
