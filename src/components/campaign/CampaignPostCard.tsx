import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Clock, PenLine, Check, Eye, BarChart3, Loader2,
  ArrowRight, CheckCircle, AlertTriangle, ShieldCheck, ShieldAlert,
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

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
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
          {/* Predict button for drafted posts */}
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
          {/* Actions based on status */}
          {status === "planned" && (
            <Link
              to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PenLine className="h-3 w-3" /> Create
            </Link>
          )}
          {status === "drafted" && post.linked_draft_id && (
            <div className="flex items-center gap-2">
              <Link
                to={`/drafts?highlight=${post.linked_draft_id}`}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Eye className="h-3 w-3" /> View
              </Link>
              <Link
                to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}&edit_draft=${post.linked_draft_id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <PenLine className="h-3 w-3" /> Edit
              </Link>
            </div>
          )}
          {status === "published" && post.linked_post_id && (
            <Link
              to={`/performance/${post.linked_post_id}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Eye className="h-3 w-3" /> View Post
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
      {/* Prediction details */}
      {prediction && (
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
              <div key={dim.label} className="flex justify-between">
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
