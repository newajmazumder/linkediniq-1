// Campaign post card — the source-of-truth view for a single planned post
// inside the campaign Plan tab.
//
// Renders the full execution lifecycle:
//   planned → drafted → scheduled → posted   (or → missed)
//
// Each state shows the right action so the campaign view always reflects
// real execution instead of being stuck on "Create now".

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Clock, PenLine, Check, Eye, BarChart3, Loader2, ExternalLink,
  AlertTriangle, ShieldCheck, ShieldAlert, Send, CalendarClock, XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import MarkPostedDialog from "@/components/strategy/MarkPostedDialog";
import DraftPreviewDialog from "@/components/campaign/DraftPreviewDialog";
import { deriveCampaignPostLifecycle, extractCampaignPostPreview } from "@/lib/campaign-posts";

type PostPlan = {
  id: string;
  campaign_id: string;
  post_number: number;
  week_number: number;
  status: string | null;
  phase?: string | null;
  post_objective: string | null;
  content_angle: string | null;
  suggested_hook_type: string | null;
  suggested_tone: string | null;
  suggested_cta_type: string | null;
  recommended_format: string | null;
  strategic_rationale: string | null;
  linked_draft_id: string | null;
  linked_post_id: string | null;
  posted_at?: string | null;
  posted_url?: string | null;
  planned_date?: string | null;
};

const statusMeta: Record<string, { label: string; cls: string; Icon: any }> = {
  planned:   { label: "planned",   cls: "bg-muted text-muted-foreground",        Icon: Clock },
  drafted:   { label: "drafted",   cls: "bg-yellow-500/10 text-yellow-600",      Icon: PenLine },
  scheduled: { label: "scheduled", cls: "bg-blue-500/10 text-blue-600",          Icon: CalendarClock },
  posted:    { label: "posted",    cls: "bg-green-500/10 text-green-600",        Icon: Check },
  missed:    { label: "missed",    cls: "bg-destructive/10 text-destructive",    Icon: XCircle },
};

const getScoreLabel = (score: number) => {
  if (score >= 80) return { label: "Strong", color: "text-green-600", icon: ShieldCheck };
  if (score >= 60) return { label: "Decent", color: "text-yellow-600", icon: AlertTriangle };
  return { label: "Weak", color: "text-destructive", icon: ShieldAlert };
};

