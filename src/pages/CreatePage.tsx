import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, LayoutGrid, List, BarChart3 } from "lucide-react";
import KnowledgeInput, { KnowledgeContext } from "@/components/create/KnowledgeInput";
import IdeaBrief from "@/components/create/IdeaBrief";
import PostCard, { Post, PostScore } from "@/components/create/PostCard";
import ComparisonView from "@/components/create/ComparisonView";

type Idea = {
  id: string;
  idea_title: string | null;
  target_audience: string | null;
  objective: string | null;
  core_message: string | null;
  suggested_cta: string | null;
};

const CreatePage = () => {
  const { user } = useAuth();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "compare">("list");
  const [scores, setScores] = useState<Record<string, PostScore>>({});
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [scoring, setScoring] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeContext>({
    productDescription: "",
    features: "",
    targetAudience: "",
  });

  const handleGenerate = async () => {
    if (!instruction.trim() || !user) return;
    setLoading(true);
    setIdea(null);
    setPosts([]);
    setScores({});
    setSelectedPostId(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          instruction: instruction.trim(),
          knowledge: knowledge.productDescription || knowledge.features || knowledge.targetAudience
            ? knowledge
            : undefined,
        },
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

  const handleScore = async () => {
    if (posts.length === 0) return;
    setScoring(true);
    try {
      const { data, error } = await supabase.functions.invoke("score-posts", {
        body: { posts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const scoreMap: Record<string, PostScore> = {};
      data.scores?.forEach((s: PostScore) => {
        scoreMap[s.post_id] = s;
      });
      setScores(scoreMap);
      toast.success("Posts scored!");
    } catch (err: any) {
      toast.error(err.message || "Scoring failed");
    } finally {
      setScoring(false);
    }
  };

  const handlePostUpdate = (updated: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  };

  return (
    <div className="content-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Create</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe what you want to promote — get 4 LinkedIn posts instantly.
        </p>
      </div>

      {/* Knowledge Input */}
      <KnowledgeInput value={knowledge} onChange={setKnowledge} />

      {/* Instruction Input */}
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
          <Button onClick={handleGenerate} disabled={loading || !instruction.trim()} size="sm">
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
      {idea && <IdeaBrief idea={idea} />}

      {/* Posts */}
      {posts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-foreground">4 Variations</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleScore}
                disabled={scoring}
                className="h-8 text-xs"
              >
                {scoring ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <BarChart3 className="mr-1 h-3.5 w-3.5" />
                )}
                Score
              </Button>
              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "list"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("compare")}
                className={`rounded-md p-1.5 transition-colors ${
                  viewMode === "compare"
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {viewMode === "compare" && idea ? (
            <ComparisonView
              posts={posts}
              ideaId={idea.id}
              userId={user!.id}
              scores={scores}
              selectedId={selectedPostId}
              onSelect={setSelectedPostId}
              onPostUpdate={handlePostUpdate}
            />
          ) : (
            <div className="space-y-4">
              {posts
                .sort((a, b) => a.variation_number - b.variation_number)
                .map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    ideaId={idea!.id}
                    userId={user!.id}
                    score={scores[post.id]}
                    onPostUpdate={handlePostUpdate}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreatePage;
