// Closed-loop execution engine — pure, no I/O.
// Computes execution score, velocity, state transitions, and predictive outcome
// from campaign + post-plan + post-signal data.

export type ExecutionStatus = "planned" | "active" | "at_risk" | "completed" | "failed" | "paused";

export type PostPlanLite = {
  id: string;
  status?: string | null;
  planned_date?: string | null;
  posted_at?: string | null;
  week_number: number;
  phase?: string | null;
};

export type PostSignalLite = {
  impressions?: number | null;
  engagement?: number | null;
  clicks?: number | null;
  comment_quality?: string | null;
  conversion_signal_score?: number | null;
  hook_type?: string | null;
  cta_type?: string | null;
  post_style?: string | null;
};

export type ExecutionMetrics = {
  totalPlanned: number;
  posted: number;
  missed: number;
  scheduled: number;
  drafted: number;
  onTimePosts: number;
  ctaPostsRate: number;            // 0-1
  velocityActual: number;          // posts/week shipped
  velocityRequired: number;        // posts/week required
  velocityScore: number;           // 0-1
  executionScore: number;          // 0-10
  postingProgressPct: number;      // 0-100
  daysElapsed: number;
  daysRemaining: number;
  daysTotal: number;
};

export type ExecutionDiagnostic = {
  state: ExecutionStatus;
  reasonShort: string;          // one-line reason for state
  fixes: string[];              // 1-3 directive actions
};

const dayMs = 24 * 60 * 60 * 1000;

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export const computeExecutionMetrics = (
  postPlans: PostPlanLite[],
  startedAt: string | Date | null | undefined,
  endsAt: string | Date | null | undefined,
  signals: PostSignalLite[] = [],
): ExecutionMetrics => {
  const now = new Date();
  const start = startedAt ? new Date(startedAt) : null;
  const end = endsAt ? new Date(endsAt) : null;

  const totalPlanned = postPlans.length;
  const posted = postPlans.filter(p => p.status === "posted").length;
  const missed = postPlans.filter(p => p.status === "missed").length;
  const scheduled = postPlans.filter(p => p.status === "scheduled").length;
  const drafted = postPlans.filter(p => p.status === "drafted").length;

  const onTimePosts = postPlans.filter(p => {
    if (p.status !== "posted" || !p.posted_at || !p.planned_date) return false;
    return new Date(p.posted_at).getTime() <= new Date(p.planned_date).getTime() + dayMs;
  }).length;

  const ctaPostsRate = signals.length > 0
    ? signals.filter(s => s.cta_type && s.cta_type !== "none").length / signals.length
    : 0;

  const daysTotal = start && end ? Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs)) : 7;
  const daysElapsed = start ? clamp(Math.round((now.getTime() - start.getTime()) / dayMs), 0, daysTotal) : 0;
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);

  const weeksElapsed = Math.max(1, daysElapsed / 7);
  const weeksTotal = Math.max(1, daysTotal / 7);
  const velocityActual = Math.round((posted / weeksElapsed) * 10) / 10;
  const velocityRequired = Math.round((totalPlanned / weeksTotal) * 10) / 10;
  const velocityScore = velocityRequired > 0 ? clamp(velocityActual / velocityRequired, 0, 1.5) : 0;

  // Execution score = posts_posted/planned * 0.5 + on_time_rate * 0.3 + cta_rate * 0.2 → /10
  const postedRate = totalPlanned > 0 ? posted / totalPlanned : 0;
  const onTimeRate = posted > 0 ? onTimePosts / posted : 0;
  const executionScore = Math.round(
    (postedRate * 0.5 + onTimeRate * 0.3 + ctaPostsRate * 0.2) * 100,
  ) / 10;

  const postingProgressPct = totalPlanned > 0
    ? Math.round(((posted + scheduled + drafted) / totalPlanned) * 100)
    : 0;

  return {
    totalPlanned, posted, missed, scheduled, drafted, onTimePosts,
    ctaPostsRate, velocityActual, velocityRequired, velocityScore,
    executionScore, postingProgressPct,
    daysElapsed, daysRemaining, daysTotal,
  };
};

