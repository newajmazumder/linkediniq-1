import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, Copy, BookmarkPlus, ChevronDown, ChevronUp } from "lucide-react";

type Post = {
  id: string;
  variation_number: number;
  hook: string;
  body: string;
  cta: string;
  first_comment: string | null;
  post_style: string;
  tone: string | null;
};

type Idea = {
  id: string;
  idea_title: string | null;
  target_audience: string | null;
  objective: string | null;
  core_message: string | null;
  suggested_cta: string | null;
};

const styleLabels: Record<string, string> = {
  product_insight: "Product Insight",
  pain_solution: "Pain → Solution",
  founder_tone: "Founder Tone",
  educational: "Educational",
  soft_promotion: "Soft Promotion",
};

const CreatePage = () => {
  const { user } = useAuth();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [expandedIdea, setExpandedIdea] = useState(true);
  const [savingDraft, setSavingDraft] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!instruction.trim() || !user) return;
    setLoading(true);
    setIdea(null);
    setPosts([]);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { instruction: instruction.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIdea(data.idea);
      setPosts(data.posts);
      toast.success("Content generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate content");
    } finally {
      setLoading(false);
    }
  };

  const copyPost = (post: Post) => {
    const text = `${post.hook}\n\n${post.body}\n\n${post.cta}`;
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const saveDraft = async (post: Post) => {
    if (!user || !idea) return;
    setSavingDraft(post.id);
    try {
      const fullContent = `${post.hook}\n\n${post.body}\n\n${post.cta}`;
      const { error } = await supabase.from("drafts").insert({
        user_id: user.id,
        idea_id: idea.id,
        selected_post_id: post.id,
        custom_content: fullContent,
        status: "draft",
      });
      if (error) throw error;
      toast.success("Saved to drafts");
    } catch (err: any) {
      toast.error(err.message || "Failed to save draft");
    } finally {
      setSavingDraft(null);
    }
  };

  return (
    <div className="content-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Create</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what you want to promote — get 4 LinkedIn posts instantly.
        </p>
      </div>

      {/* Input */}
      <div className="rounded-lg border border-border bg-card p-4">
        <Textarea
          placeholder='e.g. "Promote Chattrn chatbot for ecommerce"'
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={3}
          className="resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{instruction.length}/600</span>
          <Button
            onClick={handleGenerate}
            disabled={loading || !instruction.trim()}
            size="sm"
          >
            {loading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Idea Brief */}
      {idea && (
        <div className="rounded-lg border border-border bg-card">
          <button
            onClick={() => setExpandedIdea(!expandedIdea)}
            className="flex w-full items-center justify-between p-4 text-left"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{idea.idea_title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground capitalize">{idea.objective}</p>
            </div>
            {expandedIdea ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {expandedIdea && (
            <div className="border-t border-border px-4 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Audience</span>
                  <p className="text-foreground mt-0.5">{idea.target_audience}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">CTA</span>
                  <p className="text-foreground mt-0.5">{idea.suggested_cta}</p>
                </div>
              </div>
              <div className="text-xs">
                <span className="text-muted-foreground">Core message</span>
                <p className="text-foreground mt-0.5">{idea.core_message}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posts */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-foreground">4 Variations</h2>
          {posts
            .sort((a, b) => a.variation_number - b.variation_number)
            .map((post) => (
              <div key={post.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
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
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => copyPost(post)}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="Copy"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => saveDraft(post)}
                      disabled={savingDraft === post.id}
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                      title="Save to drafts"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-foreground">
                  <p className="font-medium">{post.hook}</p>
                  <p className="whitespace-pre-line leading-relaxed">{post.body}</p>
                  <p className="font-medium">{post.cta}</p>
                </div>

                {post.first_comment && (
                  <div className="rounded-md bg-secondary p-3">
                    <p className="text-xs text-muted-foreground mb-1">Suggested first comment</p>
                    <p className="text-xs text-secondary-foreground">{post.first_comment}</p>
                  </div>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default CreatePage;
