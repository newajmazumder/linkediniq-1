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
  CheckCircle2, XCircle, ArrowRight, Zap, Flame, AlertCircle, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignPostCard from "@/components/campaign/CampaignPostCard";
import {
  computeCampaignState, STATE_META, computeStrategyScore, scoreColor, weekPhaseLabel,
  diagnoseScore, primaryAction as buildPrimaryAction, buildNarrativeSummary,
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
  const [report, setReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (user && id) fetchAll();
  }, [user, id]);

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

  const sevAccent =
    diag.severity === "critical" ? { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", icon: AlertCircle, prefix: "🚨 CRITICAL" }
    : diag.severity === "warning" ? { bg: "bg-yellow-500/10", text: "text-yellow-600", border: "border-yellow-500/30", icon: AlertTriangle, prefix: "⚠️ WARNING" }
    : diag.severity === "good" ? { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/30", icon: Zap, prefix: "✓ GOOD" }
    : { bg: "bg-green-500/15", text: "text-green-700", border: "border-green-500/40", icon: Zap, prefix: "🚀 EXCELLENT" };
  const SevIcon = sevAccent.icon;

  return (
    <div className="content-fade-in space-y-5 px-4 sm:px-6 py-4">
      {/* HERO — verdict-first header */}
      <div className={cn("rounded-xl border-2 border-border bg-card border-l-[6px] overflow-hidden shadow-sm", meta.borderClass)}>
        {/* PRIMARY ACTION BANNER */}
        {action.urgent && (
          <button
            onClick={() => navigate(action.href)}
            className={cn(
              "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
              state === "off_track" || state === "at_risk"
                ? "bg-destructive/10 hover:bg-destructive/15 text-destructive"
                : "bg-primary/10 hover:bg-primary/15 text-primary",
            )}
          >
            <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
              <Flame className="h-3.5 w-3.5" />
              Do this now: <span className="font-semibold normal-case tracking-normal">{action.label}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0" />
          </button>
        )}

        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <button onClick={() => navigate("/strategy")} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                ← Strategy
              </button>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", meta.bgClass, meta.textClass)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                  {meta.label}
                </span>
                {campaign.target_priority === "high" && (
                  <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                    <Flame className="mr-0.5 h-2.5 w-2.5" /> High priority
                  </Badge>
                )}
              </div>
              <h1 className="mt-1.5 text-xl sm:text-2xl font-bold text-foreground leading-tight">{campaign.name}</h1>
              <p className="mt-1 text-xs text-muted-foreground capitalize">
                {(campaign.primary_objective || campaign.goal || "").replace("_", " ")}
                {campaign.target_timeframe && ` · ${campaign.target_timeframe.replace("_", " ")}`}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className={cn("rounded-lg border-2 px-3 py-2 text-center", sevAccent.border, sevAccent.bg)}>
                <div className={cn("text-3xl font-black leading-none", scoreColor(score.total))}>
                  {score.total.toFixed(1)}
                </div>
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
                  Strategy /10
                </div>
              </div>
              {weekPlans.length === 0 && (
                <Button size="sm" onClick={generatePlan} disabled={generating}>
                  {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
                  Generate Plan
                </Button>
              )}
            </div>
          </div>

          {/* HERO Strategy Hook — campaign brain */}
          <div className={cn("rounded-lg border-l-4 p-3 sm:p-4", meta.borderClass, meta.bgClass)}>
            <p className={cn("text-[10px] font-bold uppercase tracking-wider", meta.textClass)}>
              💡 Strategy hook
            </p>
            <p className="mt-1 text-base sm:text-lg font-semibold text-foreground leading-snug">
              {campaign.core_message || summary}
            </p>
            {campaign.core_message && weekPlans.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground italic">{summary}</p>
            )}
          </div>

          {/* Score diagnostic */}
          {(diag.why.length > 0 || diag.severity === "critical" || diag.severity === "warning") && (
            <div className={cn("rounded-md border p-3 space-y-2", sevAccent.border, sevAccent.bg)}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <SevIcon className={cn("h-3.5 w-3.5", sevAccent.text)} />
                <span className={cn("text-[11px] font-bold uppercase tracking-wide", sevAccent.text)}>{sevAccent.prefix}</span>
                <span className="text-xs text-foreground">{diag.verdict}</span>
              </div>
              {diag.why.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Why low</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {diag.why.slice(0, 4).map((w) => (
                        <li key={w} className="text-[11px] text-foreground flex gap-1"><span className="text-destructive">×</span>{w}</li>
                      ))}
                    </ul>
                  </div>
                  {diag.fixes.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Wrench className="h-2.5 w-2.5" /> Fix</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {diag.fixes.slice(0, 4).map((f) => (
                          <li key={f} className="text-[11px] text-foreground flex gap-1"><span className="text-green-600">→</span>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECONDARY — Goal + Execution + Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="rounded-md bg-muted/50 p-2.5">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">🎯 Goal</p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {campaign.target_quantity && campaign.target_metric
                  ? `${campaign.target_quantity} ${campaign.target_metric.replace("_", " ")}`
                  : "No measurable target"}
              </p>
              {outcomePct !== null && (
                <div className="mt-1.5 space-y-0.5">
                  <Progress value={outcomePct} className="h-1" />
                  <p className="text-[10px] text-muted-foreground">{outcomePct}% complete</p>
                </div>
              )}
            </div>
            <div className="rounded-md bg-muted/50 p-2.5">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">⚙️ Execution</p>
              {totalPosts > 0 ? (
                <>
                  <p className="mt-0.5 text-sm font-semibold text-foreground">{draftedPosts}/{totalPosts} posts</p>
                  <div className="mt-1.5 space-y-0.5">
                    <Progress value={postingPct ?? 0} className="h-1" />
                    <p className={cn("text-[10px] font-medium", (postingPct ?? 0) < 30 ? "text-destructive" : (postingPct ?? 0) >= 70 ? "text-green-600" : "text-yellow-600")}>
                      {(postingPct ?? 0) < 30 ? "Behind schedule" : (postingPct ?? 0) >= 70 ? "On cadence" : "Catching up"}
                    </p>
                  </div>
                </>
              ) : (
                <p className="mt-0.5 text-sm text-muted-foreground">No posts planned</p>
              )}
            </div>
            <div className="rounded-md bg-muted/50 p-2.5">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">📊 Score Breakdown</p>
              <div className="mt-1 space-y-0.5 text-[11px]">
                <div className="flex justify-between"><span className="text-muted-foreground">Positioning</span><span className="text-foreground font-semibold">{score.positioning}/10</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Execution</span><span className="text-foreground font-semibold">{score.execution}/10</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conversion</span><span className="text-foreground font-semibold">{score.conversion}/10</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 border-b border-border">
        {(["plan", "analytics", "report"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "analytics" && !analytics) fetchAnalytics();
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
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{drafted}/{weekPosts.length}</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/20">
                            {week.cta_strategy && (
                              <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">CTA:</span> {week.cta_strategy}</p>
                            )}
                            {weekPosts.map((post: any) => (
                              <CampaignPostCard key={post.id} post={post} campaignId={id!} />
                            ))}
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

      {/* ANALYTICS TAB — Problem → Impact → Action */}
      {tab === "analytics" && (
        <div className="space-y-4">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : !analytics ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Loading analytics...</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={fetchAnalytics}>Refresh</Button>
            </div>
          ) : (
            <>
              {/* Headline */}
              <div className={cn("rounded-lg border border-border bg-card border-l-4 p-4", meta.borderClass)}>
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.bgClass, meta.textClass)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                    {meta.label}
                  </span>
                  <span className="text-xs text-muted-foreground">Live campaign health</span>
                </div>
                {analytics.outcome_progress && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Outcome</span>
                      <span className="text-foreground font-medium">{analytics.outcome_progress.current_value}/{analytics.outcome_progress.target_quantity || "?"}</span>
                    </div>
                    <Progress value={analytics.outcome_progress.progress_pct || 0} className="h-2" />
                  </div>
                )}
                {analytics.posting_progress && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Posting cadence</span>
                      <span className="text-foreground font-medium">{analytics.posting_progress.drafted}/{analytics.posting_progress.total_planned}</span>
                    </div>
                    <Progress value={analytics.posting_progress.cadence_adherence || 0} className="h-2" />
                  </div>
                )}
              </div>

              {/* Decision blocks */}
              {analytics.recommendations && analytics.recommendations.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">What to do next</h3>
                  {analytics.recommendations.map((rec: any, i: number) => {
                    const isUrgent = rec.type === "urgent" || rec.type === "critical";
                    const accent = isUrgent
                      ? { border: "border-l-destructive", bg: "bg-destructive/5", text: "text-destructive", icon: AlertCircle }
                      : { border: "border-l-yellow-500", bg: "bg-yellow-500/5", text: "text-yellow-600", icon: AlertTriangle };
                    const Icon = accent.icon;
                    return (
                      <div key={i} className={cn("rounded-lg border border-border bg-card border-l-4 overflow-hidden", accent.border)}>
                        <div className="p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", accent.text)} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">🚨 Problem</p>
                              <p className="text-sm font-medium text-foreground mt-0.5">{rec.title}</p>
                            </div>
                          </div>
                          <div className="pl-6 space-y-2">
                            <div>
                              <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">📉 Impact</p>
                              <p className="text-xs text-foreground mt-0.5">{rec.description}</p>
                            </div>
                            {rec.action && (
                              <div>
                                <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">✅ Action</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Button size="sm" onClick={() => navigate(`/create?campaign_id=${id}`)} className="gap-1">
                                    {rec.action} <ArrowRight className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button size="sm" variant="outline" onClick={fetchAnalytics}>
                <TrendingUp className="mr-1 h-3.5 w-3.5" /> Refresh Analytics
              </Button>
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

export default CampaignPlanPage;
