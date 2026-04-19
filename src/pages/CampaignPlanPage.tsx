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
  CheckCircle2, XCircle, ArrowRight, Zap, Flame, AlertCircle, Wrench, Eye, ThumbsUp, MessageSquare, MousePointer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignPostCard from "@/components/campaign/CampaignPostCard";
import ExecutionDashboard from "@/components/strategy/ExecutionDashboard";
import CampaignGoalProgressCard from "@/components/campaign/CampaignGoalProgressCard";
import CampaignGoalProgressBar from "@/components/campaign/CampaignGoalProgressBar";
import PostContributionTable from "@/components/campaign/PostContributionTable";
import { goalUpdatedEvent } from "@/lib/goal-metrics";
import {
  computeCampaignState, STATE_META, computeStrategyScore, scoreColor, weekPhaseLabel,
  diagnoseScore, primaryAction as buildPrimaryAction, buildNarrativeSummary,
  scoreInterpretation, computeVelocity,
} from "@/lib/strategy";

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
  const [tab, setTab] = useState<"plan" | "analytics" | "report">("plan");
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [goalAgg, setGoalAgg] = useState<any>(null);
  const [loadingGoalAgg, setLoadingGoalAgg] = useState(false);
  const [interpretation, setInterpretation] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (user && id) {
      fetchAll();
      // Always pull live goal aggregate so the hero progress bar reflects
      // post contributions immediately (not just when the analytics tab opens).
      fetchGoalAggregate();
    }
  }, [user, id]);

  // Live refresh when post contribution changes elsewhere
  useEffect(() => {
    if (!id) return;
    const handler = () => {
      fetchAll();
      fetchGoalAggregate();
    };
    window.addEventListener(goalUpdatedEvent(id), handler);
    return () => window.removeEventListener(goalUpdatedEvent(id), handler);
  }, [id]);

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
    } catch (err: any) {
      toast.error(err.message || "Failed to generate plan");
    } finally {
      setGenerating(false);
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
  const postingPct = totalPosts > 0 ? Math.round((draftedPosts / totalPosts) * 100) : null;
  const week1Remaining = postPlans.filter((p: any) => p.week_number === 1 && (!p.status || p.status === "planned")).length;

  const outcomePct = analytics?.outcome_progress?.progress_pct ?? null;

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
              <div className="text-right">
                <div className={cn("text-4xl sm:text-5xl font-semibold leading-none tabular-nums", scoreColor(score.total))}>
                  {score.total.toFixed(1)}
                  <span className="text-base text-muted-foreground font-normal">/10</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Strategy · <span className="text-foreground">{interp}</span>
                </p>
              </div>
              {weekPlans.length === 0 && (
                <Button size="sm" onClick={generatePlan} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  Generate Plan
                </Button>
              )}
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

          {/* L2 — Single quiet action row, only when there's a real problem */}
          {isUrgent && (
            <button
              onClick={() => navigate(action.href)}
              className="group/act w-full flex items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                  Why · {diag.why[0] || "Strategy gap"}
                </p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{action.label}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover/act:text-foreground group-hover/act:translate-x-0.5 transition-all" />
            </button>
          )}

          {/* L3 — Goal · Execution · Velocity */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border-y border-border">
            <div className="px-4 py-3 first:pl-0">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Goal</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {campaign.target_quantity && campaign.target_metric
                  ? `${campaign.target_quantity} ${campaign.target_metric.replace(/_/g, " ")}`
                  : <span className="text-muted-foreground font-normal">Not set</span>}
              </p>
              {outcomePct !== null && (
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{outcomePct}% complete</p>
              )}
            </div>
            <div className="px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Execution</p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {totalPosts > 0 ? `${draftedPosts}/${totalPosts} posts` : <span className="text-muted-foreground font-normal">No plan</span>}
              </p>
              {totalPosts > 0 && (
                <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{postingPct ?? 0}% drafted</p>
              )}
            </div>
            <div className="px-4 py-3 last:pr-0">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Velocity</p>
              {velocity ? (
                <>
                  <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                    {velocity.actual} <span className="text-muted-foreground font-normal">/ {velocity.required} per wk</span>
                  </p>
                  <p className={cn("mt-0.5 text-[11px]", velocity.onPace ? "text-muted-foreground" : meta.textClass)}>
                    {velocity.onPace ? "On pace" : `${(velocity.required - velocity.actual).toFixed(1)} short / week`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground font-normal">—</p>
              )}
            </div>
          </div>

          {/* L4 — Score breakdown (quiet inline, no tint) */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
            <span>Positioning <span className="text-foreground font-medium tabular-nums">{score.positioning}/10</span></span>
            <span className="text-border">·</span>
            <span>Execution <span className="text-foreground font-medium tabular-nums">{score.execution}/10</span></span>
            <span className="text-border">·</span>
            <span>Conversion <span className="text-foreground font-medium tabular-nums">{score.conversion}/10</span></span>
          </div>
        </div>
      </div>

      {/* Goal Progress Bar — primary proof the campaign is working */}
      {campaign.target_quantity && campaign.target_metric && (
        <CampaignGoalProgressBar
          currentValue={goalAgg?.current_goal_value ?? campaign.current_goal_value ?? 0}
          target={campaign.target_quantity}
          goalMetric={campaign.target_metric}
          variant="full"
        />
      )}

      {/* Closed-loop execution dashboard */}
      <ExecutionDashboard
        campaignId={id!}
        campaign={campaign}
        postPlans={postPlans as any}
        weekCount={weekPlans.length}
        onChange={fetchAll}
      />

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-border">
        {(["plan", "analytics", "report"] as const).map((t) => (
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
            {t === "plan" && "📅 "}{t === "analytics" && "📈 "}{t === "report" && "📄 "}
            {t}
          </button>
        ))}
      </div>

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
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                              {drafted}<span className="text-border">/</span>{weekPosts.length}
                            </span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border px-4 py-3 space-y-3 bg-muted/20">
                            {week.cta_strategy && (
                              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">CTA:</span> {week.cta_strategy}</p>
                            )}
                            {weekPosts.map((post: any) => (
                              <CampaignPostCard key={post.id} post={post} campaignId={id!} onChange={fetchAll} />
                            ))}
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
              {/* SECTION 1 — Raw Performance (platform-native, locked) */}
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
                        <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Recommendations</p>
                        {interpretation.recommendations.map((rec: any, i: number) => (
                          <div key={i} className="rounded-md border border-border p-3">
                            <p className="text-sm font-medium text-foreground">{rec.title}</p>
                            {rec.why && <p className="mt-0.5 text-xs text-muted-foreground">{rec.why}</p>}
                            {rec.action && (
                              <p className="mt-1 text-xs text-foreground">
                                <span className="font-semibold">Do:</span> {rec.action}
                              </p>
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
