// Modal preview for a saved draft.
//
// Why this exists:
//   The campaign Plan view's "View" action used to redirect users to the full
//   /create editor in view mode, which restarted the entire post creation flow
//   visually and felt disorienting. For a quick "what does this draft look
//   like?" check, users want a LinkedIn-style preview right where they are.
//
// What it shows:
//   • LinkedIn-style rendered post (text, image+text, or carousel)
//   • Plan / draft context (campaign post number, week, status, last updated)
//   • Quick actions to jump into Edit mode or Mark as posted
//
// Editing still routes to /create?draft_id=…&mode=edit — we only short-circuit
// the read-only "View" action.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PenLine, Send, ExternalLink, Loader2 } from "lucide-react";
import PostPreview from "@/components/create/LinkedInPostPreview";

type DraftRow = {
  id: string;
  status: string | null;
  scheduled_at: string | null;
  custom_content: string | null;
  selected_post_id: string | null;
  updated_at: string | null;
};

type PostRow = {
  id: string;
  hook: string;
  body: string;
  cta: string;
  first_comment: string | null;
  post_type: string | null;
  image_briefs: any;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Draft id to preview. */
  draftId: string | null;
  /** Plan context shown in the dialog header. */
  campaignId?: string;
  postPlanId?: string;
  postNumber?: number;
  weekNumber?: number;
  phase?: string | null;
  /** Optional pre-fetched draft content to skip the round-trip when caller has it. */
  cachedContent?: string | null;
  /** Optional URL of the published post if already marked posted. */
  postedUrl?: string | null;
  /** Optional handler for the Mark Posted action — opens the existing dialog. */
  onMarkPosted?: () => void;
};

const splitContent = (content: string) => {
  const blocks = content.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  if (blocks.length === 0) return { hook: "", body: "", cta: "" };
  if (blocks.length === 1) return { hook: blocks[0], body: "", cta: "" };
  if (blocks.length === 2) return { hook: blocks[0], body: blocks[1], cta: "" };
  return {
    hook: blocks[0],
    body: blocks.slice(1, -1).join("\n\n"),
    cta: blocks[blocks.length - 1],
  };
};

const DraftPreviewDialog = ({
  open,
  onOpenChange,
  draftId,
  campaignId,
  postPlanId,
  postNumber,
  weekNumber,
  phase,
  cachedContent,
  postedUrl,
  onMarkPosted,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftRow | null>(null);
  const [post, setPost] = useState<PostRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !draftId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: draftRow, error: draftErr } = await supabase
        .from("drafts")
        .select("id, status, scheduled_at, custom_content, selected_post_id, updated_at")
        .eq("id", draftId)
        .maybeSingle();
      if (cancelled) return;
      if (draftErr || !draftRow) {
        setError("This draft could not be found.");
        setDraft(null);
        setPost(null);
        setLoading(false);
        return;
      }
      setDraft(draftRow as DraftRow);

      // If linked to a generated post variation, hydrate from it so we can
      // render image briefs / carousel slides correctly.
      if (draftRow.selected_post_id) {
        const { data: postRow } = await supabase
          .from("posts")
          .select("id, hook, body, cta, first_comment, post_type, image_briefs")
          .eq("id", draftRow.selected_post_id)
          .maybeSingle();
        if (cancelled) return;
        if (postRow) setPost(postRow as PostRow);
      } else {
        setPost(null);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, draftId]);

  // Compose the rendered post.
  const rawContent = draft?.custom_content ?? cachedContent ?? "";
  const split = splitContent(rawContent);
  const hook = split.hook || post?.hook || "";
  const body = split.body || post?.body || "";
  const cta = split.cta || post?.cta || "";
  const fullText = [hook, body, cta].filter(Boolean).join("\n\n");

  const postType = (post?.post_type as "text" | "image_text" | "carousel") || "text";
  const imageBriefs = Array.isArray(post?.image_briefs) ? post?.image_briefs : null;
  const slidesCount = postType === "carousel" ? (imageBriefs?.length || 5) : 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <span>Draft preview</span>
            {typeof postNumber === "number" && typeof weekNumber === "number" && (
              <Badge variant="outline" className="text-[10px]">
                Week {weekNumber} · Post {postNumber}
              </Badge>
            )}
            {phase && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {String(phase).replace(/_/g, " ")}
              </Badge>
            )}
            {draft?.status && (
              <Badge variant="outline" className="text-[10px] capitalize">
                {draft.status}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-[11px]">
            {draft?.updated_at && (
              <span>Updated {new Date(draft.updated_at).toLocaleString()}</span>
            )}
            {draft?.scheduled_at && (
              <span>· Scheduled {new Date(draft.scheduled_at).toLocaleString()}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading draft…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && fullText && (
          <PostPreview
            type={postType}
            content={fullText}
            slidesCount={slidesCount}
            imageBriefs={imageBriefs}
            firstComment={post?.first_comment ?? null}
          />
        )}

        {!loading && !error && !fullText && (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            This draft has no content yet.
          </div>
        )}

        {/* Quick actions */}
        {!loading && !error && draftId && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            <Link
              to={`/create?draft_id=${draftId}&mode=edit${campaignId ? `&campaign_id=${campaignId}` : ""}${postPlanId ? `&post_plan_id=${postPlanId}` : ""}`}
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <PenLine className="h-3.5 w-3.5" /> Edit draft
            </Link>
            {onMarkPosted && draft?.status !== "posted" && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onMarkPosted();
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Send className="h-3.5 w-3.5" /> Mark as posted
              </button>
            )}
            {postedUrl && (
              <a
                href={postedUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open on LinkedIn
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DraftPreviewDialog;
