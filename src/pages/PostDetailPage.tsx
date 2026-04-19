import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  ArrowLeft, ExternalLink, Calendar, Target, Save, Loader2,
  ThumbsUp, MessageSquare, Share2, Eye, MousePointer, UserPlus, Users2,
  Sparkles, CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight,
} from "lucide-react";

type PostData = {
  id: string;
  content: string;
  publish_date: string | null;
  post_url: string | null;
  source_type: string;
  has_media: boolean;
};

type ContextData = {
  id?: string;
  goal: string;
  persona_id: string;
  campaign_id: string;
  strategy_type: string;
  tone: string;
  hook_type: string;
  cta_type: string;
};

type MetricsData = {
  id?: string;
  reactions: number;
  comments: number;
  reposts: number;
  impressions: number;
  clicks: number;
  profile_visits: number;
  follower_gain: number;
  manual_notes: string;
  // Goal-aware bridge layer — connects raw signals to campaign outcomes.
  goal_contribution: number;
  goal_metric: string | null;
  attribution_note: string;
};

// Linked campaign metadata used to drive the Goal Contribution UI.
type CampaignGoalCtx = {
  campaign_id: string;
  target_metric: string | null;
  target_quantity: number | null;
};

type EvaluationData = {
  goal_fulfillment_score: number;
  fulfillment_status: string;
  reason_summary: string | null;
  strongest_factor: string | null;
  weakest_factor: string | null;
};

type DiagnosisData = {
  what_worked: string[];
  what_weakened: string[];
  what_to_change: string[];
  hook_analysis: any;
  content_analysis: any;
  structure_analysis: any;
  cta_analysis: any;
};

type RecommendationData = {
  what_to_repeat: string[];
  what_to_avoid: string[];
  improved_hooks: string[];
  improved_angles: string[];
  improved_ctas: string[];
  strategy_suggestion: string | null;
};

const emptyContext: ContextData = { goal: "", persona_id: "", campaign_id: "", strategy_type: "", tone: "", hook_type: "", cta_type: "" };
const emptyMetrics: MetricsData = {
  reactions: 0, comments: 0, reposts: 0, impressions: 0, clicks: 0, profile_visits: 0, follower_gain: 0, manual_notes: "",
  goal_contribution: 0, goal_metric: null, attribution_note: "",
};

const goals = ["brand_awareness", "education", "storytelling", "lead_generation"];
const strategies = ["storytelling", "educational", "authority", "product_led", "soft_promotion"];
const tones = ["friendly", "professional", "empathetic", "authoritative", "bold", "conversational"];
const hookTypes = ["curiosity", "contrarian", "pain_driven", "data_bold", "question", "story_opening"];
const ctaTypes = ["soft", "hard", "question", "dm_prompt", "comment_prompt", "link"];