const CampaignPostCard = ({
  post,
  campaignId,
  onChange,
}: {
  post: PostPlan;
  campaignId: string;
  /** Called after status-changing actions so the parent Plan view can refetch. */
  onChange?: () => void;
}) => {
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<any>(null);
  const [actualPerformance, setActualPerformance] = useState<any>(null);
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [draftScheduledAt, setDraftScheduledAt] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftUpdatedAt, setDraftUpdatedAt] = useState<string | null>(null);
  // Resolved linkedin_posts id — falls back to lookup by draft_id when the plan
  // row hasn't been backfilled with linked_post_id yet.
  const [resolvedLinkedPostId, setResolvedLinkedPostId] = useState<string | null>(null);
  const [markOpen, setMarkOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Load downstream signals when a draft has been linked.
  useEffect(() => {
    const load = async () => {
      if (!post.linked_draft_id) {
        setResolvedLinkedPostId(post.linked_post_id || null);
        return;
      }
      const [{ data: draftRow }, { data: predictionData }, { data: actualData }, { data: linkedinRow }] = await Promise.all([
        supabase.from("drafts").select("status, scheduled_at, custom_content, updated_at").eq("id", post.linked_draft_id).maybeSingle(),
        supabase.from("prediction_scores").select("*").eq("draft_id", post.linked_draft_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("post_performance").select("*").eq("draft_id", post.linked_draft_id).maybeSingle(),
        supabase.from("linkedin_posts").select("id").eq("linked_draft_id", post.linked_draft_id).maybeSingle(),
      ]);
      if (draftRow) {
        setDraftStatus(draftRow.status);
        setDraftScheduledAt(draftRow.scheduled_at);
        setDraftContent(draftRow.custom_content);
        setDraftUpdatedAt(draftRow.updated_at);
      }
      if (predictionData) setPrediction(predictionData);
      if (actualData) setActualPerformance(actualData);
      setResolvedLinkedPostId(post.linked_post_id || linkedinRow?.id || null);
    };
    load();
  }, [post.linked_draft_id, post.status, post.linked_post_id]);

  // Reconcile plan status with linked draft status:
  //   draft.scheduled → plan.scheduled
  //   draft.posted    → plan.posted (handled via MarkPostedDialog already)
  // This keeps the Plan view honest if the user changed status from /drafts.
  useEffect(() => {
    if (!post.linked_draft_id || !draftStatus) return;
    const planStatus = post.status || "planned";
    const promote =
      draftStatus === "scheduled" && planStatus === "drafted"
        ? { status: "scheduled" as const }
        : null;
    if (promote) {
      supabase.from("campaign_post_plans").update(promote).eq("id", post.id).then(() => onChange?.());
    }
  }, [draftStatus, post.id, post.linked_draft_id, post.status]);

  const fetchPrediction = async () => {
    if (!post.linked_draft_id) return;
    setPredicting(true);
    try {
      const { data, error } = await supabase.functions.invoke("predict-score", {
        body: { draft_id: post.linked_draft_id },
      });
      if (error) throw error;
      setPrediction(data);
    } catch {
      toast.error("Failed to get prediction");
    } finally {
      setPredicting(false);
    }
  };

  const status = deriveCampaignPostLifecycle({
    planStatus: post.status,
    linkedDraftId: post.linked_draft_id,
    linkedPostId: resolvedLinkedPostId,
    draftStatus,
    scheduledAt: draftScheduledAt,
  }) as keyof typeof statusMeta;
  const meta = statusMeta[status] || statusMeta.planned;
  const StatusIcon = meta.Icon;
  const preview = extractCampaignPostPreview(draftContent);

  const actualEngagementRate = actualPerformance?.impressions
    ? (((actualPerformance.likes || 0) + (actualPerformance.comments || 0) + (actualPerformance.saves || 0)) / actualPerformance.impressions) * 100
    : null;
  const expectedEngagementRate = prediction?.predicted_score >= 80 ? 4 : prediction?.predicted_score >= 60 ? 2.5 : 1.5;
  const performanceDelta = actualEngagementRate !== null && prediction
    ? actualEngagementRate - expectedEngagementRate
    : null;

  return (
    <div className={cn(
      "rounded-md border bg-background p-3 space-y-1.5",
      status === "missed" ? "border-destructive/30" :
      status === "posted" ? "border-green-500/30" :
      "border-border",
    )}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="text-xs font-medium text-foreground">Post {post.post_number}</span>
          <Badge variant="outline" className={cn("text-[10px] gap-0.5", meta.cls)}>
            <StatusIcon className="h-2.5 w-2.5" />
            {meta.label}
          </Badge>
          {prediction && (() => {
            const info = getScoreLabel(prediction.predicted_score);
            const Icon = info.icon;
            return (
              <Badge variant="outline" className={cn("text-[10px] gap-0.5", info.color)}>
                <Icon className="h-2.5 w-2.5" />
                {prediction.predicted_score}/100
              </Badge>
            );
          })()}
          {post.posted_at && (
            <span className="text-[10px] text-muted-foreground">
              · posted {new Date(post.posted_at).toLocaleDateString()}
            </span>
          )}
          {!post.posted_at && draftUpdatedAt && (status === "drafted" || status === "scheduled") && (
            <span className="text-[10px] text-muted-foreground">
              · updated {new Date(draftUpdatedAt).toLocaleString()}
            </span>
          )}
        </div>

        {/* Right-side action — the most important affordance per state */}
        <div className="flex items-center gap-2 shrink-0">
          {status === "planned" && (
            <Link
              to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PenLine className="h-3 w-3" /> Create now
            </Link>
          )}

          {(status === "drafted" || status === "scheduled") && post.linked_draft_id && (
            <>
              <button
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <Eye className="h-3 w-3" /> View
              </button>
              <Link
                to={`/create?draft_id=${post.linked_draft_id}&mode=edit&campaign_id=${campaignId}&post_plan_id=${post.id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <PenLine className="h-3 w-3" /> Edit
              </Link>
              <button
                onClick={() => setMarkOpen(true)}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
                title="Mark as posted to start measuring outcome"
              >
                <Send className="h-3 w-3" /> Mark posted
              </button>
              <Link
                to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <PenLine className="h-3 w-3" /> Duplicate
              </Link>
            </>
          )}

          {status === "posted" && (
            <>
              {post.linked_draft_id && (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <Eye className="h-3 w-3" /> View
                </button>
              )}
              {post.posted_url && (
                <a
                  href={post.posted_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> View post
                </a>
              )}
              <Link
                to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                <PenLine className="h-3 w-3" /> Duplicate
              </Link>
              <Link
                to={resolvedLinkedPostId ? `/performance/${resolvedLinkedPostId}` : "/performance"}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <BarChart3 className="h-3 w-3" /> Performance
              </Link>
            </>
          )}

          {status === "missed" && (
            <Link
              to={`/create?campaign_id=${campaignId}&post_plan_id=${post.id}`}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <PenLine className="h-3 w-3" /> Recover
            </Link>
          )}

          {status === "drafted" && post.linked_draft_id && !prediction && (
            <button
              onClick={fetchPrediction}
              disabled={predicting}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Predict performance"
            >
              {predicting ? <Loader2 className="h-3 w-3 animate-spin" /> : <BarChart3 className="h-3 w-3" />}
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-foreground">{post.post_objective}</p>
      <p className="text-[10px] text-muted-foreground">{post.content_angle}</p>
      {(preview.title || preview.snippet || preview.cta || draftScheduledAt) && (
        <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
          {preview.title && <p className="text-xs font-medium text-foreground line-clamp-1">{preview.title}</p>}
          {preview.snippet && <p className="text-[11px] text-muted-foreground line-clamp-2">{preview.snippet}</p>}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            {preview.cta && <span>CTA: <span className="text-foreground">{preview.cta}</span></span>}
            {draftScheduledAt && status === "scheduled" && <span>Scheduled: <span className="text-foreground">{new Date(draftScheduledAt).toLocaleString()}</span></span>}
          </div>
        </div>
      )}
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

      {status === "posted" && prediction && actualEngagementRate !== null && (
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
        </div>
      )}

      {prediction && status !== "posted" && (
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

      <MarkPostedDialog
        open={markOpen}
        onOpenChange={setMarkOpen}
        draftId={post.linked_draft_id}
        postPlanId={post.id}
        campaignId={campaignId}
        content={draftContent || undefined}
        hookType={post.suggested_hook_type}
        ctaType={post.suggested_cta_type}
        format={post.recommended_format}
        phase={post.phase}
        onMarked={onChange}
      />

      <DraftPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        draftId={post.linked_draft_id}
        campaignId={campaignId}
        postPlanId={post.id}
        postNumber={post.post_number}
        weekNumber={post.week_number}
        phase={post.phase}
        cachedContent={draftContent}
        postedUrl={post.posted_url}
        onMarkPosted={status !== "posted" ? () => setMarkOpen(true) : undefined}
      />
    </div>
  );
};

export default CampaignPostCard;
