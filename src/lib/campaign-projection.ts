// Pace-based projection + time-vs-goal intelligence.
// Pure helpers, no UI. Used to power the "predictive" layer that tells the
// user whether they will hit their target at the current pace.

export type Trajectory = "ahead" | "on_pace" | "behind" | "critical" | "unknown";

export type CampaignProjection = {
  // Time
  daysElapsed: number;
  totalDays: number;
  daysRemaining: number;
  timeProgressPct: number;        // 0-100, may exceed 100 if overrun
  // Goal
  goalProgressPct: number;        // 0-? uncapped
  // Projection
  expectedAtEnd: number;          // at current pace
  gap: number;                    // target - expectedAtEnd, can be negative if overshoot
  paceMultiplier: number;         // expected/target (1 = on track)
  trajectory: Trajectory;
  // Comparison narrative
  paceDelta: number;              // timeProgressPct - goalProgressPct (positive = behind)
  paceDeltaLabel: string;         // "4.2x behind schedule" or "On schedule"
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Calculate pace-based projection.
 * @param startedAt ISO date — when the campaign actually began
 * @param targetEndAt ISO date — when the campaign should be done
 * @param currentValue current goal achievement (rolled-up)
 * @param target target quantity
 */
export const computeProjection = (
  startedAt: string | Date | null | undefined,
  targetEndAt: string | Date | null | undefined,
  currentValue: number,
  target: number | null | undefined,
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

  // Expected outcome at end if pace continues
  const paceFraction = elapsedMs > 0 && totalMs > 0 ? totalMs / elapsedMs : 0;
  const expectedAtEnd = paceFraction > 0
    ? Math.round(currentValue * paceFraction)
    : currentValue;
  const gap = t > 0 ? t - expectedAtEnd : 0;

  const paceMultiplier = t > 0 ? expectedAtEnd / t : 0;

  let trajectory: Trajectory = "unknown";
  if (!start || !end || t === 0) trajectory = "unknown";
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
    gap,
    paceMultiplier: Number(paceMultiplier.toFixed(2)),
    trajectory,
    paceDelta,
    paceDeltaLabel,
  };
};

export const trajectoryMeta: Record<Trajectory, { label: string; tone: string; bg: string; verdict: string }> = {
  ahead: {
    label: "Ahead of pace",
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    verdict: "On track to outperform — protect the playbook",
  },
  on_pace: {
    label: "On pace",
    tone: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    verdict: "Holding steady — keep the cadence",
  },
  behind: {
    label: "Behind pace",
    tone: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-500/10 border-yellow-500/30",
    verdict: "Will miss target at current rate — adjust now",
  },
  critical: {
    label: "Will fail at current pace",
    tone: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
    verdict: "Campaign will fail without intervention this week",
  },
  unknown: {
    label: "No projection yet",
    tone: "text-muted-foreground",
    bg: "bg-muted/30 border-border",
    verdict: "Start the campaign and log contributions to enable projection",
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
