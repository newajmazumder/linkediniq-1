// Shared strategy helpers — compute campaign state and a synthetic Strategy Score.
// Pure functions, no UI. Keeps StrategyPage and CampaignPlanPage consistent.

export type CampaignState = "winning" | "on_track" | "at_risk" | "off_track" | "draft";

export type StateMeta = {
  label: string;
  dotClass: string;     // bg-* color for dot/badge
  textClass: string;    // text-* color
  borderClass: string;  // border-l-4 color
  bgClass: string;      // subtle bg tint
  emoji: string;
};

export const STATE_META: Record<CampaignState, StateMeta> = {
  winning:   { label: "Winning",    emoji: "🟢", dotClass: "bg-green-500",  textClass: "text-green-600",   borderClass: "border-l-green-500",   bgClass: "bg-green-500/5" },
  on_track:  { label: "On Track",   emoji: "🟢", dotClass: "bg-green-500",  textClass: "text-green-600",   borderClass: "border-l-green-500",   bgClass: "bg-green-500/5" },
  at_risk:   { label: "At Risk",    emoji: "🟡", dotClass: "bg-yellow-500", textClass: "text-yellow-600",  borderClass: "border-l-yellow-500",  bgClass: "bg-yellow-500/5" },
  off_track: { label: "Off Track",  emoji: "🔴", dotClass: "bg-destructive",textClass: "text-destructive", borderClass: "border-l-destructive", bgClass: "bg-destructive/5" },
  draft:     { label: "Not Started",emoji: "⚪", dotClass: "bg-muted-foreground", textClass: "text-muted-foreground", borderClass: "border-l-border", bgClass: "bg-muted/30" },
};

export type StateInputs = {
  outcomePct?: number | null;       // 0-100, current vs target outcome
  postingPct?: number | null;       // 0-100, drafted/total planned
  totalPlanned?: number;            // # planned posts
  hasPlan?: boolean;                // plan generated
};

export const computeCampaignState = (i: StateInputs): CampaignState => {
  if (!i.hasPlan && (!i.totalPlanned || i.totalPlanned === 0)) return "draft";
  const outcome = i.outcomePct ?? null;
  const posting = i.postingPct ?? null;

  // Winning: outcome ≥ 80%
  if (outcome !== null && outcome >= 80) return "winning";
  // On track: outcome ≥ 50% OR posting ≥ 70% with no outcome data
  if (outcome !== null && outcome >= 50) return "on_track";
  if (outcome === null && posting !== null && posting >= 70) return "on_track";
  // Off track: nothing happening
  if ((outcome === null || outcome < 20) && (posting === null || posting < 30)) return "off_track";
  return "at_risk";
};

export type StrategyScoreBreakdown = {
  positioning: number;  // clarity of message + offer + persona
  execution: number;    // posting velocity vs plan
  conversion: number;   // outcome vs target
  total: number;        // /10
};

type ScoreInputs = {
  hasCoreMessage: boolean;
  hasPersona: boolean;
  hasOffer: boolean;
  hasMeasurableTarget: boolean;
  postingPct?: number | null;
  outcomePct?: number | null;
};

export const computeStrategyScore = (i: ScoreInputs): StrategyScoreBreakdown => {
  // Positioning: 0-10
  let positioning = 0;
  if (i.hasCoreMessage) positioning += 4;
  if (i.hasPersona) positioning += 3;
  if (i.hasOffer) positioning += 2;
  if (i.hasMeasurableTarget) positioning += 1;

  // Execution: 0-10 from posting velocity
  const execution = i.postingPct == null ? 0 : Math.round(Math.min(100, i.postingPct) / 10);

  // Conversion: 0-10 from outcome
  const conversion = i.outcomePct == null ? 0 : Math.round(Math.min(100, i.outcomePct) / 10);

  const total = Number(((positioning * 0.35 + execution * 0.35 + conversion * 0.30)).toFixed(1));
  return { positioning, execution, conversion, total };
};

export const scoreColor = (n: number) => {
  if (n >= 7.5) return "text-green-600";
  if (n >= 5) return "text-yellow-600";
  return "text-destructive";
};

export type ScoreSeverity = "critical" | "warning" | "good" | "excellent";

export const scoreSeverity = (n: number): ScoreSeverity => {
  if (n >= 8) return "excellent";
  if (n >= 6) return "good";
  if (n >= 3.5) return "warning";
  return "critical";
};

