// Phase 1 Foundation — write-through helper for the canonical post_lifecycle
// table.
//
// Every edge function that mutates `drafts`, `linkedin_posts`, or
// `campaign_post_plans` MUST call into this module so the unified
// `post_lifecycle` row stays in sync.
//
// The helper is idempotent: it upserts by the appropriate natural key
// (draft_id, linkedin_post_ref_id, or post_plan_id).

// deno-lint-ignore-file no-explicit-any

type Supa = {
  from: (t: string) => any;
};

export type LifecycleState =
  | "idea"
  | "drafted"
  | "scheduled"
  | "posted"
  | "missed"
  | "archived";

type UpsertInput = {
  user_id: string;
  draft_id?: string | null;
  linkedin_post_ref_id?: string | null;
  post_plan_id?: string | null;
  campaign_id?: string | null;
  week_plan_id?: string | null;
  idea_id?: string | null;
  variation_post_id?: string | null;
  lifecycle_state: LifecycleState;
  content?: string | null;
  hook?: string | null;
  cta?: string | null;
  format?: string | null;
  hook_type?: string | null;
  cta_type?: string | null;
  tone?: string | null;
  post_style?: string | null;
  planned_date?: string | null;
  scheduled_at?: string | null;
  posted_at?: string | null;
  linkedin_post_url?: string | null;
  linkedin_post_external_id?: string | null;
  source?: string | null;
  primary_score?: number | null;
  primary_score_kind?: string | null;
  score_breakdown?: Record<string, unknown> | null;
};

const stripUndefined = <T extends Record<string, unknown>>(o: T): Partial<T> => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
};

/**
 * Upsert (or update) the canonical post_lifecycle row that corresponds to a
 * draft / linkedin_post / post_plan. Safe to call repeatedly — each natural
 * key has a UNIQUE index.
 *
 * Resolution order: draft_id > linkedin_post_ref_id > post_plan_id.
 */
export async function syncPostLifecycle(supabase: Supa, input: UpsertInput) {
  const payload = stripUndefined({ ...input });

  // Find existing row by the strongest natural key available
  let existingId: string | null = null;
  const tryKeys: Array<[string, string | null | undefined]> = [
    ["draft_id", input.draft_id],
    ["linkedin_post_ref_id", input.linkedin_post_ref_id],
    ["post_plan_id", input.post_plan_id],
  ];
  for (const [col, val] of tryKeys) {
    if (!val) continue;
    const { data } = await supabase
      .from("post_lifecycle")
      .select("id")
      .eq(col, val)
      .maybeSingle();
    if (data?.id) {
      existingId = data.id;
      break;
    }
  }

  if (existingId) {
    const { error } = await supabase
      .from("post_lifecycle")
      .update(payload)
      .eq("id", existingId);
    if (error) console.warn("syncPostLifecycle update failed", error.message);
    return existingId;
  }

  const { data, error } = await supabase
    .from("post_lifecycle")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    console.warn("syncPostLifecycle insert failed", error.message);
    return null;
  }
  return data?.id ?? null;
}

/**
 * Convenience: derive the lifecycle state from a draft.status string.
 */
export function lifecycleFromDraftStatus(status?: string | null): LifecycleState {
  if (status === "posted") return "posted";
  if (status === "scheduled") return "scheduled";
  if (status === "missed") return "missed";
  if (status === "archived") return "archived";
  if (status === "idea") return "idea";
  return "drafted";
}
