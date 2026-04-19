// "Mark as Posted" dialog — captures actual posted timestamp + LinkedIn URL,
// triggers AI signal evaluation for the closed-loop learning system.

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draftId?: string | null;
  postPlanId?: string | null;
  campaignId?: string | null;
  content?: string;
  hookType?: string | null;
  postStyle?: string | null;
  ctaType?: string | null;
  format?: string | null;
  phase?: string | null;
  onMarked?: () => void;
};

const MarkPostedDialog = (props: Props) => {
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data: authData } = await supabase.auth.getUser();
      const currentUser = authData.user;
      if (!currentUser) throw new Error("You need to be signed in");

      let linkedPostId: string | null = null;

      if (props.draftId) {
        const { data: existingLinkedPost } = await supabase
          .from("linkedin_posts")
          .select("id")
          .eq("linked_draft_id", props.draftId)
          .maybeSingle();

        const linkedinPayload = {
          user_id: currentUser.id,
          linked_draft_id: props.draftId,
          content: props.content || "",
          post_url: url || null,
          publish_date: now,
          source_type: "manual",
        };

        if (existingLinkedPost?.id) {
          linkedPostId = existingLinkedPost.id;
          const { error: linkedPostError } = await supabase
            .from("linkedin_posts")
            .update(linkedinPayload)
            .eq("id", existingLinkedPost.id);
          if (linkedPostError) throw linkedPostError;
        } else {
          const { data: createdLinkedPost, error: linkedPostError } = await supabase
            .from("linkedin_posts")
            .insert(linkedinPayload)
            .select("id")
            .single();
          if (linkedPostError) throw linkedPostError;
          linkedPostId = createdLinkedPost.id;
        }

        const { data: existingMetrics } = await supabase
          .from("post_metrics")
          .select("id")
          .eq("linkedin_post_id", linkedPostId)
          .maybeSingle();

        const metricsPayload = {
          user_id: currentUser.id,
          linkedin_post_id: linkedPostId,
          impressions: 0,
          reactions: 0,
          comments: 0,
          reposts: 0,
          clicks: 0,
          profile_visits: 0,
          follower_gain: 0,
          source: "manual",
          manual_notes: null,
          last_updated_at: now,
        };

        if (existingMetrics?.id) {
          const { error: metricsError } = await supabase
            .from("post_metrics")
            .update(metricsPayload)
            .eq("id", existingMetrics.id);
          if (metricsError) throw metricsError;
        } else {
          const { error: metricsError } = await supabase.from("post_metrics").insert(metricsPayload);
          if (metricsError) throw metricsError;
        }
      }

      // 1. Update draft -> posted
      if (props.draftId) {
        await supabase.from("drafts").update({ status: "posted" }).eq("id", props.draftId);
      }

      // 2. Update post plan -> posted + url
      if (props.postPlanId) {
        await supabase.from("campaign_post_plans").update({
          status: "posted",
          posted_at: now,
          posted_url: url || null,
          linked_post_id: linkedPostId,
        }).eq("id", props.postPlanId);
      }

      // 3. Fire AI signal evaluation (non-blocking-ish but awaited for toast accuracy)
      try {
        await supabase.functions.invoke("evaluate-post-signal", {
          body: {
            post_plan_id: props.postPlanId,
            draft_id: props.draftId,
            campaign_id: props.campaignId,
            content: props.content,
            hook_type: props.hookType,
            post_style: props.postStyle,
            cta_type: props.ctaType,
            format: props.format,
            phase: props.phase,
          },
        });
      } catch (e) {
        console.warn("signal eval skipped", e);
      }

      // 4. Tick execution state
      if (props.campaignId) {
        try {
          await supabase.functions.invoke("execution-tick", { body: { campaign_id: props.campaignId } });
        } catch { /* ignore */ }
      }

      toast.success("Marked as posted");
      props.onMarked?.();
      props.onOpenChange(false);
      setUrl("");
    } catch (e: any) {
      toast.error(e.message || "Failed to mark posted");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark as posted</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirms publication and triggers AI evaluation of engagement quality + conversion intent.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="url" className="text-xs">LinkedIn post URL <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Confirm posted
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MarkPostedDialog;
