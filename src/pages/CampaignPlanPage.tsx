import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, Target, ChevronDown, ChevronUp, Sparkles,
  BarChart3, FileText, AlertTriangle, TrendingUp,
  CheckCircle2, XCircle, ArrowRight, Zap, Flame, AlertCircle, Wrench, Eye, ThumbsUp, MessageSquare, MousePointer, ShieldCheck, Info,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import CampaignPostCard from "@/components/campaign/CampaignPostCard";
import ExecutionDashboard from "@/components/strategy/ExecutionDashboard";
import CampaignGoalProgressCard from "@/components/campaign/CampaignGoalProgressCard";
import CampaignGoalProgressBar from "@/components/campaign/CampaignGoalProgressBar";
import PostContributionTable from "@/components/campaign/PostContributionTable";
import { formatGoalProgress, goalMetricLabel } from "@/lib/goal-metrics";
import { goalUpdatedEvent } from "@/lib/goal-metrics";
import {
  computeCampaignState, STATE_META, computeStrategyScore, scoreColor, weekPhaseLabel,
  diagnoseScore, primaryAction as buildPrimaryAction, buildNarrativeSummary,
  scoreInterpretation, computeVelocity, buildPillarHints, SCORE_WEIGHTS,
} from "@/lib/strategy";
import ScoreBreakdownCard from "@/components/campaign/ScoreBreakdownCard";
import CampaignProjectionCard from "@/components/campaign/CampaignProjectionCard";
import RawToGoalInsight from "@/components/campaign/RawToGoalInsight";
import TopPerformerCard from "@/components/campaign/TopPerformerCard";
import TopContributorsStrip from "@/components/campaign/TopContributorsStrip";
import CampaignAdvisorBanner from "@/components/campaign/CampaignAdvisorBanner";
import StrategyVersionsCard from "@/components/campaign/StrategyVersionsCard";
import CampaignAlertCard from "@/components/campaign/CampaignAlertCard";
import StartCampaignDialog from "@/components/campaign/StartCampaignDialog";
import { Pause, Play } from "lucide-react";
import { refreshCampaignBrain, type AdvisorQuestion, type CampaignIntelligence } from "@/lib/campaign-brain";
import { computeProjection } from "@/lib/campaign-projection";
import { computePacing } from "@/lib/execution";
import { deriveLifecycleState, LIFECYCLE_META } from "@/lib/campaign-lifecycle";
import { evaluateTriggers } from "@/lib/campaign-triggers";

type Campaign = any;
type WeekPlan = any;
type PostPlan = any;
type Blueprint = any;

