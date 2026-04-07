import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, LayoutGrid, List, BarChart3 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  persona_fit: string | null;
  emotional_trigger: string | null;
  resonance_reason: string | null;
};

type PersonaOption = { id: string; name: string };
type CampaignOption = { id: string; name: string };

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

  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");

  useEffect(() => {
    if (user) {
      supabase.from("audience_personas").select("id, name").order("name").then(({ data }) => setPersonas((data || []) as PersonaOption[]));
      supabase.from("campaigns").select("id, name").eq("is_active", true).order("name").then(({ data }) => setCampaigns((data || []) as CampaignOption[]));
    }
  }, [user]);

  const handleGenerate = async () => {
    if (!user) return;
    if (!selectedPersonaId || selectedPersonaId === "none") {
      toast.error("Please select a target persona");
      return;
    }
    if (!selectedCampaignId || selectedCampaignId === "none") {
      toast.error("Please select a campaign");
      return;
    }
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
          persona_id: selectedPersonaId || undefined,
          campaign_id: selectedCampaignId || undefined,
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

  const hasOutput = idea || posts.length > 0;

  return (
    <div className="content-fade-in flex h-full">
      {/* Left column — Input */}
      <div className={`space-y-5 overflow-y-auto transition-all duration-300 ${hasOutput ? "w-[380px] min-w-[340px] shrink-0 border-r border-border px-6 py-8" : "mx-auto w-full max-w-2xl px-6 py-8"}`}>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Create</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a persona and campaign, then describe what you want to promote.
          </p>
        </div>

        {/* Strategy Selectors */}
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Target Persona <span className="text-destructive">*</span></label>
            <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
              <SelectTrigger className={`text-sm ${!selectedPersonaId || selectedPersonaId === "none" ? "border-destructive/50" : ""}`}>
                <SelectValue placeholder="Select persona" />
              </SelectTrigger>
              <SelectContent>
                {personas.length === 0 ? (
                  <SelectItem value="none" disabled>No personas — create one in Audience</SelectItem>
                ) : (
                  personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Campaign <span className="text-destructive">*</span></label>
            <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
              <SelectTrigger className={`text-sm ${!selectedCampaignId || selectedCampaignId === "none" ? "border-destructive/50" : ""}`}>
                <SelectValue placeholder="Select campaign" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.length === 0 ? (
                  <SelectItem value="none" disabled>No campaigns — create one in Strategy</SelectItem>
                ) : (
                  campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Knowledge Input */}
        <KnowledgeInput value={knowledge} onChange={setKnowledge} />

        {/* Instruction Input */}
        <div className="rounded-lg border border-border bg-card p-4">
          <Textarea
            placeholder='Optional: add specific instructions (e.g. "Focus on reducing support tickets")'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            className="resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{instruction.length}/600</span>
            <Button onClick={handleGenerate} disabled={loading || !selectedPersonaId || selectedPersonaId === "none" || !selectedCampaignId || selectedCampaignId === "none"} size="sm">
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
      </div>

      {/* Right column — Output */}
      {hasOutput && (
        <div className="flex-1 min-w-0 overflow-y-auto space-y-5">
          {/* Idea Brief */}
          {idea && <IdeaBrief idea={idea} />}

          {/* Posts */}
          {posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">4 Variations</h2>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={handleScore} disabled={scoring} className="h-8 text-xs">
                    {scoring ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="mr-1 h-3.5 w-3.5" />}
                    Score
                  </Button>
                  <button onClick={() => setViewMode("list")} className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <List className="h-4 w-4" />
                  </button>
                  <button onClick={() => setViewMode("compare")} className={`rounded-md p-1.5 transition-colors ${viewMode === "compare" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {viewMode === "compare" && idea ? (
                <ComparisonView posts={posts} ideaId={idea.id} userId={user!.id} scores={scores} selectedId={selectedPostId} onSelect={setSelectedPostId} onPostUpdate={handlePostUpdate} />
              ) : (
                <div className="space-y-4">
                  {posts.sort((a, b) => a.variation_number - b.variation_number).map((post) => (
                    <PostCard key={post.id} post={post} ideaId={idea!.id} userId={user!.id} score={scores[post.id]} onPostUpdate={handlePostUpdate} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreatePage;
