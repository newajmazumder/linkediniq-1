import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, BookmarkPlus, RefreshCw, ChevronDown,
  Minus, User, Zap, Package, Loader2,
  BookOpen, MessageSquare, Shuffle, Eye, AlertTriangle, BarChart3, Bold,
  Image, Layers, FileText, ArrowUp, ArrowDown, ShieldCheck, ShieldAlert, CheckCircle, Lightbulb,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ImageBrief = {
  slide_number: number;
  visual_description: string;
  text_overlay: string;
  design_notes: string;
};

export type Post = {
  id: string;
  variation_number: number;
  hook: string;
  hook_type?: string | null;
  body: string;
  cta: string;
  first_comment: string | null;
  post_style: string;
  tone: string | null;
  post_type?: string;
  image_briefs?: ImageBrief[] | null;
  context_rationale?: string | null;
  generation_influences?: {
    what_repeated?: string;
    what_avoided?: string;
    what_tested?: string;
  } | null;
};

export type PredictionResult = {
  hook_strength: number;
  persona_relevance: number;
  clarity: number;
  goal_alignment: number;
  cta_alignment: number;
  context_relevance: number;
  predicted_score: number;
  risk_level: string;
  suggestions: string[];
  historical_comparison: string;
  strongest_element: string;
  weakest_element: string;
  failure_reasons: string[];
  improved_hooks: string[];
  improved_ctas: string[];
  publish_recommendation: string;
  outcome_probability?: number;
  goal_fit_score?: number;
  attention_potential?: number;
  engagement_potential?: number;
  action_potential?: number;
  outcome_potential?: number;
  weak_stage?: string;
  stage_breakdown?: Record<string, string>;
};

const styleLabels: Record<string, string> = {
  product_insight: "Product Insight",
  pain_solution: "Pain → Solution",
  founder_tone: "Founder Tone",
  founder_story: "Founder Story",
  customer_story: "Customer Story",
  educational: "Educational",
  framework: "Framework",
  hybrid_story_insight: "Story + Insight",
  hybrid_pain_education: "Pain + Education",
  soft_promotion: "Soft Promotion",
};

const postTypeIcons: Record<string, any> = {
  text: FileText,
  image_text: Image,
  carousel: Layers,
};

const postTypeLabels: Record<string, string> = {
  text: "Text",
  image_text: "Image + Text",
  carousel: "Carousel",
};

const riskColors: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-destructive",
};

const publishColors: Record<string, { bg: string; text: string; label: string }> = {
  publish: { bg: "bg-green-500/10", text: "text-green-600", label: "Ready to publish" },
  revise: { bg: "bg-yellow-500/10", text: "text-yellow-600", label: "Revise before publishing" },
  not_recommended: { bg: "bg-destructive/10", text: "text-destructive", label: "Not recommended" },
};

export const getScoreInterpretation = (score: number): { label: string; color: string } => {
  if (score >= 80) return { label: "Strong — ready to publish", color: "text-green-600" };
  if (score >= 60) return { label: "Decent — review suggestions", color: "text-yellow-600" };
  if (score >= 40) return { label: "Weak — revision needed", color: "text-destructive" };
  return { label: "Not recommended — rethink approach", color: "text-destructive" };
};

type Props = {
  post: Post;
  ideaId: string;
  userId: string;
  selected?: boolean;
  onSelect?: () => void;
  onPostUpdate: (updated: Post) => void;
  compact?: boolean;
};

