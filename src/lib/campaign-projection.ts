// Pace-based projection + time-vs-goal intelligence + confidence layer.
// Pure helpers, no UI. Used to power the "predictive" layer that tells the
// user whether they will hit their target at the current pace.
//
// Confidence rules (so the system stops over-promising on tiny samples):
//   - low      → < 3 posts with contributions OR timeProgressPct < 10
//   - medium   → 3-5 posts
//   - high     → ≥ 6 posts AND timeProgressPct ≥ 25
// When confidence is low we mark `stable=false` and DO NOT publish a hard
// projection number — the UI shows "Need 3+ posts to project" instead.

export type Trajectory = "ahead" | "on_pace" | "behind" | "critical" | "unknown";
export type Confidence = "low" | "medium" | "high";

export type CampaignProjection = {
  // Time
  daysElapsed: number;
  totalDays: number;
  daysRemaining: number;
  timeProgressPct: number;        // 0-100, may exceed 100 if overrun
  // Goal
  goalProgressPct: number;        // 0-? uncapped
  // Projection
  expectedAtEnd: number | null;   // null when unstable / unknown
  expectedLow: number | null;     // ±30% band low end (medium confidence)
  expectedHigh: number | null;    // ±30% band high end
  gap: number;                    // target - expectedAtEnd, can be negative if overshoot
  paceMultiplier: number;         // expected/target (1 = on track)
  trajectory: Trajectory;
  // Confidence
  confidence: Confidence;
  stable: boolean;                // false → projection should be suppressed
  postsWithContribution: number;
  // Comparison narrative
  paceDelta: number;              // timeProgressPct - goalProgressPct (positive = behind)
  paceDeltaLabel: string;         // "4.2x behind schedule" or "On schedule"
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Calculate pace-based projection with confidence guard.
 */
export const computeProjection = (
  startedAt: string | Date | null | undefined,
  targetEndAt: string | Date | null | undefined,
  currentValue: number,
  target: number | null | undefined,
  contributionRows: { contribution: number }[] = [],
): CampaignProjection => {
  const start = startedAt ? new Date(startedAt) : null;
  const end = targetEndAt ? new Date(targetEndAt) : null;
  const now = new Date();

  const totalMs = start && end ? Math.max(1, end.getTime() - start.getTime()) : 0;
  const elapsedMs = start ? Math.max(0, now.getTime() - start.getTime()) : 0;
  const daysElapsed = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  const totalDays = totalMs ? Math.ceil(totalMs / (24 * 60 * 60 * 1000)) : 0;
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  const timeProgressPct = totalMs ? clamp((elapsedMs / totalMs) * 100, 0, 999) : 0;

  const t = target && target > 0 ? target : 0;
  const goalProgressPct = t > 0 ? (currentValue / t) * 100 : 0;

  // Confidence — based on data maturity
  const postsWithContribution = contributionRows.filter((r) => (r.contribution || 0) > 0).length;
  let confidence: Confidence = "low";
  if (postsWithContribution >= 6 && timeProgressPct >= 25) confidence = "high";
  else if (postsWithContribution >= 3) confidence = "medium";
  const stable = confidence !== "low" && timeProgressPct >= 10;

  // Expected outcome at end if pace continues — only when stable
  const paceFraction = elapsedMs > 0 && totalMs > 0 ? totalMs / elapsedMs : 0;
  const cap = t > 0 ? t * 3 : Number.POSITIVE_INFINITY;
  const rawExpected = paceFraction > 0 ? Math.round(currentValue * paceFraction) : currentValue;
  const cappedExpected = Math.min(rawExpected, cap);
  const expectedAtEnd = stable ? cappedExpected : null;
  const expectedLow = stable && confidence === "medium" ? Math.round(cappedExpected * 0.7) : null;
  const expectedHigh = stable && confidence === "medium" ? Math.min(Math.round(cappedExpected * 1.3), cap) : null;

  const gap = t > 0 && expectedAtEnd !== null ? t - expectedAtEnd : 0;
  const paceMultiplier = t > 0 && expectedAtEnd !== null ? expectedAtEnd / t : 0;

  let trajectory: Trajectory = "unknown";
  if (!start || !end || t === 0 || !stable) trajectory = "unknown";
  else if (paceMultiplier >= 1.1) trajectory = "ahead";
  else if (paceMultiplier >= 0.9) trajectory = "on_pace";
  else if (paceMultiplier >= 0.5) trajectory = "behind";
  else trajectory = "critical";

  const paceDelta = Math.round(timeProgressPct - goalProgressPct);
  let paceDeltaLabel = "On schedule";
  if (timeProgressPct > 0 && goalProgressPct >= 0) {
    if (goalProgressPct === 0 && timeProgressPct > 5) {
      paceDeltaLabel = `No progress yet (${Math.round(timeProgressPct)}% of time used)`;
    } else if (paceDelta > 5) {
      const mult = goalProgressPct > 0 ? (timeProgressPct / goalProgressPct).toFixed(1) : "∞";
      paceDeltaLabel = `${mult}x behind schedule`;
    } else if (paceDelta < -5) {
      paceDeltaLabel = `Ahead of schedule by ${Math.abs(paceDelta)}%`;
    }
  }

  return {
    daysElapsed,
    totalDays,
    daysRemaining,
    timeProgressPct: Math.round(timeProgressPct),
    goalProgressPct: Math.round(goalProgressPct),
    expectedAtEnd,
    expectedLow,
    expectedHigh,
    gap,
    paceMultiplier: Number(paceMultiplier.toFixed(2)),
    trajectory,
    confidence,
    stable,
    postsWithContribution,
    paceDelta,
    paceDeltaLabel,
  };
};

// Neutralized backgrounds — color lives on the verdict text + thin left border only.
export const trajectoryMeta: Record<Trajectory, { label: string; tone: string; bg: string; verdict: string }> = {
  ahead: {
    label: "Ahead of pace",
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-card",
    verdict: "On track to outperform — protect the playbook",
  },
  on_pace: {
    label: "On pace",
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-card",
    verdict: "Holding steady — keep the cadence",
  },
  behind: {
    label: "Behind pace",
    tone: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-card",
    verdict: "Will miss target at current rate — adjust now",
  },
  critical: {
    label: "Will fail at current pace",
    tone: "text-destructive",
    bg: "bg-card",
    verdict: "Campaign will fail without intervention this week",
  },
  unknown: {
    label: "Projection pending",
    tone: "text-muted-foreground",
    bg: "bg-card",
    verdict: "Need 3+ posts with contributions to project",
  },
};

/**
 * Identifies the top contributing post and recommends cloning its pattern.
 * Returns null when there is no meaningful winner.
 */
export const buildNextBestAction = (
  rows: { post_number: number; contribution: number; clicks: number; impressions: number }[],
  goalLabel: string,
  gap: number,
): { headline: string; detail: string; expectedImpact: string } | null => {
  const top = [...rows]
    .filter((r) => r.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)[0];
  if (!top || gap <= 0) return null;
  const postsToClone = Math.max(1, Math.ceil(gap / Math.max(1, top.contribution)));
  const conv = top.clicks > 0 ? `${((top.contribution / top.clicks) * 100).toFixed(0)}% conversion` : "highest contributor";
  return {
    headline: `Clone Post ${top.post_number} format ${postsToClone === 1 ? "once" : `${Math.min(postsToClone, 5)} times`} this week`,
    detail: `Post ${top.post_number} drove ${top.contribution} ${goalLabel} (${conv}). Replicate its hook + CTA structure.`,
    expectedImpact: `Expected impact: +${Math.min(postsToClone, 5) * top.contribution} ${goalLabel}`,
  };
};

/**
 * Required posting velocity to hit the target from where we stand.
 * Returns null when we don't have enough data to compute it (no avg yet).
 */
export const computeRequiredVelocity = (
  currentValue: number,
  target: number | null | undefined,
  daysRemaining: number,
  rows: { contribution: number }[],
): { postsPerWeek: number; avgContributionPerPost: number } | null => {
  if (!target || target <= 0 || daysRemaining <= 0) return null;
  const contributing = rows.filter((r) => (r.contribution || 0) > 0);
  if (contributing.length === 0) return null;
  const avg = contributing.reduce((s, r) => s + r.contribution, 0) / contributing.length;
  if (avg <= 0) return null;
  const remaining = Math.max(0, target - currentValue);
  const weeksRemaining = Math.max(1, daysRemaining / 7);
  const postsPerWeek = Math.ceil((remaining / avg) / weeksRemaining);
  return { postsPerWeek, avgContributionPerPost: Number(avg.toFixed(1)) };
};
