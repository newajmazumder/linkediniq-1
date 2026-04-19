// Event-Triggered Advisor — silence-first.
// ------------------------------------------------------------
// Pure function. No I/O. Returns a SINGLE alert when one of five
// hard-rule triggers fires. Returns null otherwise → render nothing.
//
// Triggers (priority order, first match wins):
//   1. Stagnation         — posts went live, then nothing for STAGNATION_DAYS
//   2. Execution Failure  — behind expected pace by ≥ BEHIND_THRESHOLD posts
//   3. Forecast Risk      — projected goal value < FORECAST_MISS_THRESHOLD × target
//   4. Performance Failure— enough posts, low CTR, zero goal contribution
//   5. Pattern Detected   — one hook/format converts ≥ PATTERN_MULTIPLIER × the rest
//
// Alerts always express DELTA from expectation, not raw counts.

import type { Pacing } from "./execution";

// ---- Baselines (System Awareness Layer) -------------------------------------
export const BASELINE_CTR = 0.015;            // 1.5% CTR floor
export const STAGNATION_DAYS = 5;             // days of inactivity that count as stalled
export const BEHIND_THRESHOLD = -2;           // pacing.delta ≤ this = execution failure
export const FORECAST_MISS_THRESHOLD = 0.7;   // <70% projected → forecast risk
export const PATTERN_MULTIPLIER = 3;          // ≥ 3× lift = repeatable pattern
export const MIN_POSTS_FOR_PERFORMANCE = 3;
export const MIN_POSTS_FOR_PATTERN = 4;

// ---- Types ------------------------------------------------------------------
export type AlertSeverity = "critical" | "high" | "medium";
export type AlertKind =
  | "stagnation"
  | "execution_failure"
  | "forecast_risk"
  | "performance_failure"
  | "pattern_detected";

export interface CampaignAlert {
  kind: AlertKind;
  severity: AlertSeverity;
  headline: string;        // short, e.g. "Execution Failure"
  delta: string;           // 1-line delta-from-expectation, e.g. "2 posts behind expected pace"
  body: string;            // 1-2 sentence explanation
  cta?: { label: string; action: AlertCtaAction };
}

export type AlertCtaAction =
  | "create_post"
  | "view_pattern"
  | "review_strategy"
  | "view_plan";

export interface PostPlanLite {
  id: string;
  status?: string | null;
  posted_at?: string | null;
  linked_post_id?: string | null;
}

export interface ContributionRowLite {
  post_number: number;
  contribution: number;
  hook_type?: string | null;
  format?: string | null;
  cta_type?: string | null;
}

export interface SignalLite {
  impressions?: number | null;
  clicks?: number | null;
  hook_type?: string | null;
  format?: string | null;
  conversion_signal_score?: number | null;
}

export interface EvaluateTriggersInput {
  campaign: {
    target_quantity?: number | null;
    target_metric?: string | null;
    current_goal_value?: number | null;
    completed_at?: string | null;
  };
  postPlans: PostPlanLite[];
  signals: SignalLite[];
  pacing: Pacing;
  contributionRows: ContributionRowLite[];
  currentGoalValue: number;
  now?: Date;
}

// ---- Helpers ----------------------------------------------------------------
const dayMs = 24 * 60 * 60 * 1000;

function daysSince(iso: string | Date | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / dayMs);
}

function metricLabel(metric: string | null | undefined): string {
  return (metric || "results").replace(/_/g, " ");
}

