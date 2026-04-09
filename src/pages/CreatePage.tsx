import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Sparkles, LayoutGrid, List, FileText, Image, Layers, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import KnowledgeInput, { KnowledgeContext } from "@/components/create/KnowledgeInput";
import IdeaBrief from "@/components/create/IdeaBrief";
import PostCard, { Post } from "@/components/create/PostCard";
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
type CampaignOption = { id: string; name: string; language?: string };

type PostType = "text" | "image_text" | "carousel";

const postTypeOptions: { value: PostType; label: string; icon: any; description: string }[] = [
  { value: "text", label: "Text", icon: FileText, description: "Standard text-only post" },
  { value: "image_text", label: "Image + Text", icon: Image, description: "Post with an image brief" },
  { value: "carousel", label: "Carousel", icon: Layers, description: "Multi-slide carousel post (5-10 slides)" },
];

const CreatePage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [idea, setIdea] = useState<Idea | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "compare">("list");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [postType, setPostType] = useState<PostType>("text");
  const [language, setLanguage] = useState<"english" | "bangla">("english");
  const [knowledge, setKnowledge] = useState<KnowledgeContext>({
    productDescription: "",
    features: "",
  });

  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(searchParams.get("campaign_id") || "");
  const [postPlan, setPostPlan] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("audience_personas").select("id, name").order("name").then(({ data }) => setPersonas((data || []) as PersonaOption[]));
    supabase.from("campaigns").select("id, name, language").eq("is_active", true).order("name").then(({ data }) => setCampaigns((data || []) as CampaignOption[]));
    supabase.from("business_profiles").select("product_summary, product_features").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data) {
        setKnowledge({
          productDescription: data.product_summary || "",
          features: Array.isArray(data.product_features) ? (data.product_features as string[]).join(", ") : "",
        });
      }
    });

    // Load idea if provided via query param
    const ideaId = searchParams.get("idea");
    if (ideaId) {
      supabase.from("ideas").select("*").eq("id", ideaId).single().then(({ data }) => {
        if (data) {
          setInstruction(data.instruction || "");
          // Pre-fill idea brief
          setIdea({
            id: data.id,
            idea_title: data.idea_title,
            target_audience: data.target_audience,
            objective: data.objective,
            core_message: data.core_message,
            suggested_cta: data.suggested_cta,
            persona_fit: data.persona_fit,
            emotional_trigger: data.emotional_trigger,
            resonance_reason: data.resonance_reason,
          });
          // Load existing posts for this idea
          supabase.from("posts").select("*").eq("idea_id", ideaId).order("variation_number").then(({ data: postsData }) => {
            if (postsData && postsData.length > 0) {
              setPosts(postsData as Post[]);
            }
          });
        }
      });
    }

    // Load post plan if provided
    const planId = searchParams.get("post_plan_id");
    if (planId) {
      supabase.from("campaign_post_plans").select("*").eq("id", planId).single().then(({ data }) => {
        if (data) {
          setPostPlan(data);
          if (data.content_angle) setInstruction(data.content_angle);
          if (data.recommended_format) setPostType(data.recommended_format as PostType);
        }
      });
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
    if (!instruction.trim()) {
      toast.error("Please add specific instructions");
      return;
    }
    setLoading(true);
    setIdea(null);
    setPosts([]);
    setSelectedPostId(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          instruction: instruction.trim(),
          knowledge: knowledge.productDescription || knowledge.features
            ? knowledge
            : undefined,
          persona_id: selectedPersonaId || undefined,
          campaign_id: selectedCampaignId || undefined,
          post_type: postType,
          language,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setIdea(data.idea);
      setPosts(data.posts);
      toast.success("Content generated! Click 📊 on any variation to analyze performance.");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate content");
    } finally {
      setLoading(false);
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
            Select a persona, campaign, and post type, then describe what you want to promote.
          </p>
        </div>

        {/* Post Plan Banner */}
        {postPlan && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
            <p className="text-xs font-medium text-primary">📋 Campaign Post Plan — Post {postPlan.post_number}, Week {postPlan.week_number}</p>
            <p className="text-xs text-foreground">{postPlan.post_objective}</p>
            {postPlan.strategic_rationale && <p className="text-[10px] text-muted-foreground italic">{postPlan.strategic_rationale}</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {postPlan.suggested_hook_type && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{postPlan.suggested_hook_type}</span>}
              {postPlan.suggested_tone && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{postPlan.suggested_tone}</span>}
              {postPlan.suggested_cta_type && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{postPlan.suggested_cta_type} CTA</span>}
            </div>
          </div>
        )}

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
            <Select value={selectedCampaignId} onValueChange={(v) => {
              setSelectedCampaignId(v);
              const camp = campaigns.find((c) => c.id === v);
              if (camp?.language) setLanguage(camp.language as "english" | "bangla");
            }}>
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

          {/* Language Selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Language
            </label>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: "english" as const, label: "🇺🇸 English" },
                { value: "bangla" as const, label: "🇧🇩 Bangla" },
              ]).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLanguage(opt.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    language === opt.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post Type Selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Post Type</label>
            <div className="grid grid-cols-3 gap-2">
              {postTypeOptions.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setPostType(opt.value)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors ${
                      postType === opt.value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {postTypeOptions.find((o) => o.value === postType)?.description}
            </p>
          </div>
        </div>

        {/* Knowledge Input */}
        <KnowledgeInput value={knowledge} onChange={setKnowledge} />

        {/* Instruction Input */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1">
            <label className="text-xs font-medium text-foreground">Specific Instructions <span className="text-destructive">*</span></label>
          </div>
          <Textarea
            placeholder='e.g. "Focus on reducing support tickets" or "Highlight the AI chatbot feature for ecommerce brands"'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
            className={`resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:ring-0 ${!instruction.trim() ? "border-destructive/50" : ""}`}
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{instruction.length}/600</span>
            <Button onClick={handleGenerate} disabled={loading || !instruction.trim() || !selectedPersonaId || selectedPersonaId === "none" || !selectedCampaignId || selectedCampaignId === "none"} size="sm">
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
        <div className="flex-1 min-w-0 overflow-y-auto space-y-5 px-6 py-8">
          {/* Idea Brief */}
          {idea && <IdeaBrief idea={idea} />}

          {/* Posts */}
          {posts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-foreground">4 Variations</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setViewMode("list")} className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <List className="h-4 w-4" />
                  </button>
                  <button onClick={() => setViewMode("compare")} className={`rounded-md p-1.5 transition-colors ${viewMode === "compare" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {viewMode === "compare" && idea ? (
                <ComparisonView posts={posts} ideaId={idea.id} userId={user!.id} selectedId={selectedPostId} onSelect={setSelectedPostId} onPostUpdate={handlePostUpdate} />
              ) : (
                <div className="space-y-4">
                  {posts.sort((a, b) => a.variation_number - b.variation_number).map((post) => (
                    <PostCard key={post.id} post={post} ideaId={idea!.id} userId={user!.id} onPostUpdate={handlePostUpdate} />
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
