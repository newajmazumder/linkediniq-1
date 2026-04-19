import { useState, useEffect } from "react";
import { Swords, ArrowLeft, Eye, Pencil } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
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
type CampaignOption = { id: string; name: string; language?: string; market_context_id?: string };
type MarketContext = { id: string; region_code: string; region_name: string; audience_type: string; language_defaults: string[] };

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
  const [language, setLanguage] = useState<string>("english");
  const [marketContexts, setMarketContexts] = useState<MarketContext[]>([]);
  const [selectedMarketId, setSelectedMarketId] = useState<string>("");
  const [knowledge, setKnowledge] = useState<KnowledgeContext>({
    productDescription: "",
    features: "",
  });

  const [personas, setPersonas] = useState<PersonaOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(searchParams.get("campaign_id") || "");
  const [postPlan, setPostPlan] = useState<any>(null);
  const [competitorStrategy, setCompetitorStrategy] = useState<any>(null);

  // Draft view/edit support — when /create?draft_id=…&mode=view|edit is opened,
  // we hydrate the page from an existing draft instead of generating fresh
  // content. The lifecycle Plan → Create → Draft must round-trip cleanly:
  // clicking View/Edit on a campaign post must always land here.
  const draftIdParam = searchParams.get("draft_id");
  const modeParam = (searchParams.get("mode") as "view" | "edit" | null) || null;
  const isDraftMode = !!draftIdParam;
  const isViewMode = isDraftMode && modeParam !== "edit"; // default view when draft is loaded
  const isEditMode = isDraftMode && modeParam === "edit";
  const [draftRow, setDraftRow] = useState<any>(null);
  const [draftMissing, setDraftMissing] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("audience_personas").select("id, name").order("name").then(({ data }) => setPersonas((data || []) as PersonaOption[]));
    supabase.from("campaigns").select("id, name, language, market_context_id").eq("is_active", true).order("name").then(({ data }) => setCampaigns((data || []) as unknown as CampaignOption[]));
    supabase.from("market_contexts").select("id, region_code, region_name, audience_type, language_defaults").eq("is_preset", true).then(({ data }) => setMarketContexts((data || []) as MarketContext[]));
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
              setPosts(postsData as unknown as Post[]);
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

    // Load competitor strategy if coming from competitor intelligence
    const stored = sessionStorage.getItem("competitor_strategy");
    if (stored) {
      try {
        const strategy = JSON.parse(stored);
        setCompetitorStrategy(strategy);
        if (strategy.title) setInstruction(strategy.title);
        sessionStorage.removeItem("competitor_strategy");
        toast.success("Competitor strategy loaded! Customize and generate.");
      } catch { /* ignore */ }
    }
  }, [user]);

  // Hydrate the page from an existing draft when /create?draft_id=… is opened.
  // This is the canonical "View / Edit existing draft" entry point so the
  // campaign plan can round-trip Plan → Draft → View/Edit without 404ing.
  useEffect(() => {
    if (!user || !draftIdParam) return;
    setDraftLoading(true);
    setDraftMissing(false);
    (async () => {
      const { data: draft } = await supabase
        .from("drafts")
        .select("id, idea_id, selected_post_id, custom_content, status, scheduled_at, updated_at, ideas(idea_title, instruction, target_audience, objective, core_message, suggested_cta, persona_fit, emotional_trigger, resonance_reason)")
        .eq("id", draftIdParam)
        .maybeSingle();
      if (!draft) {
        setDraftMissing(true);
        setDraftLoading(false);
        return;
      }
      setDraftRow(draft);

      // Hydrate idea brief if linked.
      const ideaData: any = (draft as any).ideas;
      if (ideaData) {
        setInstruction(ideaData.instruction || "");
        setIdea({
          id: draft.idea_id,
          idea_title: ideaData.idea_title,
          target_audience: ideaData.target_audience,
          objective: ideaData.objective,
          core_message: ideaData.core_message,
          suggested_cta: ideaData.suggested_cta,
          persona_fit: ideaData.persona_fit,
          emotional_trigger: ideaData.emotional_trigger,
          resonance_reason: ideaData.resonance_reason,
        });
      }

      // Synthesize a Post from the saved draft content so PostCard can render it.
      const blocks = (draft.custom_content || "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
      const hook = blocks[0] || "";
      const cta = blocks.length > 1 ? blocks[blocks.length - 1] : "";
      const body = blocks.length > 2 ? blocks.slice(1, -1).join("\n\n") : "";

      // If the draft was generated from a real post variation, hydrate from that.
      let basePost: Post | null = null;
      if (draft.selected_post_id) {
        const { data: postRow } = await supabase.from("posts").select("*").eq("id", draft.selected_post_id).maybeSingle();
        if (postRow) basePost = postRow as unknown as Post;
      }

      const synthesized: Post = basePost
        ? { ...basePost, hook: hook || basePost.hook, body: body || basePost.body, cta: cta || basePost.cta }
        : {
            id: draft.selected_post_id || draft.id,
            variation_number: 1,
            hook,
            body,
            cta,
            first_comment: null,
            post_style: "founder_tone",
            tone: null,
            post_type: "text",
            image_briefs: null,
          };

      setPosts([synthesized]);
      setDraftLoading(false);
    })();
  }, [user, draftIdParam]);

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
          market_context_id: selectedMarketId || undefined,
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

  // Recoverable error path: draft id was given but the row no longer exists.
  // We never want to 404 — the user must be able to recreate or escape.
  if (draftMissing) {
    const planId = searchParams.get("post_plan_id");
    const campaignIdQ = searchParams.get("campaign_id");
    return (
      <div className="content-fade-in flex items-center justify-center px-6 py-12 h-full">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center space-y-3">
          <h2 className="text-lg font-semibold text-foreground">Draft not found</h2>
          <p className="text-sm text-muted-foreground">
            This draft could not be found. It may have been deleted. You can recreate it from the original campaign plan.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            {planId && (
              <Link
                to={`/create?post_plan_id=${planId}${campaignIdQ ? `&campaign_id=${campaignIdQ}` : ""}`}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                <Pencil className="h-3.5 w-3.5" /> Recreate draft
              </Link>
            )}
            {campaignIdQ && (
              <Link
                to={`/campaign/${campaignIdQ}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to campaign
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="content-fade-in flex flex-col md:flex-row h-full">
      {/* Left column — Input */}
      <div className={`space-y-5 overflow-y-auto transition-all duration-300 ${hasOutput ? "md:w-[380px] md:min-w-[340px] md:shrink-0 md:border-r border-b md:border-b-0 border-border px-4 md:px-6 py-6 md:py-8" : "mx-auto w-full max-w-2xl px-4 md:px-6 py-6 md:py-8"}`}>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {isViewMode ? "View draft" : isEditMode ? "Edit draft" : "Create"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isViewMode
              ? "Read-only preview of your saved draft. Switch to edit mode to make changes."
              : isEditMode
              ? "Update the saved content. Saving will overwrite the existing draft."
              : "Select a persona, campaign, and post type, then describe what you want to promote."}
          </p>
        </div>

        {/* Draft context banner — shown whenever we hydrated from an existing draft. */}
        {isDraftMode && draftRow && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-medium text-foreground capitalize">
                {isViewMode ? "Viewing" : "Editing"} · {draftRow.status}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Updated {new Date(draftRow.updated_at).toLocaleString()}
              </span>
            </div>
            {postPlan && (
              <p className="text-[11px] text-muted-foreground">
                Campaign Post Plan · Week {postPlan.week_number} · Post {postPlan.post_number}
                {postPlan.phase ? ` · ${String(postPlan.phase).replace(/_/g, " ")}` : ""}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1">
              {isViewMode && (
                <Link
                  to={`/create?draft_id=${draftIdParam}&mode=edit${searchParams.get("campaign_id") ? `&campaign_id=${searchParams.get("campaign_id")}` : ""}${searchParams.get("post_plan_id") ? `&post_plan_id=${searchParams.get("post_plan_id")}` : ""}`}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Pencil className="h-3 w-3" /> Edit draft
                </Link>
              )}
              {isEditMode && (
                <Link
                  to={`/create?draft_id=${draftIdParam}&mode=view${searchParams.get("campaign_id") ? `&campaign_id=${searchParams.get("campaign_id")}` : ""}${searchParams.get("post_plan_id") ? `&post_plan_id=${searchParams.get("post_plan_id")}` : ""}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="h-3 w-3" /> View mode
                </Link>
              )}
              {searchParams.get("campaign_id") && (
                <Link
                  to={`/campaign/${searchParams.get("campaign_id")}`}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back to campaign
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Post Plan Banner */}
        {postPlan && !isDraftMode && (
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

        {/* Competitor Strategy Banner */}
        {competitorStrategy && (
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 space-y-1">
            <p className="text-xs font-medium text-orange-700 flex items-center gap-1"><Swords className="h-3.5 w-3.5" /> Competitor Strategy Applied</p>
            <p className="text-xs text-foreground">{competitorStrategy.title}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {competitorStrategy.hook_type && <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-700">{competitorStrategy.hook_type} hook</span>}
              {competitorStrategy.intent && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{competitorStrategy.intent}</span>}
            </div>
            {competitorStrategy.example_hook && (
              <p className="text-[10px] text-muted-foreground italic mt-1">Hook: "{competitorStrategy.example_hook}"</p>
            )}
          </div>
        )}

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
              if (camp?.language) setLanguage(camp.language);
              if (camp?.market_context_id) setSelectedMarketId(camp.market_context_id);
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

          {/* Target Market */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Target Market
            </label>
            <div className="grid grid-cols-2 gap-2">
              {marketContexts.map((mc) => (
                <button
                  key={mc.id}
                  onClick={() => setSelectedMarketId(mc.id)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    selectedMarketId === mc.id
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {mc.region_code === "BD" ? "🇧🇩" : mc.region_code === "US" ? "🇺🇸" : "🌍"} {mc.region_name}
                </button>
              ))}
            </div>
            {selectedMarketId && (
              <p className="text-[10px] text-muted-foreground">
                {marketContexts.find(m => m.id === selectedMarketId)?.audience_type?.replace(/_/g, " ")}
              </p>
            )}
          </div>

          {/* Language Selector */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Content Language</label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="bangla">বাংলা (Bangla)</SelectItem>
              </SelectContent>
            </Select>
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
        <div className="flex-1 min-w-0 overflow-y-auto space-y-5 px-4 md:px-6 py-6 md:py-8">
          {/* Idea Brief */}
          {idea && <IdeaBrief idea={idea} />}

          {/* Posts */}
          {posts.length > 0 && (
            <div className="space-y-4">
              {!isDraftMode && (
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium text-foreground">{posts.length === 1 ? "Variation" : `${posts.length} Variations`}</h2>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setViewMode("list")} className={`rounded-md p-1.5 transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      <List className="h-4 w-4" />
                    </button>
                    <button onClick={() => setViewMode("compare")} className={`rounded-md p-1.5 transition-colors ${viewMode === "compare" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {viewMode === "compare" && idea && !isDraftMode ? (
                <ComparisonView
                  posts={posts}
                  ideaId={idea.id}
                  userId={user!.id}
                  selectedId={selectedPostId}
                  onSelect={setSelectedPostId}
                  onPostUpdate={handlePostUpdate}
                  postPlanId={postPlan?.id || null}
                  campaignId={selectedCampaignId || null}
                />
              ) : (
                <div className="space-y-4">
                  {posts.sort((a, b) => a.variation_number - b.variation_number).map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      ideaId={idea?.id || draftRow?.idea_id || ""}
                      userId={user!.id}
                      onPostUpdate={handlePostUpdate}
                      postPlanId={postPlan?.id || null}
                      campaignId={selectedCampaignId || null}
                      draftId={isDraftMode ? draftIdParam : null}
                      readOnly={isViewMode}
                    />
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
