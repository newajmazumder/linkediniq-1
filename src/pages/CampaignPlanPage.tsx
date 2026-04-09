import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, Target, ChevronDown, ChevronUp, PenLine, Check, Clock,
  BarChart3, FileText, Sparkles, ArrowRight, AlertTriangle, TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignPostCard from "@/components/campaign/CampaignPostCard";

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
  const [expandedWeek, setExpandedWeek] = useState<number | null>(1);
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
  const progressPct = totalPosts > 0 ? Math.round((draftedPosts / totalPosts) * 100) : 0;

  const healthColor = analytics?.health_status === "on_track" ? "text-green-600" :
    analytics?.health_status === "at_risk" ? "text-yellow-600" : "text-destructive";

  return (
    <div className="content-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{campaign.name}</h1>
            <Badge variant="outline" className="capitalize text-[10px]">{campaign.primary_objective || campaign.goal}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {campaign.target_quantity && campaign.target_metric
              ? `Target: ${campaign.target_quantity} ${campaign.target_metric.replace("_", " ")}`
              : "No measurable target set"}
            {campaign.target_timeframe && ` · ${campaign.target_timeframe.replace("_", " ")}`}
          </p>
        </div>
        <div className="flex gap-2">
          {weekPlans.length === 0 && (
            <Button size="sm" onClick={generatePlan} disabled={generating}>
              {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
              Generate Plan
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {totalPosts > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-foreground">Campaign Progress</span>
            <span className="text-xs text-muted-foreground">{draftedPosts}/{totalPosts} posts</span>
          </div>
          <Progress value={progressPct} className="h-2" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["plan", "analytics", "report"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "analytics" && !analytics) fetchAnalytics();
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
              tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Plan Tab */}
      {tab === "plan" && (
        <div className="space-y-3">
          {weekPlans.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No plan generated yet. Click "Generate Plan" to create a week-by-week roadmap.</p>
            </div>
          ) : (
            weekPlans.map((week: any) => {
              const weekPosts = postPlans.filter((p: any) => p.week_number === week.week_number);
              const isExpanded = expandedWeek === week.week_number;

              return (
                <div key={week.id} className="rounded-lg border border-border bg-card">
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : week.week_number)}
                    className="flex w-full items-center justify-between p-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">Week {week.week_number}</Badge>
                        <span className="text-sm font-medium text-foreground">{week.weekly_goal || week.week_purpose}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{week.primary_message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{weekPosts.length} posts</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-2">
                      {week.cta_strategy && (
                        <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">CTA:</span> {week.cta_strategy}</p>
                      )}
                      {weekPosts.map((post: any) => (
                        <CampaignPostCard key={post.id} post={post} campaignId={id!} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Analytics Tab */}
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
              {/* Health */}
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-medium text-foreground">Campaign Health</h3>
                  <Badge variant="outline" className={cn("text-[10px] capitalize", healthColor)}>{analytics.health_status?.replace("_", " ")}</Badge>
                </div>
                {analytics.outcome_progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Outcome Progress</span>
                      <span className="text-foreground">{analytics.outcome_progress.current_value}/{analytics.outcome_progress.target_quantity || "?"}</span>
                    </div>
                    <Progress value={analytics.outcome_progress.progress_pct || 0} className="h-2" />
                  </div>
                )}
                {analytics.posting_progress && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Posts Created</span>
                      <span className="text-foreground">{analytics.posting_progress.drafted}/{analytics.posting_progress.total_planned}</span>
                    </div>
                    <Progress value={analytics.posting_progress.cadence_adherence || 0} className="h-2" />
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {analytics.recommendations && analytics.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary" /> Recommendations
                  </h3>
                  {analytics.recommendations.map((rec: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] capitalize">{rec.type}</Badge>
                        <span className="text-xs font-medium text-foreground">{rec.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rec.description}</p>
                    </div>
                  ))}
                </div>
              )}

              <Button size="sm" variant="outline" onClick={fetchAnalytics}>
                <TrendingUp className="mr-1 h-3.5 w-3.5" /> Refresh Analytics
              </Button>
            </>
          )}
        </div>
      )}

      {/* Report Tab */}
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
              {/* Summary */}
              {report.summary && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Campaign Summary</h3>
                  <Badge variant="outline" className={cn("text-[10px] capitalize",
                    report.summary.status === "success" ? "text-green-600" :
                    report.summary.status === "partial_success" ? "text-yellow-600" : "text-destructive"
                  )}>{report.summary.status?.replace("_", " ")}</Badge>
                  <p className="text-xs text-muted-foreground">{report.summary.overall_assessment}</p>
                </div>
              )}

              {report.content_learnings && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Content Learnings</h3>
                  {report.content_learnings.best_hook_types?.length > 0 && (
                    <div><span className="text-[10px] text-muted-foreground">Best Hooks:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">{report.content_learnings.best_hook_types.map((h: string) => <span key={h} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{h}</span>)}</div>
                    </div>
                  )}
                  {report.content_learnings.best_styles?.length > 0 && (
                    <div><span className="text-[10px] text-muted-foreground">Best Styles:</span>
                      <div className="flex flex-wrap gap-1 mt-0.5">{report.content_learnings.best_styles.map((s: string) => <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{s}</span>)}</div>
                    </div>
                  )}
                </div>
              )}

              {report.strategic_recommendations && report.strategic_recommendations.length > 0 && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h3 className="text-sm font-medium text-foreground">Strategic Recommendations</h3>
                  {report.strategic_recommendations.map((rec: any, i: number) => (
                    <div key={i} className="text-xs space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{rec.action}</Badge>
                        <span className="text-foreground">{rec.recommendation}</span>
                      </div>
                      <p className="text-muted-foreground pl-4">{rec.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}

              {report.suggested_next_campaign && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-1">
                  <h3 className="text-sm font-medium text-primary">Suggested Next Campaign</h3>
                  <p className="text-xs text-foreground">{report.suggested_next_campaign.theme}</p>
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
