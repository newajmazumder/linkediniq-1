import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock, PenLine, Check, Eye, BarChart3, Loader2,
  ArrowRight, AlertTriangle, ShieldCheck, ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PostPlan = {
  id: string;
  campaign_id: string;
  post_number: number;
  week_number: number;
  status: string | null;
  post_objective: string | null;
  content_angle: string | null;
  suggested_hook_type: string | null;
  suggested_tone: string | null;
  suggested_cta_type: string | null;
  recommended_format: string | null;
  strategic_rationale: string | null;
  linked_draft_id: string | null;
  linked_post_id: string | null;
};

const statusColors: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  drafted: "bg-yellow-500/10 text-yellow-600",
  published: "bg-green-500/10 text-green-600",
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return { label: "Strong", color: "text-green-600", icon: ShieldCheck };
  if (score >= 60) return { label: "Decent", color: "text-yellow-600", icon: AlertTriangle };
  return { label: "Weak", color: "text-destructive", icon: ShieldAlert };
};

const CampaignPostCard = ({
  post,
  campaignId,
}: {
  post: PostPlan;
  campaignId: string;
}) => {
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [actualPerformance, setActualPerformance] = useState<any>(null);

  useEffect(() => {
    const loadPerformanceSignals = async () => {
      if (!post.linked_draft_id) return;

      const [{ data: predictionData }, { data: actualData }] = await Promise.all([
        supabase
          .from("prediction_scores")
          .select("*")
          .eq("draft_id", post.linked_draft_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("post_performance")
          .select("*")
          .eq("draft_id", post.linked_draft_id)
          .maybeSingle(),
      ]);

      if (predictionData) setPrediction(predictionData);
      if (actualData) setActualPerformance(actualData);
    };

    loadPerformanceSignals();
  }, [post.linked_draft_id]);

  const fetchPrediction = async () => {
    if (!post.linked_draft_id) return;
    setPredicting(true);
    try {
      const { data, error } = await supabase.functions.invoke("predict-score", {
        body: { draft_id: post.linked_draft_id },
      });
      if (error) throw error;
      setPrediction(data);
    } catch (err: any) {
      toast.error("Failed to get prediction");
    } finally {
      setPredicting(false);
    }
  };

  const status = post.status || "planned";
  const actualEngagementRate = actualPerformance?.impressions
    ? (((actualPerformance.likes || 0) + (actualPerformance.comments || 0) + (actualPerformance.saves || 0)) / actualPerformance.impressions) * 100
    : null;
  const expectedEngagementRate = prediction?.predicted_score >= 80 ? 4 : prediction?.predicted_score >= 60 ? 2.5 : 1.5;
  const performanceDelta = actualEngagementRate !== null && prediction
    ? actualEngagementRate - expectedEngagementRate
    : null;

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-foreground">Post {post.post_number}</span>
          <Badge variant="outline" className={cn("text-[10px]", statusColors[status] || "")}> 
            {status === "planned" && <Clock className="mr-0.5 h-2.5 w-2.5" />}
            {status === "drafted" && <PenLine className="mr-0.5 h-2.5 w-2.5" />}
            {status === "published" && <Check className="mr-0.5 h-2.5 w-2.5" />}
            {status}
          </Badge>
          {prediction && (
            (() => {
              const info = getScoreLabel(prediction.predicted_score);
              const Icon = info.icon;
              return (
                <Badge variant="outline" className={cn("text-[10px] gap-0.5", info.color)}>
                  <Icon className="h-2.5 w-2.5" />
                  {prediction.predicted_score}/100
                </Badge>
              );
            })()
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "drafted" && post.linked_draft_id && !prediction && (
            <button
              onClick={fetchPrediction}
              disabled={predicting}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {predicting ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
              Predict
            </button>
          )}

          {status === "planned" && (
            <Link
              to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PenLine className="h-3 w-3" /> Create now
            </Link>
          )}

          {status === "drafted" && post.linked_draft_id && (
            <div className="flex items-center gap-2">
              <Link
                to="/drafts"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Clock className="h-3 w-3" /> Schedule this post
              </Link>
              <Link
                to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}&edit_draft=${post.linked_draft_id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <PenLine className="h-3 w-3" /> Edit
              </Link>
            </div>
          )}

          {status === "published" && (
            <Link
              to="/performance"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Eye className="h-3 w-3" /> Track performance
            </Link>
          )}
        </div>
      </div>

      <p className="text-xs text-foreground">{post.post_objective}</p>
      <p className="text-[10px] text-muted-foreground">{post.content_angle}</p>
      <div className="flex flex-wrap gap-1">
        {post.suggested_hook_type && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{post.suggested_hook_type}</span>
        )}
        {post.suggested_tone && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{post.suggested_tone}</span>
        )}
        {post.suggested_cta_type && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{post.suggested_cta_type} CTA</span>
        )}
        {post.recommended_format && (
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">{post.recommended_format}</span>
        )}
      </div>
      {post.strategic_rationale && (
        <p className="text-[10px] text-muted-foreground italic">📝 {post.strategic_rationale}</p>
      )}

      {status === "published" && prediction && actualEngagementRate !== null && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[10px] font-semibold text-foreground">Prediction vs actual performance</span>
            <span className={cn(
              "text-[10px] font-medium",
              performanceDelta !== null && performanceDelta >= 0 ? "text-green-600" : "text-destructive"
            )}>
              {performanceDelta !== null && performanceDelta >= 0 ? "Over expected" : "Under expected"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div>
              <p className="text-muted-foreground">Predicted</p>
              <p className="font-semibold text-foreground">{prediction.predicted_score}/100</p>
            </div>
            <div>
              <p className="text-muted-foreground">Actual ER</p>
              <p className="font-semibold text-foreground">{actualEngagementRate.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-muted-foreground">Signal</p>
              <p className="font-semibold text-foreground">{actualPerformance.impressions || 0} views</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {performanceDelta !== null && performanceDelta >= 0
              ? "This angle outperformed the model. Double down on it in the next post."
              : "This post likely underperformed the expectation. Tighten the hook, CTA, or positioning before repeating it."}
          </p>
        </div>
      )}

      {prediction && status !== "published" && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-foreground">Prediction Details</span>
            <span className={cn("text-[10px] font-medium", getScoreLabel(prediction.predicted_score).color)}>
              {prediction.publish_recommendation}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 text-[10px]">
            {[
              { label: "Hook", value: prediction.hook_strength },
              { label: "Persona", value: prediction.persona_relevance },
              { label: "Clarity", value: prediction.clarity },
              { label: "Goal", value: prediction.goal_alignment },
              { label: "CTA", value: prediction.cta_alignment },
              { label: "Context", value: prediction.context_relevance },
            ].map((dim) => (
              <div key={dim.label} className="flex justify-between gap-1">
                <span className="text-muted-foreground">{dim.label}</span>
                <span className="text-foreground">{dim.value}</span>
              </div>
            ))}
          </div>
          {prediction.strongest_element && (
            <p className="text-[10px] text-green-600">✓ {prediction.strongest_element}</p>
          )}
          {prediction.weakest_element && (
            <p className="text-[10px] text-destructive">✗ {prediction.weakest_element}</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CampaignPostCard;
