// Section 3 of the goal-aware analytics tab: lets the user enter the actual
// total of their campaign goal metric (e.g. "we got 18 demo bookings this month"),
// then derives "from posts" vs "unattributed" so they can see the gap between
// what content drove vs what other channels drove.

import { useEffect, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { goalMetricLabel } from "@/lib/goal-metrics";

type Props = {
  campaignId: string;
  goalMetric?: string | null;
  target?: number | null;
  currentGoalValue: number;
  totalPostContribution: number;
  goalProgressPct: number;
  unattributed: number;
  onSaved: () => void;
};

const CampaignGoalProgressCard = ({
  campaignId,
  goalMetric,
  target,
  currentGoalValue,
  totalPostContribution,
  goalProgressPct,
  unattributed,
  onSaved,
}: Props) => {
  const [value, setValue] = useState<string>(String(currentGoalValue ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(String(currentGoalValue ?? 0));
  }, [currentGoalValue]);

  const label = goalMetricLabel(goalMetric);
  const dirty = Number(value) !== currentGoalValue;

  const save = async () => {
    setSaving(true);
    try {
      const next = Math.max(0, parseInt(value || "0", 10) || 0);
      const { error } = await supabase
        .from("campaigns")
        .update({ current_goal_value: next, goal_value_updated_at: new Date().toISOString() })
        .eq("id", campaignId);
      if (error) throw error;
      // Re-aggregate so progress + score recompute immediately
      try {
        await supabase.functions.invoke("aggregate-campaign-goals", { body: { campaign_id: campaignId } });
      } catch { /* non-blocking */ }
      toast.success(`Updated total ${label}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-primary" />
        <p className="text-xs font-semibold text-foreground">Campaign Progress</p>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Goal · {label}</span>
          <span className="text-foreground font-medium tabular-nums">
            {currentGoalValue} / {target ?? "?"}
            {target ? <span className="text-muted-foreground"> ({goalProgressPct.toFixed(0)}%)</span> : null}
          </span>
        </div>
        <Progress value={goalProgressPct} className="h-2" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">From posts</p>
          <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{totalPostContribution}</p>
          <p className="text-[10px] text-muted-foreground">attributed by you</p>
        </div>
        <div className="rounded-md border border-border bg-muted/30 p-3">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Unattributed</p>
          <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">{unattributed}</p>
          <p className="text-[10px] text-muted-foreground">other channels</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] text-muted-foreground">
          Total {label} for this campaign (manual entry)
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
          We can't pull this from LinkedIn — enter the real number from your CRM/calendar so the AI can interpret what's driving outcomes.
        </p>
      </div>
    </div>
  );
};

export default CampaignGoalProgressCard;
