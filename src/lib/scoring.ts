// Phase 1 Foundation — single scoring source.
//
// Every UI surface that shows a "campaign score" or "post score" MUST go
// through this module. It reads ONE field (`primary_score`) from the row and
// returns an explainable breakdown derived from `score_breakdown` (jsonb).
//
// The legacy fields (`execution_score`, `velocity_score`,
// `strategy_strength_score`, `goal_progress_percent`,
// `goal_evaluations.goal_fulfillment_score`) are still written by their
// respective edge functions, but UI must NOT read them directly anymore.

export type CampaignScoreInput = {
  primary_score?: number | null;
  primary_score_kind?: string | null;
  score_breakdown?: Record<string, unknown> | null;
  // Legacy fields (fallback while write-through fully rolls out)
  execution_score?: number | null;
  velocity_score?: number | null;
  strategy_strength_score?: number | null;
  goal_progress_percent?: number | null;
  execution_status?: string | null;
};

export type PostScoreInput = {
  primary_score?: number | null;
  primary_score_kind?: string | null;
  score_breakdown?: Record<string, unknown> | null;
};

export type ScoreView = {
  value: number;          // 0–100
  kind: string;           // 'execution' | 'goal' | 'strategy' | 'predicted' | 'actual'
  breakdown: Array<{ label: string; value: number }>;
  tone: "good" | "warn" | "bad" | "neutral";
};

const tone = (v: number): ScoreView["tone"] => {
  if (v >= 70) return "good";
  if (v >= 40) return "warn";
  if (v > 0) return "bad";
  return "neutral";
};

const breakdownArray = (raw: Record<string, unknown> | null | undefined) => {
  if (!raw) return [];
  return Object.entries(raw)
    .filter(([, v]) => typeof v === "number" && !Number.isNaN(v))
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: Math.round((v as number) * 10) / 10 }));
};

export function getCampaignScore(c: CampaignScoreInput): ScoreView {
  // Prefer canonical primary_score
  const primary = typeof c.primary_score === "number" ? c.primary_score : null;
  if (primary !== null && primary > 0) {
    return {
      value: Math.round(primary * 10) / 10,
      kind: c.primary_score_kind || "campaign",
      breakdown: breakdownArray(c.score_breakdown),
      tone: tone(primary),
    };
  }

  // Fallback: derive from legacy fields (during rollout)
  const value =
    (typeof c.execution_score === "number" && c.execution_score > 0 ? c.execution_score : null) ??
    (typeof c.strategy_strength_score === "number" && c.strategy_strength_score > 0 ? c.strategy_strength_score : null) ??
    (typeof c.goal_progress_percent === "number" ? c.goal_progress_percent : 0);

  const kind =
    c.execution_status === "active" || c.execution_status === "at_risk"
      ? "execution"
      : c.execution_status === "completed"
        ? "goal"
        : "strategy";

  return {
    value: Math.round((value || 0) * 10) / 10,
    kind,
    breakdown: [
      { label: "execution", value: Math.round((c.execution_score || 0) * 10) / 10 },
      { label: "velocity", value: Math.round((c.velocity_score || 0) * 10) / 10 },
      { label: "strategy", value: Math.round((c.strategy_strength_score || 0) * 10) / 10 },
      { label: "goal", value: Math.round((c.goal_progress_percent || 0) * 10) / 10 },
    ],
    tone: tone(value || 0),
  };
}

export function getPostScore(p: PostScoreInput): ScoreView {
  const v = typeof p.primary_score === "number" ? p.primary_score : 0;
  return {
    value: Math.round(v * 10) / 10,
    kind: p.primary_score_kind || "predicted",
    breakdown: breakdownArray(p.score_breakdown),
    tone: tone(v),
  };
}
