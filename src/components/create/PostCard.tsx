import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, BookmarkPlus, RefreshCw, ChevronDown,
  Minus, User, Zap, Package, Loader2,
  BookOpen, MessageSquare, Shuffle, Eye, AlertTriangle, BarChart3, Bold,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
};

export type PostScore = {
  post_id: string;
  hook_strength: number;
  clarity: number;
  business_relevance: number;
  engagement_potential: number;
  overall: number;
};

const styleLabels: Record<string, string> = {
  product_insight: "Product Insight",
  pain_solution: "Pain → Solution",
  founder_tone: "Founder Tone",
  educational: "Educational",
  soft_promotion: "Soft Promotion",
};

type Props = {
  post: Post;
  ideaId: string;
  userId: string;
  score?: PostScore;
  selected?: boolean;
  onSelect?: () => void;
  onPostUpdate: (updated: Post) => void;
  compact?: boolean;
};

const PostCard = ({ post, ideaId, userId, score, selected, onSelect, onPostUpdate, compact }: Props) => {
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

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

  const rewritePost = async (action: string) => {
    setRewriting(action);
    try {
      const { data, error } = await supabase.functions.invoke("rewrite-post", {
        body: { post_id: post.id, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      onPostUpdate(data.post);
      toast.success("Post updated");
    } catch (err: any) {
      toast.error(err.message || "Rewrite failed");
    } finally {
      setRewriting(null);
    }
  };

  const isRewriting = rewriting !== null;

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
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-secondary text-xs font-medium text-secondary-foreground">
            {post.variation_number}
          </span>
          <span className="text-xs text-muted-foreground">
            {styleLabels[post.post_style] || post.post_style}
          </span>
          {post.tone && (
            <span className="text-xs text-muted-foreground">· {post.tone}</span>
          )}
          {score && (
            <span className="ml-1 inline-flex items-center rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {score.overall}
            </span>
          )}
        </div>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
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

      {/* First comment */}
      {post.first_comment && !compact && (
        <div className="rounded-md bg-secondary p-3">
          <p className="text-xs text-muted-foreground mb-1">Suggested first comment</p>
          <p className="text-xs text-secondary-foreground">{post.first_comment}</p>
        </div>
      )}

      {/* Scores */}
      {score && (
        <div className="space-y-1 pt-1">
          <ScoreBar label="Hook" value={score.hook_strength} />
          <ScoreBar label="Clarity" value={score.clarity} />
          <ScoreBar label="Relevance" value={score.business_relevance} />
          <ScoreBar label="Engage" value={score.engagement_potential} />
        </div>
      )}
    </div>
  );
};

export default PostCard;
