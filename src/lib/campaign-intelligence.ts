// Client wrappers for Phase 2/3 engines: strategy versioning + next best action.
import { supabase } from "@/integrations/supabase/client";
import type { Confidence } from "./campaign-brain";

export interface StrategyVersion {
  id: string;
  campaign_id: string;
  version_number: number;
  is_active: boolean;
  strategy_thesis: string | null;
  phase_plan: any[];
  cta_progression: any[];
  hypotheses: { hypothesis: string; confidence: string }[];
  evidence_snapshot: any;
  reason_for_revision: string | null;
  created_at: string;
}

export type ActionPriority = "low" | "medium" | "high" | "critical";
export type ActionType = "blocker" | "execution" | "optimization" | "strategy" | "experiment" | "steady";

export interface NextBestAction {
  action_type: ActionType;
  priority: ActionPriority;
  title: string;
  observation: string;
  why_now: string;
  interpretation: string;
  impact: string;
  recommendation: string;
  confidence: Confidence;
  cta_label?: string;
  cta_path?: string;
  cta_action?: "generate_plan" | "revise_strategy";
  suggested_hook?: string;
  target_post_id?: string | null;
  // Phase 3.5 — passive optimization & learning velocity
  signal_strength?: Confidence;
  signal_reason?: string;
  alternative_path?: string;
  // Phase 5 — time-aware pacing state surfaced from the engine
  pacing_state?: "NOT_STARTED" | "BEHIND" | "ON_TRACK" | "AHEAD";
}

export async function listStrategyVersions(campaignId: string): Promise<StrategyVersion[]> {
  const { data, error } = await supabase.functions.invoke("campaign-strategy-version", {
    body: { campaign_id: campaignId, action: "list" },
  });
  if (error) {
    console.error("list strategy versions failed", error);
    return [];
  }
  return (data?.versions || []) as StrategyVersion[];
}

export async function snapshotStrategyV1(campaignId: string) {
  return supabase.functions.invoke("campaign-strategy-version", {
    body: { campaign_id: campaignId, action: "snapshot" },
  });
}

export async function reviseStrategy(campaignId: string, reason?: string) {
  return supabase.functions.invoke("campaign-strategy-version", {
    body: { campaign_id: campaignId, action: "revise", reason },
  });
}

export async function getNextBestAction(campaignId: string): Promise<NextBestAction | null> {
  const { data, error } = await supabase.functions.invoke("campaign-next-action", {
    body: { campaign_id: campaignId },
  });
  if (error) {
    console.error("next-action failed", error);
    return null;
  }
  return (data?.action as NextBestAction) || null;
}

export const PRIORITY_TONE: Record<ActionPriority, { dot: string; text: string; ring: string; label: string }> = {
  critical: { dot: "bg-destructive", text: "text-destructive", ring: "border-destructive/40", label: "Critical" },
  high:     { dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400", ring: "border-amber-500/40", label: "High" },
  medium:   { dot: "bg-foreground/60", text: "text-foreground", ring: "border-foreground/30", label: "Medium" },
  low:      { dot: "bg-muted-foreground", text: "text-muted-foreground", ring: "border-border", label: "On track" },
};

export const ACTION_TYPE_META: Record<ActionType, { label: string; icon: string; tone: string }> = {
  blocker:      { label: "Blocker",       icon: "🚫", tone: "text-destructive" },
  execution:    { label: "Execution",     icon: "⚡", tone: "text-amber-600 dark:text-amber-400" },
  optimization: { label: "Optimization",  icon: "🎯", tone: "text-emerald-600 dark:text-emerald-400" },
  strategy:     { label: "Strategy fix",  icon: "🧭", tone: "text-blue-600 dark:text-blue-400" },
  experiment:   { label: "Experiment",    icon: "🧪", tone: "text-purple-600 dark:text-purple-400" },
  steady:       { label: "Steady",        icon: "✓",  tone: "text-muted-foreground" },
};