// State machine: derive next ExecutionStatus from metrics + current.
export const deriveExecutionStatus = (
  current: ExecutionStatus,
  m: ExecutionMetrics,
  hasGoalReached: boolean,
): ExecutionStatus => {
  if (current === "paused" || current === "completed" || current === "failed") return current;

  // Hasn't started: stays planned until first posted/scheduled OR start date passed
  if (current === "planned") {
    if (m.posted > 0 || m.scheduled > 0) return "active";
    if (m.daysElapsed > 0) return "active";
    return "planned";
  }

  // Active or At Risk → check completion / failure / risk
  const ended = m.daysRemaining === 0 && m.daysTotal > 0;
  if (ended) {
    if (hasGoalReached) return "completed";
    if (m.posted >= m.totalPlanned * 0.8) return "completed";
    return "failed";
  }

  // At-risk triggers: missed > 30% OR velocity < 50% OR no CTA in last third of timeline
  const missedRate = m.totalPlanned > 0 ? m.missed / m.totalPlanned : 0;
  const inConversionPhase = m.daysElapsed / Math.max(1, m.daysTotal) > 0.66;
  const noCtaInConversion = inConversionPhase && m.ctaPostsRate < 0.3;

  if (missedRate > 0.3 || m.velocityScore < 0.5 || noCtaInConversion) return "at_risk";
  return "active";
};

export const buildExecutionDiagnostic = (
  state: ExecutionStatus,
  m: ExecutionMetrics,
): ExecutionDiagnostic => {
  const fixes: string[] = [];
  let reason = "";

  if (state === "at_risk" || state === "failed") {
    if (m.velocityScore < 0.5) {
      reason = `Velocity ${m.velocityActual}/wk vs ${m.velocityRequired}/wk required`;
      fixes.push(`Ship ${Math.ceil(m.velocityRequired - m.velocityActual)} more posts this week`);
    }
    const missedRate = m.totalPlanned > 0 ? m.missed / m.totalPlanned : 0;
    if (missedRate > 0.3) {
      reason ||= `${m.missed} of ${m.totalPlanned} posts missed`;
      fixes.push("Reschedule missed posts to recover cadence");
    }
    if (m.ctaPostsRate < 0.3 && m.daysElapsed / Math.max(1, m.daysTotal) > 0.5) {
      reason ||= "Conversion CTAs missing";
      fixes.push("Add a hard CTA to upcoming posts");
    }
  } else if (state === "active") {
    reason = m.velocityActual >= m.velocityRequired ? "On pace" : "Slightly behind pace";
    if (m.posted === 0) fixes.push("Mark your first post as posted to start measuring");
  } else if (state === "planned") {
    reason = "Not started — schedule or post to activate";
    fixes.push("Start the campaign or schedule the first post");
  } else if (state === "completed") {
    reason = `Completed · ${m.posted} of ${m.totalPlanned} shipped`;
  }

  return { state, reasonShort: reason || "On track", fixes };
};

// Predictive: given current pace + signals, estimate expected outcome at end.
export const predictOutcome = (
  m: ExecutionMetrics,
  targetQuantity: number | null | undefined,
  signals: PostSignalLite[],
): { expected: number; confidence: "low" | "medium" | "high"; trajectory: "ahead" | "on_track" | "behind" } => {
  const target = targetQuantity ?? 0;
  if (!target || m.posted === 0) {
    return { expected: 0, confidence: "low", trajectory: m.posted === 0 ? "behind" : "on_track" };
  }
  const avgConversionPerPost =
    signals.reduce((s, x) => s + (x.conversion_signal_score || 0), 0) / Math.max(1, signals.length) / 100;
  const projectedPosts = m.totalPlanned;
  // Simple linear: scale conversion proxy by remaining posts
  const baseline = (avgConversionPerPost * projectedPosts) * (target * 0.5);
  const expected = Math.max(0, Math.round(baseline));

  const confidence: "low" | "medium" | "high" =
    signals.length >= 5 ? "high" : signals.length >= 2 ? "medium" : "low";
  const trajectory: "ahead" | "on_track" | "behind" =
    expected >= target * 1.05 ? "ahead" : expected >= target * 0.85 ? "on_track" : "behind";

  return { expected, confidence, trajectory };
};

// Phase from week number / timeline ratio.
export const phaseFromWeek = (week: number, totalWeeks: number): string => {
  if (totalWeeks <= 1) return "launch";
  const r = week / totalWeeks;
  if (r <= 0.25) return "awareness";
  if (r <= 0.5) return "solution";
  if (r <= 0.75) return "proof";
  return "conversion";
};

// ============================================================
// Time-Aware Pacing Engine (v1)
// Exposes a single function that says — in plain English —
// whether the campaign is NOT_STARTED / BEHIND / ON_TRACK / AHEAD
// based on calendar time vs posts shipped.
// ============================================================

export type PacingState = "NOT_STARTED" | "BEHIND" | "ON_TRACK" | "AHEAD";

