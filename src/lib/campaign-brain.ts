// Client helpers for the Campaign Intelligence Memory.
// Wraps the campaign-brain edge function and exposes typed shapes the UI uses.
import { supabase } from "@/integrations/supabase/client";

export type Confidence = "low" | "medium" | "high";
export type AdvisorSeverity = "low" | "medium" | "high";
export type AdvisorStatus = "open" | "answered" | "dismissed";

export interface AdvisorQuestion {
  id: string;
  campaign_id: string;
  question_key: string;
  question: string;
  why_it_matters: string | null;
  severity: AdvisorSeverity;
  status: AdvisorStatus;
  answer: string | null;
  created_at: string;
}

export interface PatternEntry {
  key: string;
  sample_count: number;
  avg_engagement: number;
  avg_conversion: number;
  confidence: Confidence;
}

export interface CampaignIntelligence {
  generated_at: string;
  confidence: Confidence;
  business: any;
  campaign: any;
  personas: any[];
  execution: {
    total_planned: number;
    posted: number;
    drafted: number;
    missed: number;
    posting_pct: number;
    weeks: number;
  };
  performance: {
    signals_count: number;
    total_impressions: number;
    total_clicks: number;
    total_engagement: number;
    goal_current: number;
    goal_target: number;
    goal_pct: number;
  };
  learning: {
    confidence: Confidence;
    hook_patterns: PatternEntry[];
    cta_patterns: PatternEntry[];
    format_patterns: PatternEntry[];
    winning_hook: PatternEntry | null;
    winning_cta: PatternEntry | null;
  };
}

export async function refreshCampaignBrain(campaignId: string): Promise<{
  intelligence: CampaignIntelligence | null;
  advisor_questions: AdvisorQuestion[];
}> {
  const { data, error } = await supabase.functions.invoke("campaign-brain", {
    body: { campaign_id: campaignId },
  });
  if (error) {
    console.error("campaign-brain failed", error);
    return { intelligence: null, advisor_questions: [] };
  }
  return {
    intelligence: data?.intelligence || null,
    advisor_questions: data?.advisor_questions || [],
  };
}

export async function answerAdvisorQuestion(id: string, answer: string) {
  return supabase
    .from("campaign_advisor_questions")
    .update({ answer, status: "answered", answered_at: new Date().toISOString() })
    .eq("id", id);
}

export async function dismissAdvisorQuestion(id: string) {
  return supabase
    .from("campaign_advisor_questions")
    .update({ status: "dismissed" })
    .eq("id", id);
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export const CONFIDENCE_HINT: Record<Confidence, string> = {
  low: "Insufficient evidence — based on fewer than 3 posts.",
  medium: "Promising — based on 3–5 posts. Watch for repetition.",
  high: "Reliable — repeated across 6+ posts.",
};