const CampaignPlanPage = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [weekPlans, setWeekPlans] = useState<WeekPlan[]>([]);
  const [postPlans, setPostPlans] = useState<PostPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [tab, setTab] = useState<"plan" | "performance" | "analytics" | "report">("plan");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [goalAgg, setGoalAgg] = useState<any>(null);
  const [loadingGoalAgg, setLoadingGoalAgg] = useState(false);
  const [interpretation, setInterpretation] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [advisorQuestions, setAdvisorQuestions] = useState<AdvisorQuestion[]>([]);
  const [intelligence, setIntelligence] = useState<CampaignIntelligence | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchAll();
      fetchGoalAggregate();
      refreshBrain();
    }
  }, [user, id]);

  // Live refresh when post contribution changes elsewhere
  useEffect(() => {
    if (!id) return;
    const handler = () => {
      fetchAll();
      fetchGoalAggregate();
      refreshBrain();
    };
    window.addEventListener(goalUpdatedEvent(id), handler);
    return () => window.removeEventListener(goalUpdatedEvent(id), handler);
  }, [id]);

  const refreshBrain = async () => {
    if (!id) return;
    const { intelligence: intel, advisor_questions } = await refreshCampaignBrain(id);
    if (intel) setIntelligence(intel);
    setAdvisorQuestions(advisor_questions);
  };

  const reloadAdvisorQuestions = async () => {
    if (!id) return;
    const { data } = await supabase
      .from("campaign_advisor_questions")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });
    setAdvisorQuestions((data || []) as any);
  };

  const fetchAll = async () => {
    setLoading(true);
    const [campRes, bpRes, wpRes, ppRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", id).single(),
      supabase.from("campaign_blueprints").select("*").eq("campaign_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("campaign_week_plans").select("*").eq("campaign_id", id).order("week_number"),
      supabase.from("campaign_post_plans").select("*").eq("campaign_id", id).order("post_number"),
    ]);
    setCampaign(campRes.data);
    setBlueprint(bpRes.data);
    setWeekPlans(wpRes.data || []);
    setPostPlans(ppRes.data || []);
    setLoading(false);
  };

  const generatePlan = async () => {
    // Guard — plan generation requires a campaign window. Open the start dialog instead.
    if (!campaign?.target_start_date || !campaign?.target_end_date) {
      setStartDialogOpen(true);
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-plan", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWeekPlans(data.week_plans || []);
      setPostPlans(data.post_plans || []);
      toast.success("Campaign plan generated!");
      // Refresh campaign row in case execution_status changed.
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
    }
  };

  const togglePause = async () => {
    if (!campaign) return;
    setTogglingStatus(true);
    try {
      const next = campaign.execution_status === "paused" ? "active" : "paused";
      const { error } = await supabase
        .from("campaigns")
        .update({ execution_status: next })
        .eq("id", id);
      if (error) throw error;
      setCampaign({ ...campaign, execution_status: next });
      toast.success(next === "paused" ? "Campaign paused" : "Campaign resumed");
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setTogglingStatus(false);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-analytics", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      setAnalytics(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load analytics");
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchGoalAggregate = async () => {
    setLoadingGoalAgg(true);
    try {
      const { data, error } = await supabase.functions.invoke("aggregate-campaign-goals", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGoalAgg(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load goal data");
    } finally {
      setLoadingGoalAgg(false);
    }
  };

  const generateGoalInsights = async () => {
    setGeneratingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("interpret-campaign-performance", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInterpretation(data?.insight || null);
      // Refresh aggregate so any newly-saved score is reflected
      fetchGoalAggregate();
      toast.success("Goal-aware insights generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate insights");
    } finally {
      setGeneratingInsights(false);
    }
  };

  const generateReport = async () => {
    setLoadingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-report", {
        body: { campaign_id: id },
      });
      if (error) throw error;
      setReport(data?.report);
      toast.success("Campaign report generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setLoadingReport(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!campaign) {
    return <div className="py-20 text-center text-muted-foreground">Campaign not found</div>;
  }

  const totalPosts = postPlans.length;
  const draftedPosts = postPlans.filter((p: any) => p.status !== "planned").length;
  const postedPosts = postPlans.filter((p: any) => p.status === "posted" || !!p.linked_post_id).length;
  const postingPct = totalPosts > 0 ? Math.round((draftedPosts / totalPosts) * 100) : null;
  const week1Remaining = postPlans.filter((p: any) => p.week_number === 1 && (!p.status || p.status === "planned")).length;

  const outcomePct = analytics?.outcome_progress?.progress_pct ?? null;

  // Lifecycle gating — don't simulate intelligence we don't have.
  const lifecycle = deriveLifecycleState({
    totalPlanned: totalPosts,
    weekPlansCount: weekPlans.length,
    postedCount: postedPosts,
  });
  const lifecycleMeta = LIFECYCLE_META[lifecycle];

  const state = computeCampaignState({
    outcomePct,
    postingPct,
    totalPlanned: totalPosts,
    hasPlan: weekPlans.length > 0,
  });
  const meta = STATE_META[state];

  const scoreInputs = {
    hasCoreMessage: !!campaign.core_message,
    hasPersona: !!campaign.primary_persona_id,
    hasOffer: !!campaign.offer,
    hasMeasurableTarget: !!(campaign.target_metric && campaign.target_quantity),
    postingPct,
    outcomePct,
  };
  const score = computeStrategyScore(scoreInputs);
  const diag = diagnoseScore(score, scoreInputs);

  const action = buildPrimaryAction(id!, state, {
    totalPlanned: totalPosts,
    postingPct,
    firstWeekPostsRemaining: week1Remaining,
  });

  const summary = buildNarrativeSummary(campaign, weekPlans.length);
  const interp = scoreInterpretation(diag.severity);
  const isUrgent = diag.severity === "critical" || diag.severity === "warning";
  const velocity = weekPlans.length > 0
    ? computeVelocity(draftedPosts, totalPosts, weekPlans.length)
    : null;

  // Pre-compute projection so we can show urgency micro-line in the hero.
  const startedRef = campaign.started_at || campaign.target_start_date;
  // v5: prefer explicit target_end_date; fall back to legacy week-derived end.
  const endsRef = campaign.target_end_date
    ? campaign.target_end_date
    : (startedRef && weekPlans.length > 0
        ? new Date(new Date(startedRef).getTime() + weekPlans.length * 7 * 24 * 60 * 60 * 1000).toISOString()
        : null);
  // Pacing — calendar-aware verdict (NOT_STARTED / BEHIND / ON_TRACK / AHEAD)
  const pacing = computePacing(postPlans as any, startedRef, endsRef);
  const proj = (campaign.target_quantity && campaign.target_metric)
    ? computeProjection(
        startedRef,
        endsRef,
        goalAgg?.current_goal_value ?? campaign.current_goal_value ?? 0,
        campaign.target_quantity,
        goalAgg?.contribution_rows || [],
      )
    : null;
  const showUrgency = proj && proj.stable && (proj.trajectory === "behind" || proj.trajectory === "critical");
  const velocityShort = velocity && !velocity.onPace ? (velocity.required - velocity.actual).toFixed(1) : null;
  const shortfallPct = proj && proj.stable && proj.gap > 0 && campaign.target_quantity
    ? Math.round((proj.gap / campaign.target_quantity) * 100)
    : null;

  return (
    <div className="content-fade-in space-y-6 px-4 sm:px-6 py-4">
      {/* HERO — calm, editorial, single accent */}
      <div className={cn("rounded-xl border border-border bg-card border-l-[3px] overflow-hidden", meta.borderClass)}>
        <div className="p-5 sm:p-6 space-y-5">
          {/* L1 — title + status whisper + DOMINANT score */}
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1 space-y-1.5">
              <button onClick={() => navigate("/strategy")} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                ← Strategy
              </button>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                <span className={cn("font-medium", meta.textClass)}>{meta.label}</span>
                <span className="text-border">·</span>
                <span className="capitalize">
                  {(campaign.primary_objective || campaign.goal || "").replace(/_/g, " ")}
                  {campaign.target_timeframe && ` · ${campaign.target_timeframe.replace(/_/g, " ")}`}
                </span>
                {campaign.target_priority === "high" && (
                  <>
                    <span className="text-border">·</span>
                    <span className="text-foreground font-medium">High priority</span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight leading-tight">
                {campaign.name}
              </h1>
            </div>

            <div className="flex items-start gap-4 shrink-0">
              {lifecycleMeta.showScore ? (
                <div className="text-right">
                  <div className={cn("flex items-end justify-end gap-1.5 text-4xl sm:text-5xl font-semibold leading-none tabular-nums", scoreColor(score.total))}>
                    <span>
                      {score.total.toFixed(1)}
                      <span className="text-base text-muted-foreground font-normal">/10</span>
                    </span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          aria-label="Why this score"
                          className="inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-[360px] p-0">
                        <ScoreBreakdownCard
                          score={score}
                          pillars={(() => {
                            const hints = buildPillarHints(score, scoreInputs);
                            return [
                              { label: "Positioning", value: score.positioning, weight: SCORE_WEIGHTS.positioning, hint: hints.positioning },
                              { label: "Execution", value: score.execution, weight: SCORE_WEIGHTS.execution, hint: hints.execution },
                              { label: "Conversion", value: score.conversion, weight: SCORE_WEIGHTS.conversion, hint: hints.conversion },
                            ];
                          })()}
                          className="border-0"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Strategy · <span className="text-foreground">{interp}</span>
                  </p>
                  {(() => {
                    // Identify the weakest pillar — that's where the score is bleeding from.
                    const pillars = [
                      { key: "Positioning", v: score.positioning },
                      { key: "Execution", v: score.execution },
                      { key: "Conversion", v: score.conversion },
                    ].sort((a, b) => a.v - b.v);
                    const weakest = pillars[0];
                    const lostPts = (10 - weakest.v).toFixed(0);
                    if (Number(lostPts) <= 1 || !diag.fixes[0]) return null;
                    return (
                      <p className="mt-1.5 text-[11px] text-foreground max-w-[200px] ml-auto leading-snug">
                        <span className="text-muted-foreground">Main issue:</span> {weakest.key} <span className="text-muted-foreground tabular-nums">(−{lostPts} pts)</span>
                        <br />
                        <span className="text-muted-foreground">Fix:</span> {diag.fixes[0]}
                      </p>
                    );
                  })()}
                </div>
              ) : (
                // Honest placeholder — no fake score before evidence exists.
                <div className="text-right max-w-[220px]">
                  <div className="flex items-end justify-end gap-1.5 text-4xl sm:text-5xl font-semibold leading-none tabular-nums text-muted-foreground/40">
                    <span>
                      {lifecycleMeta.scorePlaceholder}
                      <span className="text-base font-normal">/10</span>
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Status · <span className="text-foreground">{lifecycleMeta.label}</span>
                  </p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                    {lifecycleMeta.scorePlaceholderReason}
                  </p>
                </div>
              )}
              {/* Hero CTA — context-aware:
                  - No dates yet → Start Campaign (opens date dialog, then auto-generates plan)
                  - Dates set, no plan → Generate Plan (uses existing dates)
                  - Plan exists & started → Pause / Resume toggle */}
              {!campaign.target_start_date || !campaign.target_end_date ? (
                <Button size="sm" onClick={() => setStartDialogOpen(true)} disabled={generating}>
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Start Campaign
                </Button>
              ) : weekPlans.length === 0 ? (
                <Button size="sm" onClick={generatePlan} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  Generate Plan
                </Button>
              ) : campaign.started_at && (campaign.execution_status === "active" || campaign.execution_status === "paused") ? (
                <Button
                  size="sm"
                  variant={campaign.execution_status === "paused" ? "default" : "outline"}
                  onClick={togglePause}
                  disabled={togglingStatus}
                >
                  {togglingStatus ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : campaign.execution_status === "paused" ? (
                    <Play className="mr-1 h-3.5 w-3.5" />
                  ) : (
                    <Pause className="mr-1 h-3.5 w-3.5" />
                  )}
                  {campaign.execution_status === "paused" ? "Resume" : "Pause"}
                </Button>
              ) : null}
            </div>
          </div>

          {/* L2 — Strategy Hook (editorial, no tint) */}
          <div className="border-l-2 border-border pl-4">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">Strategy</p>
            <p className="mt-1 text-base sm:text-lg font-medium text-foreground leading-snug">
              {campaign.core_message || summary}
            </p>
            {campaign.core_message && weekPlans.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{summary}</p>
            )}
          </div>

          {/* Minimal goal progress strip — anchors the hero to the actual outcome.
              Hidden in setup: there's no goal context to anchor without a plan. */}
          {lifecycleMeta.showGoalProgress && campaign.target_quantity && campaign.target_metric && (
            <CampaignGoalProgressBar
              currentValue={goalAgg?.current_goal_value ?? campaign.current_goal_value ?? 0}
              target={campaign.target_quantity}
              goalMetric={campaign.target_metric}
              variant="compact"
            />
          )}

          {/* Urgency micro-line — only meaningful once we have a plan + posts to project from. */}
          {lifecycle === "learning" && showUrgency && (
            <div className="rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span className="text-foreground">
                At current pace you will <span className="font-semibold text-destructive">miss goal by {proj!.gap} {(campaign.target_metric || "").replace(/_/g, " ")}</span>
              </span>
              {velocityShort && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground">
                    <span className="text-destructive font-medium">{velocityShort}</span> posts/wk behind
                  </span>
                </>
              )}
              {shortfallPct !== null && shortfallPct > 0 && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground tabular-nums">{shortfallPct}% short</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SETUP empty state — onboarding guidance, no fake intelligence. */}
      {lifecycle === "setup" && (
        <div className="rounded-xl border border-border bg-card p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-foreground">This campaign hasn't started yet</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No plan or posts exist. We can't evaluate performance, score strategy, or recommend optimizations until your campaign begins.
            </p>
          </div>
          <div className="text-left max-w-md mx-auto bg-muted/30 border border-border rounded-md px-4 py-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Next step</p>
            <ol className="text-sm text-foreground space-y-1.5 leading-relaxed">
              <li><span className="text-muted-foreground tabular-nums mr-2">1.</span>Generate your weekly plan</li>
              <li><span className="text-muted-foreground tabular-nums mr-2">2.</span>Review and approve post structure</li>
              <li><span className="text-muted-foreground tabular-nums mr-2">3.</span>Publish your first post</li>
            </ol>
            <p className="text-[11px] text-muted-foreground pt-1">
              Once you publish 2–3 posts, we'll start analyzing patterns and recommending improvements.
            </p>
          </div>
          {!campaign.target_start_date || !campaign.target_end_date ? (
            <Button onClick={() => setStartDialogOpen(true)} disabled={generating} size="lg">
              <Play className="mr-2 h-4 w-4" />
              Start Campaign
            </Button>
          ) : (
            <Button onClick={generatePlan} disabled={generating} size="lg">
              {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Plan
            </Button>
          )}
        </div>
      )}

      {/* EVENT-TRIGGERED ADVISOR — silence by default.
          Renders ONE alert only when a hard rule fires (stagnation, behind pace,
          forecast risk, performance failure, or pattern detected). Otherwise the
          page stays clean. No always-on AI panel. */}
      {lifecycle !== "setup" && (() => {
        const alert = evaluateTriggers({
          campaign,
          postPlans: postPlans as any,
          signals: [],
          pacing,
          contributionRows: (goalAgg?.contribution_rows || []) as any,
          currentGoalValue: goalAgg?.current_goal_value ?? campaign.current_goal_value ?? 0,
        });
        if (!alert) return null;
        return (
          <CampaignAlertCard
            campaignId={id!}
            alert={alert}
            onAction={(action) => {
              if (action === "create_post") {
                navigate(`/create?campaign_id=${id}`);
              } else if (action === "view_plan") {
                setTab("plan");
                setTimeout(() => {
                  document.getElementById("plan-tab-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              } else if (action === "review_strategy") {
                setTab("plan");
                setTimeout(() => {
                  document.getElementById("strategy-versions")?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 100);
              } else if (action === "view_pattern") {
                setTab("performance");
              }
            }}
          />
        );
      })()}

      {/* TABS — Plan first (default), then Outcome (live performance), then deep analysis */}
      <section className="space-y-3">

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-border">
        {(["plan", "performance", "analytics", "report"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "analytics") {
                if (!analytics) fetchAnalytics();
                if (!goalAgg) fetchGoalAggregate();
              }
            }}
            className={cn(
              "relative -mb-px px-3 py-2 text-xs font-medium transition-colors capitalize border-b-2",
              tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "plan" && "📅 "}{t === "performance" && "🎯 "}{t === "analytics" && "📈 "}{t === "report" && "📄 "}
            {t}
          </button>
        ))}
      </div>

      {/* PERFORMANCE TAB — live results: directive + progress + projection + top performer + execution */}
      {tab === "performance" && (
        <div className="space-y-3">
          {/* DO THIS NEXT — adaptive directive (replication / volume / activation modes) */}
          {(() => {
            const rows = (goalAgg?.contribution_rows || []).filter((r: any) => (r.contribution || 0) > 0);
            const sorted = [...rows].sort((a, b) => b.contribution - a.contribution);
            const topRow = sorted[0];
            const totalContrib = rows.reduce((s, r: any) => s + (r.contribution || 0), 0);
            const topShare = topRow && totalContrib > 0 ? Math.round((topRow.contribution / totalContrib) * 100) : 0;
            const goalLabel = (campaign.target_metric || "results").replace(/_/g, " ");
            const shortBy = velocity && !velocity.onPace
              ? Math.max(1, Math.ceil(velocity.required - velocity.actual))
              : null;

            // Mode selection — order matters: dominant winner > behind on volume > activation
            type Mode = "replication" | "volume" | "activation";
            let mode: Mode;
            let postsToShip: number;
            if (topRow && topShare >= 50 && rows.length >= 2) {
              mode = "replication";
              postsToShip = Math.max(2, Math.min(5, shortBy ?? 3));
            } else if (shortBy) {
              mode = "volume";
              postsToShip = shortBy;
            } else {
              mode = "activation";
              postsToShip = Math.max(1, totalPosts > 0 ? Math.min(3, week1Remaining || 1) : 1);
            }

            const avgPerPost = topRow ? topRow.contribution : null;
            // Replication: top-performer rate. Volume: blended average. Activation: conservative seed.
            const expectedLow = mode === "replication" && avgPerPost
              ? Math.round(postsToShip * avgPerPost * 0.7)
              : mode === "volume" && rows.length > 0
                ? Math.round(postsToShip * (totalContrib / rows.length) * 0.6)
                : null;
            const expectedHigh = mode === "replication" && avgPerPost
              ? Math.round(postsToShip * avgPerPost * 1.2)
              : mode === "volume" && rows.length > 0
                ? Math.round(postsToShip * (totalContrib / rows.length) * 1.1)
                : null;

            const focusLabel = mode === "replication"
              ? "Replication"
              : mode === "volume" ? "Volume" : "Activation";
            const focusReason = mode === "replication"
              ? "highest impact"
              : mode === "volume" ? "behind schedule" : "kickstart";

            const directive = mode === "replication"
              ? `Publish ${postsToShip} ${postsToShip === 1 ? "post" : "posts"} replicating Post ${topRow.post_number}`
              : mode === "volume"
                ? `Publish ${postsToShip} ${postsToShip === 1 ? "post" : "posts"} this week`
                : `Publish your first ${postsToShip === 1 ? "post" : `${postsToShip} posts`} this week`;

            return (
              <div className="rounded-xl border border-foreground/15 bg-card p-5 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-foreground" />
                    <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-foreground">
                      Do this next
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Focus: <span className="text-foreground font-semibold">{focusLabel}</span>
                    <span className="text-border mx-1">·</span>
                    {focusReason}
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-semibold text-foreground leading-tight">
                  {directive}
                </p>

                {mode === "replication" && topRow && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground/80">Use Post {topRow.post_number}'s pattern:</p>
                    <ul className="space-y-0.5 pl-1">
                      <li>• Same hook angle</li>
                      <li>• Same CTA style</li>
                      <li>• Same structure / format</li>
                    </ul>
                  </div>
                )}
                {mode === "volume" && topRow && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground/80">Lead with what's working:</p>
                    <ul className="space-y-0.5 pl-1">
                      <li>• Match Post {topRow.post_number}'s hook ({topRow.contribution} {goalLabel})</li>
                      <li>• Keep CTA outcome-focused</li>
                    </ul>
                  </div>
                )}
                {mode === "activation" && (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground/80">Start measuring outcome signals:</p>
                    <ul className="space-y-0.5 pl-1">
                      <li>• Use a clear, single CTA</li>
                      <li>• Mark posts as posted to log contribution</li>
                    </ul>
                  </div>
                )}

                {expectedLow !== null && expectedHigh !== null && expectedHigh > 0 && (
                  <div className="pt-2 border-t border-border space-y-1">
                    <p className="text-xs text-foreground">
                      Expected impact: <span className="font-semibold tabular-nums">+{expectedLow}–{expectedHigh} {goalLabel}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Based on:{" "}
                      {mode === "replication"
                        ? `Post ${topRow!.post_number} contribution rate (${topRow!.contribution} ${goalLabel}/post · ${topShare}% of total)`
                        : `blended avg of ${rows.length} measured post${rows.length === 1 ? "" : "s"} (${(totalContrib / rows.length).toFixed(1)} ${goalLabel}/post)`}
                    </p>
                  </div>
                )}

                <Button
                  size="sm"
                  className="w-full justify-between"
                  onClick={() => navigate(`/create?campaign_id=${id}${topRow && (mode === "replication" || mode === "volume") ? `&clone_post=${topRow.post_number}` : ""}`)}
                >
                  {mode === "replication" && topRow
                    ? `Create ${postsToShip} ${postsToShip === 1 ? "post" : "posts"} using this pattern`
                    : "Create the next post"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })()}

          {campaign.target_quantity && campaign.target_metric && (() => {
            const cur = goalAgg?.current_goal_value ?? campaign.current_goal_value ?? 0;
            const tgt = campaign.target_quantity;
            const metricLabel = goalMetricLabel(campaign.target_metric);
            const { pct, barPct, status, remaining, overTarget } = formatGoalProgress(cur, tgt);
            const isAchieved = status === "achieved" || status === "overachieved";
            const barClass = isAchieved ? "bg-emerald-500" : status === "not_started" ? "bg-muted-foreground/40" : "bg-primary";
            const accentText = isAchieved ? "text-emerald-600 dark:text-emerald-400" : status === "not_started" ? "text-muted-foreground" : "text-foreground";
            const statusBadge = status === "not_started"
              ? "Not started"
              : status === "achieved"
                ? "Goal achieved"
                : status === "overachieved"
                  ? `+${overTarget} over target`
                  : `${remaining} remaining`;

            return (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                {/* Hero — outcome at a glance. Big number, single bar. No nested chrome. */}
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-muted-foreground" />
                      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">
                        Campaign Goal
                      </p>
                    </div>
                    <span className={cn("text-[11px] font-medium tabular-nums", accentText)}>
                      {tgt ? `${pct}%` : "—"} · {statusBadge}
                    </span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-semibold tabular-nums text-foreground leading-none">
                      {cur}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {tgt} {metricLabel}
                    </span>
                  </div>
                  <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full transition-all", barClass)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>

                {/* Projection — embedded, uses its own header as the section divider */}
                <CampaignProjectionCard
                  startedAt={startedRef}
                  targetEndAt={endsRef}
                  currentValue={cur}
                  target={tgt}
                  goalMetric={campaign.target_metric}
                  contributionRows={goalAgg?.contribution_rows || []}
                  embedded
                  className="border-t border-border"
                />
              </div>
            );
          })()}

          {/* Raw Performance — platform-native totals (operator view).
              Interpretation, conversion insight & winning patterns live in the Analytics tab. */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-foreground">Raw Performance</p>
              </div>
              <span className="text-[10px] text-muted-foreground">Platform-native · LinkedIn signals</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border border border-border rounded-md overflow-hidden">
              <RawTotal icon={Eye} label="Impressions" value={goalAgg?.raw_totals?.impressions ?? 0} />
              <RawTotal icon={ThumbsUp} label="Reactions" value={goalAgg?.raw_totals?.reactions ?? 0} />
              <RawTotal icon={MessageSquare} label="Comments" value={goalAgg?.raw_totals?.comments ?? 0} />
              <RawTotal icon={MousePointer} label="Clicks" value={goalAgg?.raw_totals?.clicks ?? 0} />
            </div>
          </div>

          <ExecutionDashboard
            campaignId={id!}
            campaign={campaign}
            postPlans={postPlans as any}
            weekCount={weekPlans.length}
            contributionRows={goalAgg?.contribution_rows || []}
            onChange={fetchAll}
          />
        </div>
      )}


      {/* PLAN TAB — narrative phases */}
      {tab === "plan" && (
        <div className="space-y-3">
          {weekPlans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No plan generated yet. Click "Generate Plan" to create a week-by-week roadmap.</p>
            </div>
          ) : (
            <>
              <div className="rounded-md bg-muted/30 border border-border p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3" /> Strategy Flow
                </p>
                <p className="mt-1 text-xs text-foreground">
                  Each phase advances the audience from problem awareness → conversion. Click a phase to see the posts inside.
                </p>
              </div>

              <div className="space-y-2">
                {weekPlans.map((week: any, idx: number) => {
                  const weekPosts = postPlans.filter((p: any) => p.week_number === week.week_number);
                  const isExpanded = expandedWeek === week.week_number;
                  const phase = weekPhaseLabel(week.week_number, weekPlans.length);
                  const drafted = weekPosts.filter((p: any) => p.status !== "planned").length;
                  const isLast = idx === weekPlans.length - 1;
                  // Performance funnel — bookings contributed by this week's posts
                  const weekBookings = (goalAgg?.contribution_rows || [])
                    .filter((r: any) => weekPosts.some((wp: any) => wp.post_number === r.post_number))
                    .reduce((s: number, r: any) => s + (r.contribution || 0), 0);
                  const weekGoalLabel = (goalAgg?.goal_metric || campaign.target_metric || "").replace(/_/g, " ");

                  return (
                    <div key={week.id}>
                      <div className="rounded-lg border border-border bg-card border-l-4 border-l-primary/40 overflow-hidden">
                        <button
                          onClick={() => setExpandedWeek(isExpanded ? null : week.week_number)}
                          className="flex w-full items-center justify-between p-4 text-left gap-3"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                              {week.week_number}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">{phase}</span>
                                <span className="text-[10px] text-muted-foreground">Week {week.week_number}</span>
                              </div>
                              <p className="mt-0.5 text-sm font-medium text-foreground">{week.weekly_goal || week.week_purpose}</p>
                              {week.primary_message && (
                                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{week.primary_message}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="block text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                                Posts {drafted}<span className="text-border">/</span>{weekPosts.length}
                              </span>
                              {weekBookings > 0 && weekGoalLabel && (
                                <span className="block text-[11px] text-foreground tabular-nums whitespace-nowrap">
                                  {weekBookings} {weekGoalLabel}
                                </span>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                            {week.cta_strategy && (
                              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">CTA:</span> {week.cta_strategy}</p>
                            )}
                            {(() => {
                              // Build leaderboard rank lookup so each card can show "Top / Mid / Low performer"
                              const allRows = (goalAgg?.contribution_rows || []) as any[];
                              const totalC = allRows.reduce((s, r) => s + (r.contribution || 0), 0);
                              const sorted = [...allRows].filter((r) => (r.contribution || 0) > 0).sort((a, b) => b.contribution - a.contribution);
                              const rankByPostNumber = new Map<number, { rank: number; total: number; contribution: number; share: number }>();
                              sorted.forEach((r, i) => rankByPostNumber.set(r.post_number, {
                                rank: i + 1,
                                total: sorted.length,
                                contribution: r.contribution,
                                share: totalC > 0 ? Math.round((r.contribution / totalC) * 100) : 0,
                              }));
                              return weekPosts.map((post: any) => (
                                <div key={post.id} id={`post-plan-${post.id}`} className="scroll-mt-24">
                                  <CampaignPostCard
                                    post={post}
                                    campaignId={id!}
                                    onChange={fetchAll}
                                    performanceRank={rankByPostNumber.get(post.post_number)}
                                    goalLabel={(goalAgg?.goal_metric || campaign.target_metric || "").replace(/_/g, " ")}
                                  />
                                </div>
                              ));
                            })()}
                            {weekPosts.length - drafted > 0 && (
                              <button
                                onClick={() => navigate(`/create?campaign_id=${id}`)}
                                className="group/p w-full flex items-center justify-between gap-3 rounded-md bg-card border border-border px-3 py-2.5 text-left hover:bg-muted/40 transition-colors"
                              >
                                <span className="text-xs text-foreground font-medium">
                                  Generate {weekPosts.length - drafted} post{weekPosts.length - drafted > 1 ? "s" : ""} for this phase
                                </span>
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover/p:text-foreground group-hover/p:translate-x-0.5 transition-all" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Connector arrow between phases */}
                      {!isLast && (
                        <div className="flex justify-center py-1">
                          <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* STRATEGY VERSIONS — v1 → v2 → v3 history with revise CTA */}
              <div id="strategy-versions" className="pt-2">
                <StrategyVersionsCard
                  campaignId={id!}
                  hasPlan={weekPlans.length > 0}
                  onRevised={() => { fetchAll(); refreshBrain(); }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ANALYTICS TAB — Goal-Aware Performance System */}
      {tab === "analytics" && (
        <div className="space-y-5">
          {(loadingAnalytics || loadingGoalAgg) && !goalAgg ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* SECTION 1 — What's Driving Results
                  Combines top contributors + conversion rate + winning pattern into a single narrative.
                  Raw platform metrics (impressions/reactions/comments/clicks) live in the Performance tab. */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-foreground" />
                    <p className="text-xs font-semibold text-foreground">What's driving results</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Top contributors · conversion · winning pattern</span>
                </div>

                {/* Top contributors — which posts moved the goal */}
                <TopContributorsStrip
                  rows={goalAgg?.contribution_rows || []}
                  goalMetric={goalAgg?.goal_metric}
                />

                {/* Conversion insight — clicks → goal interpretation with benchmark */}
                <RawToGoalInsight
                  clicks={goalAgg?.raw_totals?.clicks ?? 0}
                  impressions={goalAgg?.raw_totals?.impressions ?? 0}
                  postsContribution={goalAgg?.posts_contribution ?? 0}
                  goalMetric={goalAgg?.goal_metric}
                />

                {/* Winning pattern — top performer's hook/CTA/format fingerprint */}
                {goalAgg?.contribution_rows?.length > 0 && (
                  <TopPerformerCard
                    rows={goalAgg.contribution_rows}
                    goalMetric={goalAgg.goal_metric || campaign.target_metric}
                    campaignId={id!}
                  />
                )}
              </div>

              {/* SECTION 2 — Post Goal Contribution (ROI ranking) */}
              {goalAgg && (
                <PostContributionTable
                  rows={goalAgg.contribution_rows || []}
                  goalMetric={goalAgg.goal_metric}
                  target={goalAgg.target}
                />
              )}

              {/* SECTION 3 — Campaign Progress (auto-rolled from posts + external) */}
              {goalAgg && (
                <CampaignGoalProgressCard
                  campaignId={id!}
                  goalMetric={goalAgg.goal_metric}
                  target={goalAgg.target}
                  postsContribution={goalAgg.posts_contribution || 0}
                  unattributed={goalAgg.unattributed || 0}
                  currentGoalValue={goalAgg.current_goal_value || 0}
                  onSaved={() => { fetchGoalAggregate(); fetchAll(); }}
                />
              )}

              {/* SECTION 4 — AI Insight (goal-aware recommendations) */}
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">AI Insight · Goal-Aware</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={generateGoalInsights} disabled={generatingInsights}>
                    {generatingInsights ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                    {interpretation ? "Regenerate" : "Generate insights"}
                  </Button>
                </div>

                {!interpretation ? (
                  <p className="text-xs text-muted-foreground italic">
                    Click <span className="font-medium text-foreground">Generate insights</span> to surface what's actually driving your goal — beyond likes and impressions.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {/* Confidence label — prevents blind trust */}
                    {(() => {
                      const measuredPosts = (goalAgg?.contribution_rows || []).filter((r: any) => (r.contribution || 0) > 0).length;
                      const conf = measuredPosts >= 5
                        ? { label: "High", tone: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" }
                        : measuredPosts >= 3
                          ? { label: "Medium", tone: "text-yellow-600 dark:text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" }
                          : { label: "Low", tone: "text-destructive", bg: "bg-destructive/10 border-destructive/30" };
                      return (
                        <div className={cn("rounded-md border px-2.5 py-1.5 flex items-center gap-2 text-[11px]", conf.bg)}>
                          <ShieldCheck className={cn("h-3 w-3", conf.tone)} />
                          <span className={cn("font-semibold", conf.tone)}>Confidence: {conf.label}</span>
                          <span className="text-muted-foreground">based on {measuredPosts} measured {measuredPosts === 1 ? "post" : "posts"}</span>
                        </div>
                      );
                    })()}

                    {interpretation.headline && (
                      <p className="text-sm font-medium text-foreground border-l-2 border-primary pl-3">
                        {interpretation.headline}
                      </p>
                    )}

                    {interpretation.key_patterns?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Key patterns</p>
                        <ul className="mt-1 space-y-1">
                          {interpretation.key_patterns.map((p: string, i: number) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground">
                              <ArrowRight className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                              <span>{p}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {interpretation.high_intent_signals?.length > 0 && (
                      <div className="rounded-md bg-muted/30 p-3">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> High-intent signals
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {interpretation.high_intent_signals.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-foreground">· {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {interpretation.vanity_traps?.length > 0 && (
                      <div className="rounded-md bg-muted/30 p-3">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Vanity traps
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {interpretation.vanity_traps.map((s: string, i: number) => (
                            <li key={i} className="text-xs text-foreground">· {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {interpretation.recommendations?.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Recommendations · ranked by impact</p>
                        {interpretation.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="rounded-md border border-border p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-bold w-5 h-5 flex items-center justify-center tabular-nums">
                                #{i + 1}
                              </span>
                              <p className="text-sm font-semibold text-foreground leading-snug">{rec.title}</p>
                            </div>
                            {rec.why && (
                              <div className="pl-7 space-y-1">
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-destructive flex items-center gap-1">
                                  <AlertTriangle className="h-2.5 w-2.5" /> Problem
                                </p>
                                <p className="text-xs text-foreground">{rec.why}</p>
                              </div>
                            )}
                            {rec.action && (
                              <div className="pl-7 space-y-1">
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-primary flex items-center gap-1">
                                  <ArrowRight className="h-2.5 w-2.5" /> Action
                                </p>
                                <p className="text-xs text-foreground font-medium">{rec.action}</p>
                              </div>
                            )}
                            {rec.expected && (
                              <div className="pl-7 space-y-1">
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <TrendingUp className="h-2.5 w-2.5" /> Expected
                                </p>
                                <p className="text-xs text-foreground">{rec.expected}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Legacy progress recommendations (engagement / cadence) — kept compact under goal layer */}
              {analytics?.recommendations && analytics.recommendations.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Cadence & execution alerts</p>
                  {analytics.recommendations.map((rec: any, i: number) => {
                    const isUrgent = rec.type === "urgent" || rec.type === "critical";
                    const accent = isUrgent
                      ? { border: "border-l-destructive", text: "text-destructive", icon: AlertCircle }
                      : { border: "border-l-yellow-500", text: "text-yellow-600", icon: AlertTriangle };
                    const Icon = accent.icon;
                    return (
                      <div key={i} className={cn("rounded-md border border-border bg-card border-l-4 p-3", accent.border)}>
                        <div className="flex items-start gap-2">
                          <Icon className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", accent.text)} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground">{rec.title}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{rec.description}</p>
                            {rec.action && (
                              <Button size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={() => navigate(`/create?campaign_id=${id}`)}>
                                {rec.action} <ArrowRight className="h-3 w-3 ml-1" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => { fetchAnalytics(); fetchGoalAggregate(); }}>
                  <TrendingUp className="mr-1 h-3.5 w-3.5" /> Refresh
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* REPORT TAB — strategic debrief */}
      {tab === "report" && (
        <div className="space-y-4">
          {!report ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Generate a post-campaign intelligence report.</p>
              <Button size="sm" className="mt-3" onClick={generateReport} disabled={loadingReport}>
                {loadingReport ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                Generate Report
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Outcome verdict */}
              {report.summary && (() => {
                const status = report.summary.status;
                const accent = status === "success"
                  ? { border: "border-l-green-500", text: "text-green-600", bg: "bg-green-500/5", emoji: "🟢", label: "Succeeded" }
                  : status === "partial_success"
                  ? { border: "border-l-yellow-500", text: "text-yellow-600", bg: "bg-yellow-500/5", emoji: "🟡", label: "Partial Win" }
                  : { border: "border-l-destructive", text: "text-destructive", bg: "bg-destructive/5", emoji: "🔴", label: "Missed Target" };
                return (
                  <div className={cn("rounded-lg border border-border bg-card border-l-4 p-4 space-y-2", accent.border)}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{accent.emoji}</span>
                      <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Outcome</p>
                      <span className={cn("text-sm font-bold", accent.text)}>{accent.label}</span>
                    </div>
                    <p className="text-sm text-foreground">{report.summary.overall_assessment}</p>
                  </div>
                );
              })()}

              {/* What worked / What failed — side-by-side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {report.content_learnings?.best_hook_types?.length > 0 && (
                  <div className="rounded-lg border border-border bg-card border-l-4 border-l-green-500 p-4 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <p className="text-xs font-semibold text-foreground">What Worked</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Best hooks</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.content_learnings.best_hook_types.map((h: string) => (
                          <span key={h} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-700">✔ {h}</span>
                        ))}
                      </div>
                    </div>
                    {report.content_learnings.best_styles?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground">Best styles</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {report.content_learnings.best_styles.map((s: string) => (
                            <span key={s} className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-700">✔ {s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {report.content_learnings?.weakest_areas?.length > 0 && (
                  <div className="rounded-lg border border-border bg-card border-l-4 border-l-destructive p-4 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <XCircle className="h-4 w-4 text-destructive" />
                      <p className="text-xs font-semibold text-foreground">What Failed</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {report.content_learnings.weakest_areas.map((w: string) => (
                        <span key={w} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">✘ {w}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Next move */}
              {report.strategic_recommendations && report.strategic_recommendations.length > 0 && (
                <div className="rounded-lg border border-border bg-card border-l-4 border-l-primary p-4 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-foreground">Next Move</p>
                  </div>
                  {report.strategic_recommendations.map((rec: any, i: number) => (
                    <div key={i} className="text-xs space-y-0.5 border-l-2 border-primary/30 pl-3">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{rec.action}</Badge>
                        <span className="text-foreground font-medium">{rec.recommendation}</span>
                      </div>
                      <p className="text-muted-foreground">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Suggested next campaign */}
              {report.suggested_next_campaign && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
                  <p className="text-[10px] uppercase tracking-wide font-semibold text-primary">🚀 Suggested Next Campaign</p>
                  <p className="text-sm font-medium text-foreground">{report.suggested_next_campaign.theme}</p>
                  <p className="text-xs text-muted-foreground">{report.suggested_next_campaign.rationale}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </section>

      {/* Date capture dialog — required before plan generation. */}
      <StartCampaignDialog
        open={startDialogOpen}
        onOpenChange={setStartDialogOpen}
        campaignId={id!}
        campaign={campaign}
        onStarted={() => {
          // Refresh the campaign row so date guards pass, then auto-generate plan.
          fetchAll().then(() => generatePlan());
        }}
      />
    </div>
  );
};

const RawTotal = ({ icon: Icon, label, value }: { icon: any; label: string; value: number }) => (
  <div className="px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon className="h-3 w-3" />
      <p className="text-[10px] uppercase tracking-[0.1em]">{label}</p>
    </div>
    <p className="mt-0.5 text-base font-semibold text-foreground tabular-nums">
      {value.toLocaleString()}
    </p>
  </div>
);

export default CampaignPlanPage;