export type Pacing = {
  state: PacingState;
  expectedByNow: number;       // posts that should be live by today
  actual: number;              // posts actually live
  delta: number;               // actual - expectedByNow (negative = behind)
  daysElapsed: number;
  daysRemaining: number;
  daysTotal: number;
  postsRemaining: number;
  requiredVelocity: number;    // posts/week required to finish on time
  reasonShort: string;         // one-line human reason (drives UI strip)
};

const ON_TRACK_TOLERANCE = 0.5; // posts — within ±0.5 of expected counts as on track

export const computePacing = (
  postPlans: PostPlanLite[],
  startedAt: string | Date | null | undefined,
  endsAt: string | Date | null | undefined,
  now: Date = new Date(),
): Pacing => {
  const totalPlanned = postPlans.length;
  const posted = postPlans.filter(p => p.status === "posted").length;

  const start = startedAt ? new Date(startedAt) : null;
  const end = endsAt ? new Date(endsAt) : null;

  const daysTotal = start && end
    ? Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs))
    : 7;
  const daysElapsedRaw = start ? (now.getTime() - start.getTime()) / dayMs : 0;
  const daysElapsed = clamp(Math.round(daysElapsedRaw), 0, daysTotal);
  const daysRemaining = Math.max(0, daysTotal - daysElapsed);
  const postsRemaining = Math.max(0, totalPlanned - posted);

  // Expected by today = linear pace through the campaign window
  const elapsedRatio = daysTotal > 0 ? clamp(daysElapsedRaw / daysTotal, 0, 1) : 0;
  const expectedByNow = totalPlanned > 0 ? Math.round(elapsedRatio * totalPlanned) : 0;
  const delta = posted - expectedByNow;

  let state: PacingState;
  let reasonShort: string;

  if (totalPlanned === 0 || posted === 0 && (daysElapsedRaw <= 0 || elapsedRatio < 0.05)) {
    // Truly not started: no posts AND barely any time has elapsed (< 5% of window)
    state = "NOT_STARTED";
    reasonShort = totalPlanned === 0
      ? "No plan yet — generate the campaign plan to begin."
      : "Campaign hasn't started yet — publish your first post to activate.";
  } else if (posted === 0 && expectedByNow > 0) {
    // Time has elapsed but nothing posted = behind
    state = "BEHIND";
    reasonShort = `Expected ${expectedByNow} post${expectedByNow === 1 ? "" : "s"} by today, 0 published.`;
  } else if (delta < -ON_TRACK_TOLERANCE) {
    state = "BEHIND";
    reasonShort = `${posted} of ${expectedByNow} expected by today (behind by ${Math.abs(delta)}).`;
  } else if (delta > ON_TRACK_TOLERANCE) {
    state = "AHEAD";
    reasonShort = `${posted} of ${expectedByNow} expected by today (ahead by ${delta}).`;
  } else {
    state = "ON_TRACK";
    reasonShort = `${posted} of ${expectedByNow} expected by today — on pace.`;
  }

  // Required velocity: posts/week needed to finish remaining work in remaining days
  const requiredVelocity = daysRemaining > 0
    ? Math.round((postsRemaining / daysRemaining) * 7 * 10) / 10
    : postsRemaining > 0 ? postsRemaining * 7 : 0; // 0 days remaining → must ship today

  return {
    state, expectedByNow, actual: posted, delta,
    daysElapsed, daysRemaining, daysTotal, postsRemaining,
    requiredVelocity, reasonShort,
  };
};

export const PACING_STATE_META: Record<PacingState, { label: string; dot: string; text: string; ring: string; bg: string }> = {
  NOT_STARTED: {
    label: "Not started",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
    ring: "border-border",
    bg: "bg-muted/30",
  },
  BEHIND: {
    label: "Behind",
    dot: "bg-destructive",
    text: "text-destructive",
    ring: "border-destructive/40",
    bg: "bg-destructive/5",
  },
  ON_TRACK: {
    label: "On track",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
    ring: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
  },
  AHEAD: {
    label: "Ahead",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    ring: "border-blue-500/40",
    bg: "bg-blue-500/5",
  },
};

export const EXECUTION_STATUS_META: Record<ExecutionStatus, { label: string; tone: string }> = {
  planned:   { label: "Planned",   tone: "text-muted-foreground" },
  active:    { label: "Active",    tone: "text-foreground" },
  at_risk:   { label: "At Risk",   tone: "text-yellow-600" },
  completed: { label: "Completed", tone: "text-green-600" },
  failed:    { label: "Failed",    tone: "text-destructive" },
  paused:    { label: "Paused",    tone: "text-muted-foreground" },
};
