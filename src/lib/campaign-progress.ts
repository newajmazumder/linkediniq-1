// Phase 1 Foundation — single source of truth for campaign goal progress.
//
// READS ONLY from `campaigns.{current_goal_value, goal_progress_percent,
// goal_status, target_quantity, target_metric, unattributed_goal_value}`.
//
// The `campaign_progress` table and any client-side recomputation are
// considered DEPRECATED. The only writer is the `aggregate-campaign-goals`
// edge function.

import { supabase } from "@/integrations/supabase/client";

export type CampaignGoalProgress = {
  campaignId: string;
  metric: string | null;
  current: number;
  target: number;
  unattributed: number;
  percent: number; // uncapped — overachievement is allowed
  status: "not_started" | "in_progress" | "achieved" | "overachieved";
  remaining: number;
  overTarget: number;
  updatedAt: string | null;
};

export type CampaignProgressInput = {
  id: string;
  current_goal_value?: number | null;
  goal_progress_percent?: number | null;
  goal_status?: string | null;
  target_quantity?: number | null;
  target_metric?: string | null;
  unattributed_goal_value?: number | null;
  goal_value_updated_at?: string | null;
};

export function deriveProgress(c: CampaignProgressInput): CampaignGoalProgress {
  const current = c.current_goal_value || 0;
  const target = c.target_quantity || 0;
  const percent = target > 0 ? (current / target) * 100 : (c.goal_progress_percent || 0);
  const status = (c.goal_status as CampaignGoalProgress["status"]) || "not_started";
  return {
    campaignId: c.id,
    metric: c.target_metric || null,
    current,
    target,
    unattributed: c.unattributed_goal_value || 0,
    percent: Math.round(percent * 10) / 10,
    status,
    remaining: target > 0 ? Math.max(0, target - current) : 0,
    overTarget: target > 0 ? Math.max(0, current - target) : 0,
    updatedAt: c.goal_value_updated_at || null,
  };
}

export async function getCampaignProgress(campaignId: string): Promise<CampaignGoalProgress | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "id, current_goal_value, goal_progress_percent, goal_status, target_quantity, target_metric, unattributed_goal_value, goal_value_updated_at",
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return deriveProgress(data as CampaignProgressInput);
}