const PostCard = ({ post, ideaId, userId, selected, onSelect, onPostUpdate, compact }: Props) => {
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [showPrediction, setShowPrediction] = useState(false);
  const [showBriefs, setShowBriefs] = useState(false);

  const copyPost = () => {
    const text = `${post.hook}\n\n${post.body}\n\n${post.cta}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const fullContent = `${post.hook}\n\n${post.body}\n\n${post.cta}`;
      const { error } = await supabase.from("drafts").insert({
        user_id: userId,
        idea_id: ideaId,
        selected_post_id: post.id,
        custom_content: fullContent,
        status: "draft",
      });
      if (error) throw error;
      toast.success("Saved to drafts");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSavingDraft(false);
    }
  };

  const predictPerformance = async () => {
    setPredicting(true);
    try {
      const { data, error } = await supabase.functions.invoke("predict-score", {
        body: { post_id: post.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPrediction(data);
      setShowPrediction(true);
      toast.success("Analysis complete!");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setPredicting(false);
    }
  };

  const rewritePost = async (action: string, ctx?: Record<string, any>) => {
    setRewriting(action);
    try {
      const { data, error } = await supabase.functions.invoke("rewrite-post", {
        body: { post_id: post.id, action, context: ctx },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onPostUpdate(data.post);
      setPrediction(null);
      toast.success("Post updated");
    } catch (err: any) {
      toast.error(err.message || "Rewrite failed");
    } finally {
      setRewriting(null);
    }
  };

  const regenerateFromSuggestions = () => {
    if (!prediction) return;
    rewritePost("regenerate_from_suggestions", {
      suggestions: prediction.suggestions,
      failure_reasons: prediction.failure_reasons,
      weakest_element: prediction.weakest_element,
      strongest_element: prediction.strongest_element,
      improved_hooks: prediction.improved_hooks,
      improved_ctas: prediction.improved_ctas,
    });
  };

  const regenerateFromPrediction = () => {
    if (!prediction) return;
    rewritePost("regenerate_from_prediction", {
      predicted_score: prediction.predicted_score,
      publish_recommendation: prediction.publish_recommendation,
      risk_level: prediction.risk_level,
      hook_strength: prediction.hook_strength,
      persona_relevance: prediction.persona_relevance,
      clarity: prediction.clarity,
      goal_alignment: prediction.goal_alignment,
      cta_alignment: prediction.cta_alignment,
      context_relevance: prediction.context_relevance,
      weak_stage: prediction.weak_stage,
      weakest_element: prediction.weakest_element,
      strongest_element: prediction.strongest_element,
      failure_reasons: prediction.failure_reasons,
      suggestions: prediction.suggestions,
      improved_hooks: prediction.improved_hooks,
      improved_ctas: prediction.improved_ctas,
    });
  };

  const isRewriting = rewriting !== null;
  const PostTypeIcon = postTypeIcons[post.post_type || "text"] || FileText;
  const pubRec = prediction ? publishColors[prediction.publish_recommendation] || publishColors.revise : null;
  const scoreInterp = prediction ? getScoreInterpretation(prediction.predicted_score) : null;

  const ScoreBar = ({ label, value }: { label: string; value: number }) => (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-16 shrink-0">{label}</span>
      <div className="h-1 flex-1 rounded-full bg-secondary">
        <div
          className="h-1 rounded-full bg-foreground/60 transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground w-6 text-right">{value}</span>
    </div>
  );

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 transition-colors ${
        selected ? "border-foreground" : "border-border"
      } ${onSelect ? "cursor-pointer" : ""}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-secondary text-xs font-medium text-secondary-foreground">
            {post.variation_number}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <PostTypeIcon className="h-3 w-3" />
            {postTypeLabels[post.post_type || "text"]}
          </span>
          <span className="text-xs text-muted-foreground">
            {styleLabels[post.post_style] || post.post_style}
          </span>
          {post.hook_type && (
            <span className="text-xs text-muted-foreground">· {post.hook_type.replace("_", " ")}</span>
          )}
          {post.tone && (
            <span className="text-xs text-muted-foreground">· {post.tone}</span>
          )}
          {/* Unified score badge from prediction */}
          {prediction && (
            <Badge
              variant="outline"
              className={cn(
                "ml-1 text-xs font-semibold",
                prediction.predicted_score >= 80 ? "border-green-500/30 bg-green-500/10 text-green-600" :
                prediction.predicted_score >= 60 ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-600" :
                "border-destructive/30 bg-destructive/10 text-destructive"
              )}
            >
              {prediction.predicted_score}
            </Badge>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={predictPerformance}
            disabled={predicting}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
            title="Analyze performance"
          >
            {predicting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={copyPost}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            title="Copy"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={saveDraft}
            disabled={savingDraft}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
            title="Save to drafts"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={isRewriting}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                title="Rewrite options"
              >
                {isRewriting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Refine</p>
              <DropdownMenuItem onClick={() => rewritePost("regenerate_hook")}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate Hook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("regenerate_cta")}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate CTA
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tone</p>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_shorter")}>
                <Minus className="mr-2 h-3.5 w-3.5" /> Shorter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_human")}>
                <User className="mr-2 h-3.5 w-3.5" /> More Human
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_bold")}>
                <Zap className="mr-2 h-3.5 w-3.5" /> More Bold
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_product")}>
                <Package className="mr-2 h-3.5 w-3.5" /> Product-Focused
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Content Style</p>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_story")}>
                <BookOpen className="mr-2 h-3.5 w-3.5" /> Story Format
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_educational")}>
                <MessageSquare className="mr-2 h-3.5 w-3.5" /> Educational Framework
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("rewrite_hybrid")}>
                <Shuffle className="mr-2 h-3.5 w-3.5" /> Hybrid (Story + Insight)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hook Style</p>
              <DropdownMenuItem onClick={() => rewritePost("hook_curiosity")}>
                <Eye className="mr-2 h-3.5 w-3.5" /> Curiosity Hook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("hook_contrarian")}>
                <Bold className="mr-2 h-3.5 w-3.5" /> Contrarian Hook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("hook_pain")}>
                <AlertTriangle className="mr-2 h-3.5 w-3.5" /> Pain-Driven Hook
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => rewritePost("hook_data")}>
                <BarChart3 className="mr-2 h-3.5 w-3.5" /> Data/Bold Hook
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className={`space-y-2 text-foreground ${compact ? "text-xs" : "text-sm"}`}>
        <p className="font-medium">{post.hook}</p>
        <p className="whitespace-pre-line leading-relaxed">{post.body}</p>
        <p className="font-medium">{post.cta}</p>
      </div>

      {/* Image Briefs for image_text and carousel */}
      {post.image_briefs && post.image_briefs.length > 0 && !compact && (
        <div className="space-y-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowBriefs(!showBriefs); }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            {post.post_type === "carousel" ? <Layers className="h-3 w-3" /> : <Image className="h-3 w-3" />}
            {showBriefs ? "Hide" : "Show"} {post.post_type === "carousel" ? `${post.image_briefs.length} slide briefs` : "image brief"}
          </button>
          {showBriefs && (
            <div className="space-y-2">
              {(post.image_briefs as ImageBrief[]).map((brief, idx) => (
                <div key={idx} className="rounded-md bg-secondary/50 border border-border p-3 space-y-1">
                  <p className="text-[10px] font-medium text-foreground flex items-center gap-1">
                    {post.post_type === "carousel" ? `Slide ${brief.slide_number}` : "Image"}
                  </p>
                  {brief.text_overlay && (
                    <p className="text-xs font-medium text-foreground">"{brief.text_overlay}"</p>
                  )}
                  <p className="text-xs text-muted-foreground">{brief.visual_description}</p>
                  {brief.design_notes && (
                    <p className="text-[10px] text-muted-foreground italic">Design: {brief.design_notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* First comment */}
      {post.first_comment && !compact && (
        <div className="rounded-md bg-secondary p-3">
          <p className="text-xs text-muted-foreground mb-1">Suggested first comment</p>
          <p className="text-xs text-secondary-foreground">{post.first_comment}</p>
        </div>
      )}

      {/* Context rationale */}
      {post.context_rationale && !compact && (
        <div className="rounded-md bg-accent/10 border border-accent/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Business context used</p>
          <p className="text-xs text-foreground">{post.context_rationale}</p>
        </div>
      )}

      {/* Generation Influences */}
      {post.generation_influences && !compact && (
        <div className="rounded-md bg-primary/5 border border-primary/20 p-3 space-y-1.5">
          <p className="text-xs text-primary font-medium">🧠 Learning-driven generation</p>
          {post.generation_influences.what_repeated && (
            <p className="text-xs text-foreground flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 rounded-full bg-green-500 shrink-0" />
              <span><span className="text-muted-foreground">Repeated: </span>{post.generation_influences.what_repeated}</span>
            </p>
          )}
          {post.generation_influences.what_avoided && (
            <p className="text-xs text-foreground flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />
              <span><span className="text-muted-foreground">Avoided: </span>{post.generation_influences.what_avoided}</span>
            </p>
          )}
          {post.generation_influences.what_tested && (
            <p className="text-xs text-foreground flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 rounded-full bg-blue-500 shrink-0" />
              <span><span className="text-muted-foreground">Testing: </span>{post.generation_influences.what_tested}</span>
            </p>
          )}
        </div>
      )}

      {/* Unified Prediction Score Card */}
      {prediction && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Header: Score + Interpretation + Readiness */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">{prediction.predicted_score}</span>
                <span className="text-xs text-muted-foreground">/100</span>
              </div>
              {scoreInterp && (
                <span className={cn("text-xs font-medium", scoreInterp.color)}>
                  {scoreInterp.label}
                </span>
              )}
            </div>
            {pubRec && (
              <Badge variant="outline" className={cn("text-[10px]", pubRec.bg, pubRec.text)}>
                {prediction.publish_recommendation === "publish" ? <ShieldCheck className="h-3 w-3 mr-1" /> : prediction.publish_recommendation === "not_recommended" ? <ShieldAlert className="h-3 w-3 mr-1" /> : null}
                {pubRec.label}
              </Badge>
            )}
          </div>

          {/* Outcome Probability + Stage Breakdown */}
          {(prediction.outcome_probability !== undefined || prediction.attention_potential !== undefined) && (
            <div className="space-y-2">
              {prediction.outcome_probability !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Outcome Probability</span>
                  <span className={cn("text-sm font-bold", prediction.outcome_probability >= 70 ? "text-green-600" : prediction.outcome_probability >= 40 ? "text-yellow-600" : "text-destructive")}>{prediction.outcome_probability}%</span>
                </div>
              )}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: "Attention", value: prediction.attention_potential, key: "attention" },
                  { label: "Engage", value: prediction.engagement_potential, key: "engagement" },
                  { label: "Action", value: prediction.action_potential, key: "action" },
                  { label: "Outcome", value: prediction.outcome_potential, key: "outcome" },
                ].map(({ label, value, key }) => (
                  <div key={key} className={cn("text-center rounded-md p-1.5 border", prediction.weak_stage === key ? "border-destructive/30 bg-destructive/5" : "border-border bg-secondary/30")}>
                    <p className={cn("text-xs font-semibold", (value || 0) >= 70 ? "text-green-600" : (value || 0) >= 40 ? "text-yellow-600" : "text-destructive")}>{value || 0}</p>
                    <p className={cn("text-[9px]", prediction.weak_stage === key ? "text-destructive font-medium" : "text-muted-foreground")}>{label}{prediction.weak_stage === key ? " ⚠" : ""}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6 Scoring Dimensions */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {[
              { label: "Hook", value: prediction.hook_strength },
              { label: "Persona", value: prediction.persona_relevance },
              { label: "Clarity", value: prediction.clarity },
              { label: "Goal", value: prediction.goal_alignment },
              { label: "CTA", value: prediction.cta_alignment },
              { label: "Context", value: prediction.context_relevance },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className={cn("text-sm font-semibold", value >= 70 ? "text-green-600" : value >= 40 ? "text-yellow-600" : "text-destructive")}>{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {/* Strongest / Weakest */}
          {(prediction.strongest_element || prediction.weakest_element) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {prediction.strongest_element && (
                <div className="rounded-md bg-green-500/5 border border-green-500/20 p-2">
                  <p className="text-[10px] font-medium text-green-600 flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Strongest</p>
                  <p className="text-xs text-foreground mt-0.5">{prediction.strongest_element}</p>
                </div>
              )}
              {prediction.weakest_element && (
                <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
                  <p className="text-[10px] font-medium text-destructive flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Weakest</p>
                  <p className="text-xs text-foreground mt-0.5">{prediction.weakest_element}</p>
                </div>
              )}
            </div>
          )}

          {/* Toggle details */}
          <button onClick={() => setShowPrediction(!showPrediction)} className="text-[10px] text-primary hover:underline">
            {showPrediction ? "Show less" : "Show detailed analysis"}
          </button>

          {showPrediction && (
            <div className="space-y-3 pt-1">
              {prediction.failure_reasons && prediction.failure_reasons.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Why this may underperform</p>
                  {prediction.failure_reasons.map((r, i) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-1.5 pl-1"><span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />{r}</p>
                  ))}
                </div>
              )}

              {prediction.improved_hooks && prediction.improved_hooks.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-primary flex items-center gap-1"><Zap className="h-3 w-3" /> Better hook options</p>
                  {prediction.improved_hooks.map((h, i) => (
                    <div key={i} className="flex items-start gap-1.5 pl-1">
                      <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                      <p className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(h); toast.success("Hook copied"); }}>{h}</p>
                    </div>
                  ))}
                </div>
              )}

              {prediction.improved_ctas && prediction.improved_ctas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-primary flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Better CTA options</p>
                  {prediction.improved_ctas.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5 pl-1">
                      <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                      <p className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(c); toast.success("CTA copied"); }}>{c}</p>
                    </div>
                  ))}
                </div>
              )}

              {prediction.suggestions && prediction.suggestions.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-foreground flex items-center gap-1"><Lightbulb className="h-3 w-3 text-primary" /> Quick fixes</p>
                  {prediction.suggestions.map((s, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 pl-1"><span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />{s}</p>
                  ))}
                </div>
              )}

              {prediction.historical_comparison && (
                <p className="text-xs text-muted-foreground italic">{prediction.historical_comparison}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCard;
