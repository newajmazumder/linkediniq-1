// Pure helpers for the goal-aware performance layer.
// Raw signals (impressions, likes, ...) come from LinkedIn.
// Goal contribution is the user-attributed outcome (e.g. demo bookings)
// that this specific post drove.

export type GoalMetric =
  | "demo_bookings"
  | "leads"
  | "lead_generation"
  | "landing_visits"
  | "followers"
  | "follower_growth"
  | "impressions"
  | "engagement"
  | "dms"
  | "signups"
  | string;

/**
 * Human-readable label for the campaign goal metric — used everywhere
 * the user has to enter or read a goal contribution value.
 */
export const goalMetricLabel = (metric?: string | null): string => {
  if (!metric) return "goal outcomes";
  const map: Record<string, string> = {
    demo_bookings: "demo bookings",
    leads: "leads",
    lead_generation: "leads",
    landing_visits: "landing page visits",
    followers: "followers gained",
    follower_growth: "followers gained",
    impressions: "impressions",
    engagement: "engagement actions",
    dms: "DMs received",
    signups: "signups",
  };
  return map[metric] || metric.replace(/_/g, " ");
};

/** "How many demo bookings can you attribute to this post?" */
export const goalContributionPrompt = (metric?: string | null): string => {
  return `How many ${goalMetricLabel(metric)} can you attribute to this post?`;
};

/** Singular form for tight UI labels: "demo bookings from this post" */
export const goalContributionFieldLabel = (metric?: string | null): string => {
  return `${goalMetricLabel(metric)} from this post`;
};

export type ContributionRow = {
  post_id: string;
  post_label: string;
  contribution: number;
  impressions: number;
  clicks: number;
};

/** efficiency = contribution / impressions (per 1k impressions for readability) */
export const computeEfficiency = (contribution: number, impressions: number): number => {
  if (!impressions || impressions <= 0) return 0;
  return (contribution / impressions) * 1000;
};

/** conversion_rate = contribution / clicks, expressed as % */
export const computeConversionRate = (contribution: number, clicks: number): number => {
  if (!clicks || clicks <= 0) return 0;
  return (contribution / clicks) * 100;
};

/** Rank posts by raw goal_contribution descending (ROI ranking). */
export const rankByContribution = <T extends { contribution: number }>(rows: T[]): T[] => {
  return [...rows].sort((a, b) => b.contribution - a.contribution);
};

/**
 * Goal progress as a 0–100 percentage of target. Returns null when target
 * is unknown so the caller can decide how to render "unknown progress".
 */
export const computeGoalProgress = (currentValue: number, target?: number | null): number | null => {
  if (!target || target <= 0) return null;
  return Math.min(100, Math.round((currentValue / target) * 100));
};

/**
 * Total contribution across an array of post-metric rows.
 * Safe against null/undefined contributions.
 */
export const totalContribution = (rows: { goal_contribution?: number | null }[]): number => {
  return rows.reduce((sum, r) => sum + (r.goal_contribution || 0), 0);
};

/** Unattributed = manually-entered campaign total minus sum of post contributions. */
export const computeUnattributed = (currentValue: number, totalPostContribution: number): number => {
  return Math.max(0, currentValue - totalPostContribution);
};