// ---- Triggers ---------------------------------------------------------------
export function evaluateTriggers(input: EvaluateTriggersInput): CampaignAlert | null {
  const { campaign, postPlans, signals, pacing, contributionRows, currentGoalValue } = input;
  const now = input.now ?? new Date();
  const isCampaignFinished = !!campaign.completed_at;

  if (isCampaignFinished) return null;

  const postedPosts = postPlans.filter(
    (p) => p.status === "posted" || !!p.linked_post_id || !!p.posted_at,
  );
  const postedCount = postedPosts.length;

  // ---- 1. Stagnation -------------------------------------------------------
  if (postedCount > 0) {
    const lastPostedAt = postedPosts
      .map((p) => p.posted_at)
      .filter((d): d is string => !!d)
      .sort()
      .pop();
    const daysSinceLast = daysSince(lastPostedAt, now);
    const remainingPlans = postPlans.length - postedCount;
    if (daysSinceLast !== null && daysSinceLast >= STAGNATION_DAYS && remainingPlans > 0) {
      return {
        kind: "stagnation",
        severity: "critical",
        headline: "Campaign has gone silent",
        delta: `No posts in ${daysSinceLast} days — momentum is fading.`,
        body: "Long gaps reset audience attention and slow learning. Ship the next post to keep the algorithm and your readers engaged.",
        cta: { label: "Create next post", action: "create_post" },
      };
    }
  }

  // ---- 2. Execution Failure ------------------------------------------------
  if (
    pacing.state === "BEHIND" &&
    pacing.delta <= BEHIND_THRESHOLD &&
    pacing.expectedByNow > 0
  ) {
    const behindBy = Math.abs(pacing.delta);
    return {
      kind: "execution_failure",
      severity: "critical",
      headline: "You're falling behind execution",
      delta: `${behindBy} ${behindBy === 1 ? "post" : "posts"} behind expected pace.`,
      body: `Expected ${pacing.expectedByNow} live by today, only ${pacing.actual} published. ${pacing.postsRemaining} remain in ${pacing.daysRemaining} days — ship to recover cadence.`,
      cta: { label: "View plan", action: "view_plan" },
    };
  }

  // ---- 3. Forecast Risk ----------------------------------------------------
  if (
    postedCount >= MIN_POSTS_FOR_PERFORMANCE &&
    campaign.target_quantity &&
    campaign.target_quantity > 0 &&
    pacing.daysElapsed > 0 &&
    pacing.daysTotal > 0
  ) {
    const elapsedRatio = pacing.daysElapsed / pacing.daysTotal;
    if (elapsedRatio > 0.15) {
      // Linear projection: extrapolate current value to end-of-campaign
      const projected = Math.round(currentGoalValue / elapsedRatio);
      const ratio = projected / campaign.target_quantity;
      if (ratio < FORECAST_MISS_THRESHOLD) {
        const gap = Math.max(0, campaign.target_quantity - projected);
        const m = metricLabel(campaign.target_metric);
        return {
          kind: "forecast_risk",
          severity: "high",
          headline: "On track to miss your goal",
          delta: `Projected ${projected} ${m} vs target of ${campaign.target_quantity} (${gap} short).`,
          body: `At current pace, you'll hit roughly ${Math.round(ratio * 100)}% of target. Either lift output or shift strategy — the trajectory needs to change.`,
          cta: { label: "Review strategy", action: "review_strategy" },
        };
      }
    }
  }

  // ---- 4. Performance Failure ----------------------------------------------
  if (postedCount >= MIN_POSTS_FOR_PERFORMANCE && signals.length > 0) {
    const totalImpr = signals.reduce((s, x) => s + (x.impressions || 0), 0);
    const totalClicks = signals.reduce((s, x) => s + (x.clicks || 0), 0);
    const ctr = totalImpr > 0 ? totalClicks / totalImpr : 0;
    const totalContribution = contributionRows.reduce((s, r) => s + (r.contribution || 0), 0);
    if (ctr < BASELINE_CTR && totalContribution === 0 && totalImpr > 50) {
      const m = metricLabel(campaign.target_metric);
      return {
        kind: "performance_failure",
        severity: "high",
        headline: "Content isn't converting",
        delta: `${postedCount} posts live · CTR ${(ctr * 100).toFixed(2)}% (below ${(BASELINE_CTR * 100).toFixed(1)}% baseline) · 0 ${m}.`,
        body: "Reach exists but the audience isn't acting. The hook, CTA, or offer needs to change — same volume won't fix this.",
        cta: { label: "Review strategy", action: "review_strategy" },
      };
    }
  }

  // ---- 5. Pattern Detected -------------------------------------------------
  if (postedCount >= MIN_POSTS_FOR_PATTERN && contributionRows.length >= 2) {
    // Group contributions by hook_type, then by format. Find best-vs-rest lift.
    const best = findBestPattern(contributionRows);
    if (best && best.lift >= PATTERN_MULTIPLIER) {
      const m = metricLabel(campaign.target_metric);
      return {
        kind: "pattern_detected",
        severity: "medium",
        headline: "Winning pattern detected",
        delta: `"${best.value}" ${best.dimension} converts ${best.lift.toFixed(1)}× the rest.`,
        body: `Posts using this pattern average ${best.bestAvg.toFixed(1)} ${m} vs ${best.restAvg.toFixed(1)} elsewhere. Replicate it in the next 2-3 posts.`,
        cta: { label: "Replicate pattern", action: "create_post" },
      };
    }
  }

  return null;
}

// ---- Pattern detection ------------------------------------------------------
interface PatternHit {
  dimension: "hook" | "format" | "CTA";
  value: string;
  bestAvg: number;
  restAvg: number;
  lift: number;
}

function findBestPattern(rows: ContributionRowLite[]): PatternHit | null {
  const dims: Array<{ key: keyof ContributionRowLite; label: PatternHit["dimension"] }> = [
    { key: "hook_type", label: "hook" },
    { key: "format", label: "format" },
    { key: "cta_type", label: "CTA" },
  ];
  let best: PatternHit | null = null;
  for (const { key, label } of dims) {
    const groups = new Map<string, number[]>();
    for (const r of rows) {
      const v = (r[key] as string | null | undefined) || null;
      if (!v) continue;
      const arr = groups.get(v) ?? [];
      arr.push(r.contribution || 0);
      groups.set(v, arr);
    }
    if (groups.size < 2) continue;
    for (const [value, contribs] of groups) {
      if (contribs.length < 1) continue;
      const bestAvg = avg(contribs);
      const restContribs: number[] = [];
      for (const [v2, c2] of groups) if (v2 !== value) restContribs.push(...c2);
      if (restContribs.length === 0) continue;
      const restAvg = avg(restContribs);
      if (restAvg <= 0) continue;
      const lift = bestAvg / restAvg;
      if (!best || lift > best.lift) {
        best = { dimension: label, value, bestAvg, restAvg, lift };
      }
    }
  }
  return best;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// ---- UI tone tokens ---------------------------------------------------------
export const SEVERITY_TONE: Record<
  AlertSeverity,
  { ring: string; bg: string; dot: string; text: string; label: string }
> = {
  critical: {
    ring: "border-destructive/40",
    bg: "bg-destructive/5",
    dot: "bg-destructive",
    text: "text-destructive",
    label: "Critical",
  },
  high: {
    ring: "border-amber-500/40",
    bg: "bg-amber-500/5",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    label: "High",
  },
  medium: {
    ring: "border-blue-500/40",
    bg: "bg-blue-500/5",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    label: "Insight",
  },
};
