// Campaign Lifecycle State Machine
// ---------------------------------
// Single source of truth for "what does this campaign actually have?".
// Drives gating: don't show scores, NBA, or pacing until they're earned.
//
// States:
//   setup     → no plan exists yet → show only "Generate Plan" guidance.
//   planned   → plan exists, 0 posts published → show plan, no performance claims.
//   executing → 1-2 posts published → show pacing, defer score (insufficient signal).
//   learning  → 3+ posts published → unlock full intelligence (score + NBA + patterns).

export type CampaignLifecycleState = "setup" | "planned" | "executing" | "learning";

export interface LifecycleMeta {
  label: string;
  description: string;
  /** Whether to show the strategy score header. */
  showScore: boolean;
  /** Whether to show the Next Best Action card at all. */
  showNBA: boolean;
  /** Whether to show the time-aware pacing strip. */
  showPacing: boolean;
  /** Whether to show goal progress UI (live performance tab + bar). */
  showGoalProgress: boolean;
  /** Whether to show advisor questions banner. */
  showAdvisor: boolean;
  /** Minimum-effort copy when score is hidden. */
  scorePlaceholder: string;
  scorePlaceholderReason: string;
}

export const LIFECYCLE_META: Record<CampaignLifecycleState, LifecycleMeta> = {
  setup: {
    label: "Setup",
    description: "No plan or posts yet. We can't evaluate anything until your campaign begins.",
    showScore: false,
    showNBA: false,
    showPacing: false,
    showGoalProgress: false,
    showAdvisor: false,
    scorePlaceholder: "—",
    scorePlaceholderReason: "Generate your plan to start measuring",
  },
  planned: {
    label: "Planned",
    description: "Plan ready. Publish your first post to start measuring.",
    showScore: false,
    showNBA: true,
    showPacing: true,
    showGoalProgress: true,
    showAdvisor: true,
    scorePlaceholder: "—",
    scorePlaceholderReason: "Score unlocks after your first 3 posts go live",
  },
  executing: {
    label: "Executing",
    description: "Posts going live. Building signal — score unlocks at 3+ measured posts.",
    showScore: false,
    showNBA: true,
    showPacing: true,
    showGoalProgress: true,
    showAdvisor: true,
    scorePlaceholder: "—",
    scorePlaceholderReason: "Building signal — needs 3+ posts",
  },
  learning: {
    label: "Learning",
    description: "Enough signal to evaluate strategy and recommend optimizations.",
    showScore: true,
    showNBA: true,
    showPacing: true,
    showGoalProgress: true,
    showAdvisor: true,
    scorePlaceholder: "",
    scorePlaceholderReason: "",
  },
};

export interface DeriveLifecycleInput {
  /** Total post plans defined in the campaign. */
  totalPlanned: number;
  /** Number of week plans (proxy for "is there a plan?"). */
  weekPlansCount: number;
  /** Posts that are actually live (linked_post_id set or status === 'posted'). */
  postedCount: number;
}

export function deriveLifecycleState(input: DeriveLifecycleInput): CampaignLifecycleState {
  const { totalPlanned, weekPlansCount, postedCount } = input;

  // No plan at all → setup. Even if (somehow) posts exist without a plan,
  // "setup" is the honest answer because we have no strategic frame to score against.
  if (weekPlansCount === 0 && totalPlanned === 0) return "setup";

  if (postedCount === 0) return "planned";
  if (postedCount < 3) return "executing";
  return "learning";
}