const PostDetailPage = () => {
  const { postId } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<PostData | null>(null);
  const [context, setContext] = useState<ContextData>(emptyContext);
  const [metrics, setMetrics] = useState<MetricsData>(emptyMetrics);
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([]);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingContext, setSavingContext] = useState(false);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    context: true, metrics: true, evaluation: true, diagnosis: false, recommendations: false,
  });

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    if (!user || !postId) return;
    fetchAll();
  }, [user, postId]);

  const fetchAll = async () => {
    const [postRes, ctxRes, metricsRes, evalRes, diagRes, recRes, personaRes, campRes] = await Promise.all([
      supabase.from("linkedin_posts").select("*").eq("id", postId!).single(),
      supabase.from("post_context").select("*").eq("linkedin_post_id", postId!).maybeSingle(),
      supabase.from("post_metrics").select("*").eq("linkedin_post_id", postId!).maybeSingle(),
      supabase.from("goal_evaluations").select("*").eq("linkedin_post_id", postId!).maybeSingle(),
      supabase.from("writing_diagnoses").select("*").eq("linkedin_post_id", postId!).maybeSingle(),
      supabase.from("post_recommendations").select("*").eq("linkedin_post_id", postId!).maybeSingle(),
      supabase.from("audience_personas").select("id, name").order("name"),
      supabase.from("campaigns").select("id, name").eq("is_active", true).order("name"),
    ]);

    if (postRes.error || !postRes.data) {
      toast.error("Post not found");
      setLoading(false);
      return;
    }

    setPost(postRes.data);
    if (ctxRes.data) {
      setContext({ ...emptyContext, ...ctxRes.data });
    } else if (postRes.data.linked_draft_id) {
      // Auto-fill context from the campaign this post originated from
      const auto = await deriveContextFromDraft(postRes.data.linked_draft_id);
      if (auto) setContext(c => ({ ...c, ...auto }));
    }
    if (metricsRes.data) setMetrics({ ...emptyMetrics, ...metricsRes.data });
    setEvaluation(evalRes.data || null);
    setDiagnosis(diagRes.data || null);
    setRecommendations(recRes.data || null);
    setPersonas(personaRes.data || []);
    setCampaigns(campRes.data || []);
    setLoading(false);
  };

  // Walk the chain: linkedin_post → draft → campaign_post_plan → campaign + persona
  // Campaign-originated posts should not require manual tagging.
  const deriveContextFromDraft = async (draftId: string): Promise<Partial<ContextData> | null> => {
    const { data: plan } = await supabase
      .from("campaign_post_plans")
      .select("campaign_id, suggested_tone, suggested_hook_type, suggested_cta_type")
      .eq("linked_draft_id", draftId)
      .maybeSingle();
    if (!plan?.campaign_id) return null;

    const { data: campaign } = await supabase
      .from("campaigns")
      .select("primary_objective, primary_persona_id, tone, cta_type")
      .eq("id", plan.campaign_id)
      .maybeSingle();

    // Map campaign primary_objective onto the post's goal vocabulary
    const goalMap: Record<string, string> = {
      awareness: "brand_awareness",
      brand_awareness: "brand_awareness",
      education: "education",
      storytelling: "storytelling",
      lead_generation: "lead_generation",
      leads: "lead_generation",
      demo_bookings: "lead_generation",
    };
    const mappedGoal = campaign?.primary_objective ? goalMap[campaign.primary_objective] || "" : "";

    return {
      campaign_id: plan.campaign_id,
      persona_id: campaign?.primary_persona_id || "",
      goal: mappedGoal,
      tone: plan.suggested_tone || campaign?.tone || "",
      hook_type: plan.suggested_hook_type || "",
      cta_type: plan.suggested_cta_type || campaign?.cta_type || "",
      strategy_type: "",
    };
  };

  const saveContext = async () => {
    setSavingContext(true);
    try {
      const payload = {
        user_id: user!.id,
        linkedin_post_id: postId!,
        ...context,
        persona_id: context.persona_id || null,
        campaign_id: context.campaign_id || null,
      };
      const { error } = context.id
        ? await supabase.from("post_context").update(payload).eq("id", context.id)
        : await supabase.from("post_context").upsert(payload, { onConflict: "linkedin_post_id" });
      if (error) throw error;
      toast.success("Context saved");
      const { data } = await supabase.from("post_context").select("*").eq("linkedin_post_id", postId!).single();
      if (data) setContext(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingContext(false);
    }
  };

  const saveMetrics = async () => {
    setSavingMetrics(true);
    try {
      const payload = {
        user_id: user!.id,
        linkedin_post_id: postId!,
        reactions: metrics.reactions,
        comments: metrics.comments,
        reposts: metrics.reposts,
        impressions: metrics.impressions,
        clicks: metrics.clicks,
        profile_visits: metrics.profile_visits,
        follower_gain: metrics.follower_gain,
        manual_notes: metrics.manual_notes || null,
        source: "manual",
      };
      const { error } = metrics.id
        ? await supabase.from("post_metrics").update(payload).eq("id", metrics.id)
        : await supabase.from("post_metrics").upsert(payload, { onConflict: "linkedin_post_id" });
      if (error) throw error;
      toast.success("Metrics saved");
      const { data } = await supabase.from("post_metrics").select("*").eq("linkedin_post_id", postId!).single();
      if (data) setMetrics(data);

      // Auto-trigger learning if enough data exists
      triggerAutoLearn();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingMetrics(false);
    }
  };

  const triggerAutoLearn = async () => {
    try {
      // Check if there are 3+ metrics entries
      const { count } = await supabase
        .from("post_metrics")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);

      if (count && count >= 3) {
        // Run learn-patterns in background
        supabase.functions.invoke("learn-patterns").then(({ data, error }) => {
          if (!error && data?.patterns_count > 0) {
            toast.success(`Patterns updated: ${data.patterns_count} patterns learned`, { duration: 3000 });
            // Also refresh strategy recommendations
            supabase.functions.invoke("recommend-next").catch(() => {});
          }
        }).catch(() => {});
      }
    } catch { /* non-critical */ }
  };

  const runAnalysis = async () => {
    if (!context.goal) {
      toast.error("Set the post's goal before running analysis");
      return;
    }
    if (!metrics.id && metrics.reactions === 0 && metrics.impressions === 0) {
      toast.error("Add metrics before running analysis");
      return;
    }
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-post", {
        body: { post_id: postId },
      });
      if (error) throw error;
      toast.success("Analysis complete");
      // Refresh all analysis data
      const [evalRes, diagRes, recRes] = await Promise.all([
        supabase.from("goal_evaluations").select("*").eq("linkedin_post_id", postId!).single(),
        supabase.from("writing_diagnoses").select("*").eq("linkedin_post_id", postId!).single(),
        supabase.from("post_recommendations").select("*").eq("linkedin_post_id", postId!).single(),
      ]);
      if (evalRes.data) setEvaluation(evalRes.data);
      if (diagRes.data) setDiagnosis(diagRes.data);
      if (recRes.data) setRecommendations(recRes.data);
      setExpandedSections(prev => ({ ...prev, evaluation: true, diagnosis: true, recommendations: true }));
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="content-fade-in h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="content-fade-in h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Post not found</p>
      </div>
    );
  }

  const fulfillmentIcon = () => {
    switch (evaluation?.fulfillment_status) {
      case "fulfilled": return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "partially_fulfilled": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "not_fulfilled": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  const SectionHeader = ({ title, sectionKey, icon: Icon }: { title: string; sectionKey: string; icon: any }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="flex w-full items-center gap-2 text-left"
    >
      {expandedSections[sectionKey] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{title}</span>
    </button>
  );

  const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Select...</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const MetricInput = ({ label, icon: Icon, value, onChange }: { label: string; icon: any; value: number; onChange: (v: number) => void }) => (
    <div>
      <label className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
        <Icon className="h-3 w-3" />{label}
      </label>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );

  return (
    <div className="content-fade-in h-full flex">
      {/* Left: Post content & context/metrics input */}
      <div className="w-[420px] shrink-0 border-r border-border overflow-y-auto px-6 py-8 space-y-6">
        <Link to="/performance" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Performance
        </Link>

        {/* Post preview */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            {post.publish_date && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(post.publish_date).toLocaleDateString()}
              </span>
            )}
            {post.post_url && (
              <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <ExternalLink className="h-3 w-3" />
                View on LinkedIn
              </a>
            )}
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        {/* Context tagging */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <SectionHeader title="Strategic Context" sectionKey="context" icon={Target} />
          {expandedSections.context && (
            <div className="space-y-3 pt-2">
              <SelectField label="Goal" value={context.goal} onChange={v => setContext(c => ({ ...c, goal: v }))}
                options={goals.map(g => ({ value: g, label: g.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) }))} />
              <SelectField label="Persona" value={context.persona_id} onChange={v => setContext(c => ({ ...c, persona_id: v }))}
                options={personas.map(p => ({ value: p.id, label: p.name }))} />
              <SelectField label="Campaign" value={context.campaign_id} onChange={v => setContext(c => ({ ...c, campaign_id: v }))}
                options={campaigns.map(c => ({ value: c.id, label: c.name }))} />
              <SelectField label="Strategy" value={context.strategy_type} onChange={v => setContext(c => ({ ...c, strategy_type: v }))}
                options={strategies.map(s => ({ value: s, label: s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()) }))} />
              <div className="grid grid-cols-3 gap-2">
                <SelectField label="Tone" value={context.tone} onChange={v => setContext(c => ({ ...c, tone: v }))}
                  options={tones.map(t => ({ value: t, label: t.replace(/\b\w/g, c => c.toUpperCase()) }))} />
                <SelectField label="Hook" value={context.hook_type} onChange={v => setContext(c => ({ ...c, hook_type: v }))}
                  options={hookTypes.map(h => ({ value: h, label: h.replace("_", " ") }))} />
                <SelectField label="CTA" value={context.cta_type} onChange={v => setContext(c => ({ ...c, cta_type: v }))}
                  options={ctaTypes.map(c => ({ value: c, label: c.replace("_", " ") }))} />
              </div>
              <button
                onClick={saveContext}
                disabled={savingContext}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {savingContext ? "Saving..." : "Save Context"}
              </button>
            </div>
          )}
        </div>

        {/* Metrics input */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <SectionHeader title="Performance Metrics" sectionKey="metrics" icon={Eye} />
          {expandedSections.metrics && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-2">
                <MetricInput label="Reactions" icon={ThumbsUp} value={metrics.reactions} onChange={v => setMetrics(m => ({ ...m, reactions: v }))} />
                <MetricInput label="Comments" icon={MessageSquare} value={metrics.comments} onChange={v => setMetrics(m => ({ ...m, comments: v }))} />
                <MetricInput label="Reposts" icon={Share2} value={metrics.reposts} onChange={v => setMetrics(m => ({ ...m, reposts: v }))} />
                <MetricInput label="Impressions" icon={Eye} value={metrics.impressions} onChange={v => setMetrics(m => ({ ...m, impressions: v }))} />
                <MetricInput label="Clicks" icon={MousePointer} value={metrics.clicks} onChange={v => setMetrics(m => ({ ...m, clicks: v }))} />
                <MetricInput label="Profile Visits" icon={Users2} value={metrics.profile_visits} onChange={v => setMetrics(m => ({ ...m, profile_visits: v }))} />
                <MetricInput label="Follower Gain" icon={UserPlus} value={metrics.follower_gain} onChange={v => setMetrics(m => ({ ...m, follower_gain: v }))} />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Notes</label>
                <textarea
                  value={metrics.manual_notes}
                  onChange={e => setMetrics(m => ({ ...m, manual_notes: e.target.value }))}
                  placeholder="Any additional notes about this post's performance..."
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs min-h-[60px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={saveMetrics}
                disabled={savingMetrics}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {savingMetrics ? "Saving..." : "Save Metrics"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right: Analysis results */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {/* Analyze button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Post Intelligence</h2>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {analyzing ? "Analyzing..." : "Run Analysis"}
          </button>
        </div>

        {/* Goal Evaluation */}
        {evaluation ? (
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <SectionHeader title="Goal Evaluation" sectionKey="evaluation" icon={Target} />
            {expandedSections.evaluation && (
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  {fulfillmentIcon()}
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {evaluation.fulfillment_status === "fulfilled" && "Goal Fulfilled"}
                      {evaluation.fulfillment_status === "partially_fulfilled" && "Partially Fulfilled"}
                      {evaluation.fulfillment_status === "not_fulfilled" && "Goal Not Fulfilled"}
                    </p>
                    <p className="text-xs text-muted-foreground">Score: {evaluation.goal_fulfillment_score}%</p>
                  </div>
                </div>
                {evaluation.reason_summary && (
                  <p className="text-sm text-foreground leading-relaxed">{evaluation.reason_summary}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {evaluation.strongest_factor && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-3">
                      <p className="text-[10px] font-medium text-green-700 mb-1">Strongest Factor</p>
                      <p className="text-xs text-green-800">{evaluation.strongest_factor}</p>
                    </div>
                  )}
                  {evaluation.weakest_factor && (
                    <div className="rounded-md bg-red-50 border border-red-200 p-3">
                      <p className="text-[10px] font-medium text-red-700 mb-1">Weakest Factor</p>
                      <p className="text-xs text-red-800">{evaluation.weakest_factor}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No analysis yet</p>
            <p className="text-xs text-muted-foreground">
              Tag the post with a goal, add metrics, then run analysis to get AI-powered insights.
            </p>
          </div>
        )}

        {/* Writing Diagnosis */}
        {diagnosis && (
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <SectionHeader title="Writing Diagnosis" sectionKey="diagnosis" icon={Sparkles} />
            {expandedSections.diagnosis && (
              <div className="space-y-4 pt-2">
                {diagnosis.what_worked.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-2">✓ What Worked</p>
                    <ul className="space-y-1">
                      {diagnosis.what_worked.map((item, i) => (
                        <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-green-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.what_weakened.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-2">⚠ What Weakened</p>
                    <ul className="space-y-1">
                      {diagnosis.what_weakened.map((item, i) => (
                        <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-amber-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {diagnosis.what_to_change.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-blue-700 mb-2">→ What to Change</p>
                    <ul className="space-y-1">
                      {diagnosis.what_to_change.map((item, i) => (
                        <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-blue-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {recommendations && (
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <SectionHeader title="Recommendations" sectionKey="recommendations" icon={Target} />
            {expandedSections.recommendations && (
              <div className="space-y-4 pt-2">
                {recommendations.what_to_repeat.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-green-700 mb-2">🔄 Repeat</p>
                    <ul className="space-y-1">
                      {recommendations.what_to_repeat.map((item, i) => (
                        <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-green-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendations.what_to_avoid.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-700 mb-2">🚫 Avoid</p>
                    <ul className="space-y-1">
                      {recommendations.what_to_avoid.map((item, i) => (
                        <li key={i} className="text-sm text-foreground pl-3 border-l-2 border-red-300">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendations.improved_hooks.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">💡 Improved Hook Ideas</p>
                    <ul className="space-y-1">
                      {recommendations.improved_hooks.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-border italic">"{item}"</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendations.improved_ctas.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">🎯 Improved CTA Ideas</p>
                    <ul className="space-y-1">
                      {recommendations.improved_ctas.map((item, i) => (
                        <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-border italic">"{item}"</li>
                      ))}
                    </ul>
                  </div>
                )}
                {recommendations.strategy_suggestion && (
                  <div className="rounded-md bg-secondary p-3">
                    <p className="text-xs font-medium text-foreground mb-1">Strategy Suggestion</p>
                    <p className="text-sm text-muted-foreground">{recommendations.strategy_suggestion}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;
