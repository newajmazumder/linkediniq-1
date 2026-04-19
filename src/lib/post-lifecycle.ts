// Phase 1 Foundation — canonical post lifecycle accessor.
//
// `post_lifecycle` is the SINGLE SOURCE OF TRUTH for every post-like thing
// in the app, regardless of whether it currently lives in `drafts`,
// `linkedin_posts`, or `campaign_post_plans` (those remain as support tables).
//
// Read paths should prefer this module. Write paths in edge functions should
// keep writing to legacy tables AND mirror to `post_lifecycle` via the
// write-through helper in `supabase/functions/_shared/lifecycle-sync.ts`.

import { supabase } from "@/integrations/supabase/client";

export type PostLifecycleState =
  | "idea"
  | "drafted"
  | "scheduled"
  | "posted"
  | "missed"
  | "archived";

export type PostLifecycleRow = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  week_plan_id: string | null;
  post_plan_id: string | null;
  draft_id: string | null;
  linkedin_post_ref_id: string | null;
  idea_id: string | null;
  variation_post_id: string | null;
  lifecycle_state: PostLifecycleState;
  content: string | null;
  hook: string | null;
  cta: string | null;
  format: string | null;
  hook_type: string | null;
  cta_type: string | null;
  tone: string | null;
  post_style: string | null;
  planned_date: string | null;
  scheduled_at: string | null;
  posted_at: string | null;
  linkedin_post_url: string | null;
  linkedin_post_external_id: string | null;
  source: string;
  primary_score: number | null;
  primary_score_kind: string | null;
  score_breakdown: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function listLifecycleByCampaign(campaignId: string) {
  const { data, error } = await supabase
    .from("post_lifecycle")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("planned_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as PostLifecycleRow[];
}

export async function listLifecycleByStates(states: PostLifecycleState[]) {
  const { data, error } = await supabase
    .from("post_lifecycle")
    .select("*")
    .in("lifecycle_state", states)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PostLifecycleRow[];
}

export async function getLifecycleByDraftId(draftId: string) {
  const { data, error } = await supabase
    .from("post_lifecycle")
    .select("*")
    .eq("draft_id", draftId)
    .maybeSingle();
  if (error) throw error;
  return (data as PostLifecycleRow | null) ?? null;
}

export async function getLifecycleByLinkedinRef(linkedinPostId: string) {
  const { data, error } = await supabase
    .from("post_lifecycle")
    .select("*")
    .eq("linkedin_post_ref_id", linkedinPostId)
    .maybeSingle();
  if (error) throw error;
  return (data as PostLifecycleRow | null) ?? null;
}