export const scoreVerdict = (sev: ScoreSeverity): string => {
  switch (sev) {
    case "excellent": return "Strategy is firing on all cylinders.";
    case "good": return "Solid foundation. Tighten one weak pillar to break through.";
    case "warning": return "Strategy will underperform without intervention.";
    case "critical": return "CRITICAL: Strategy will fail without immediate action.";
  }
};

// Diagnose what's broken and what to fix — turns the score into a decision.
export type ScoreDiagnostic = {
  severity: ScoreSeverity;
  verdict: string;
  why: string[];
  fixes: string[];
};

export const diagnoseScore = (
  s: StrategyScoreBreakdown,
  i: ScoreInputs,
): ScoreDiagnostic => {
  const why: string[] = [];
  const fixes: string[] = [];

  if (!i.hasCoreMessage) { why.push("No core message defined"); fixes.push("Write a one-line core message"); }
  if (!i.hasPersona) { why.push("No primary persona"); fixes.push("Assign a target persona"); }
  if (!i.hasMeasurableTarget) { why.push("No measurable target"); fixes.push("Set a target metric and quantity"); }

  if (s.execution <= 2) { why.push("No posts created yet"); fixes.push("Generate posts for Week 1 now"); }
  else if (s.execution <= 5) { why.push("Posting cadence is slow"); fixes.push("Catch up on planned posts this week"); }

  if (s.conversion === 0 && i.outcomePct == null) { why.push("No outcome signal yet"); fixes.push("Publish posts with a clear CTA to start tracking"); }
  else if (s.conversion <= 3) { why.push("Conversion CTAs aren't landing"); fixes.push("Switch to a harder, outcome-focused CTA"); }

  return { severity: scoreSeverity(s.total), verdict: scoreVerdict(scoreSeverity(s.total)), why, fixes };
};

// The single "do this now" action surfaced on every campaign.
export type PrimaryActionInfo = {
  label: string;
  urgent: boolean;
  href: string;
};

export const primaryAction = (
  campaignId: string,
  state: CampaignState,
  inputs: { totalPlanned?: number; postingPct?: number | null; firstWeekPostsRemaining?: number },
): PrimaryActionInfo => {
  if (state === "draft" || !inputs.totalPlanned) {
    return { label: "Generate the campaign plan", urgent: true, href: `/campaign/${campaignId}` };
  }
  const remaining = inputs.firstWeekPostsRemaining ?? 0;
  if (remaining > 0) {
    return { label: `Generate ${remaining} post${remaining > 1 ? "s" : ""} for Week 1`, urgent: true, href: `/create?campaign_id=${campaignId}` };
  }
  if ((inputs.postingPct ?? 0) < 50) {
    return { label: "Create the next post", urgent: true, href: `/create?campaign_id=${campaignId}` };
  }
  if (state === "off_track" || state === "at_risk") {
    return { label: "Ship the next post to recover", urgent: true, href: `/create?campaign_id=${campaignId}` };
  }
  return { label: "Open the campaign plan", urgent: false, href: `/campaign/${campaignId}` };
};

// Map a week number (1-N) to a strategic phase narrative.
export const weekPhaseLabel = (weekNumber: number, totalWeeks: number): string => {
  if (totalWeeks <= 1) return "Launch";
  const ratio = weekNumber / totalWeeks;
  if (ratio <= 0.25) return "Problem Awareness";
  if (ratio <= 0.5) return "Introduce Solution";
  if (ratio <= 0.75) return "Proof & ROI";
  return "Conversion Push";
};

// One-paragraph campaign arc summary.
export const buildNarrativeSummary = (
  campaign: { core_message?: string | null; offer?: string | null; primary_objective?: string | null; target_metric?: string | null; target_quantity?: number | null },
  totalWeeks: number,
): string => {
  const objective = (campaign.primary_objective || "awareness").replace(/_/g, " ");
  const goal = campaign.target_quantity && campaign.target_metric
    ? `${campaign.target_quantity} ${campaign.target_metric.replace(/_/g, " ")}`
    : objective;

  if (totalWeeks >= 4) {
    const offerLine = campaign.offer ? ` and converts via ${campaign.offer.toLowerCase()}` : " and converts via a clear CTA";
    return `This campaign builds problem awareness, introduces the solution, proves ROI, then drives ${goal}${offerLine}.`;
  }
  if (totalWeeks >= 2) {
    return `This campaign frames the problem, then converts toward ${goal}.`;
  }
  return `This campaign focuses on ${goal}${campaign.offer ? ` via ${campaign.offer.toLowerCase()}` : ""}.`;
};
