import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronUp, ExternalLink, Search,
  Target, TrendingUp, AlertTriangle, Lightbulb, Swords, Eye, Zap,
  BarChart3, Users, MessageSquare, ThumbsUp, Share2, ChevronRight,
  Camera, Upload, ImageIcon, CheckCircle2, AlertCircle, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { WinStrategySummary } from "@/components/competitor/WinStrategySummary";
import { ContentGapMatrix } from "@/components/competitor/ContentGapMatrix";
import { ContentAnglesPanel } from "@/components/competitor/ContentAnglesPanel";
import { OpportunityScoringCards } from "@/components/competitor/OpportunityScoringCards";
import { PredictedOutcomePanel } from "@/components/competitor/PredictedOutcomePanel";
import { CampaignFromCompetitor } from "@/components/competitor/CampaignFromCompetitor";
import { WinningPositionCard } from "@/components/competitor/WinningPositionCard";
import { ExecutionPlanTimeline } from "@/components/competitor/ExecutionPlanTimeline";
import { WhyPostsWorkPanel } from "@/components/competitor/WhyPostsWorkPanel";
import { ConfidenceIndicator } from "@/components/competitor/ConfidenceIndicator";
import { QuickActionsPanel } from "@/components/competitor/QuickActionsPanel";
type Competitor = {
  id: string; name: string; linkedin_url: string | null; tags: string[] | null; created_at: string;
};

type CompetitorPost = {
  id: string; competitor_id: string; content: string; topic: string | null;
  hook_style: string | null; tone: string | null; cta_type: string | null;
  likes: number; comments: number; reposts: number; impressions: number;
  post_url: string | null; post_analysis: any;
  source_type: string; screenshot_url: string | null;
  visual_summary: string | null; post_format: string | null;
  extraction_confidence: any;
};

type CompetitorInsight = {
  id: string; competitor_id: string | null;
  patterns: any; gaps: any; overused_themes: any; suggested_angles: any;
  content_strategy_overview: any; messaging_patterns: any; audience_strategy: any;
  strengths_analysis: any; weaknesses_analysis: any; performance_insights: any;
  strategic_opportunities: any; actionable_recommendations: any;
  win_strategy: any; content_gap_matrix: any; content_angles: any;
  opportunity_scores: any; predicted_outcomes: any; campaign_blueprint: any;
  winning_position: any;
};

type ExtractionField = { value: any; confidence: string };
type ExtractionResult = Record<string, ExtractionField>;

const confidenceColor = (c: string) => {
  switch (c) {
    case "high": return "text-green-600 bg-green-500/10 border-green-500/30";
    case "medium": return "text-amber-600 bg-amber-500/10 border-amber-500/30";
    case "low": return "text-red-500 bg-red-500/10 border-red-500/30";
    default: return "text-muted-foreground bg-muted/50 border-border";
  }
};

const confidenceIcon = (c: string) => {
  switch (c) {
    case "high": return <CheckCircle2 className="h-3 w-3 text-green-600" />;
    case "medium": return <AlertCircle className="h-3 w-3 text-amber-600" />;
    case "low": return <AlertTriangle className="h-3 w-3 text-red-500" />;
    default: return <HelpCircle className="h-3 w-3 text-muted-foreground" />;
  }
};

const CompetitorsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, CompetitorPost[]>>({});
  const [insights, setInsights] = useState<Record<string, CompetitorInsight | null>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analyzingPostId, setAnalyzingPostId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Post adding state
  const [addingPostFor, setAddingPostFor] = useState<string | null>(null);
  const [postInputMode, setPostInputMode] = useState<"manual" | "screenshot">("screenshot");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTopic, setNewPostTopic] = useState("");
  const [newPostUrl, setNewPostUrl] = useState("");
  const [newPostLikes, setNewPostLikes] = useState("");
  const [newPostComments, setNewPostComments] = useState("");
  const [newPostReposts, setNewPostReposts] = useState("");
  const [newPostImpressions, setNewPostImpressions] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  // Screenshot flow (multiple)
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [screenshotPreviews, setScreenshotPreviews] = useState<string[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [reviewData, setReviewData] = useState<Record<string, any>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (user) fetchCompetitors(); }, [user]);

  const fetchCompetitors = async () => {
    setLoading(true);
    const { data } = await supabase.from("competitors").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
    setCompetitors(data || []);
    setLoading(false);
  };

  const addCompetitor = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const tags = newTags.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("competitors").insert({
      user_id: user!.id, name: newName.trim(),
      linkedin_url: newUrl.trim() || null, tags: tags.length > 0 ? tags : null,
    });
    if (error) toast.error("Failed to add competitor");
    else { toast.success("Competitor added"); setNewName(""); setNewUrl(""); setNewTags(""); setShowAdd(false); fetchCompetitors(); }
    setAdding(false);
  };

  const deleteCompetitor = async (id: string) => {
    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else { toast.success("Competitor removed"); setCompetitors(prev => prev.filter(c => c.id !== id)); }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!posts[id]) {
      const [postsRes, insightRes] = await Promise.all([
        supabase.from("competitor_posts").select("*").eq("competitor_id", id).eq("user_id", user!.id),
        supabase.from("competitor_insights").select("*").eq("competitor_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      setPosts(prev => ({ ...prev, [id]: (postsRes.data as any) || [] }));
      setInsights(prev => ({ ...prev, [id]: (insightRes.data as any) || null }));
    }
  };

  const resetPostForm = () => {
    setNewPostContent(""); setNewPostTopic(""); setNewPostUrl("");
    setNewPostLikes(""); setNewPostComments(""); setNewPostReposts(""); setNewPostImpressions("");
    screenshotPreviews.forEach(url => URL.revokeObjectURL(url));
    setScreenshotFiles([]); setScreenshotPreviews([]); setExtraction(null); setReviewData({});
    setAddingPostFor(null); setPostInputMode("screenshot");
  };

  // Screenshot upload + extraction (multiple)
  const handleScreenshotSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    addScreenshotFiles(Array.from(files));
    e.target.value = "";
  };

  const addScreenshotFiles = (files: File[]) => {
    const valid = files.filter(f => {
      if (f.size > 50 * 1024 * 1024) { toast.error(`${f.name} too large. Max 50MB.`); return false; }
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) { toast.error(`${f.name} is not an image or video.`); return false; }
      return true;
    });
    if (valid.length === 0) return;
    setScreenshotFiles(prev => [...prev, ...valid]);
    setScreenshotPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    setExtraction(null);
    setReviewData({});
  };

  const removeScreenshot = (index: number) => {
    URL.revokeObjectURL(screenshotPreviews[index]);
    setScreenshotFiles(prev => prev.filter((_, i) => i !== index));
    setScreenshotPreviews(prev => prev.filter((_, i) => i !== index));
    setExtraction(null);
    setReviewData({});
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const mediaFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/") || items[i].type.startsWith("video/")) {
        const file = items[i].getAsFile();
        if (file) mediaFiles.push(file);
      }
    }
    if (mediaFiles.length > 0) {
      e.preventDefault();
      addScreenshotFiles(mediaFiles);
    }
  };

  const runExtraction = async () => {
    if (screenshotFiles.length === 0 || !user) return;
    setExtracting(true);
    try {
      // Upload all screenshots to storage
      const uploadedUrls: string[] = [];
      for (const file of screenshotFiles) {
        const ext = file.name.split(".").pop() || "png";
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("competitor-screenshots")
          .upload(path, file, { contentType: file.type });
        if (uploadError) throw new Error("Failed to upload screenshot");
        const { data: urlData } = supabase.storage.from("competitor-screenshots").getPublicUrl(path);
        uploadedUrls.push(urlData.publicUrl);
      }

      // Extract from ALL screenshots so the AI sees visuals + metrics
      const { data, error } = await supabase.functions.invoke("extract-competitor-post", {
        body: { screenshot_urls: uploadedUrls },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const ext_result = data.extraction as ExtractionResult;
      setExtraction(ext_result);

      // Pre-fill review data from extraction
      setReviewData({
        post_text: ext_result.post_text?.value || "",
        hook: ext_result.hook?.value || "",
        cta: ext_result.cta?.value || "",
        likes: ext_result.likes?.value ?? "",
        comments: ext_result.comments?.value ?? "",
        reposts: ext_result.reposts?.value ?? "",
        impressions: ext_result.impressions?.value ?? "",
        post_format: ext_result.post_format?.value || "unknown",
        visual_summary: ext_result.visual_summary?.value || "",
        post_url: ext_result.post_url?.value || "",
        topic: ext_result.author_name?.value || "",
        screenshot_url: uploadedUrls[0],
        all_screenshot_urls: uploadedUrls,
      });

      toast.success(`${uploadedUrls.length} screenshot${uploadedUrls.length > 1 ? "s" : ""} analyzed! Review the extracted data below.`);
    } catch (err: any) {
      toast.error(err.message || "Extraction failed");
    }
    setExtracting(false);
  };

  const saveScreenshotPost = async (competitorId: string) => {
    if (!reviewData.post_text?.trim()) { toast.error("Post text is required"); return; }
    setSavingPost(true);
    try {
      // Build confidence object
      const confidenceObj: Record<string, string> = {};
      if (extraction) {
        for (const [key, field] of Object.entries(extraction)) {
          confidenceObj[key] = field.confidence;
        }
      }

      // Track manual corrections and update confidence for manually filled fields
      const corrections: Record<string, boolean> = {};
      if (extraction) {
        const fieldMap: Record<string, string> = {
          post_text: reviewData.post_text || "",
          likes: String(reviewData.likes ?? ""),
          comments: String(reviewData.comments ?? ""),
          reposts: String(reviewData.reposts ?? ""),
          impressions: String(reviewData.impressions ?? ""),
          visual_summary: reviewData.visual_summary || "",
          post_format: reviewData.post_format || "",
          post_url: reviewData.post_url || "",
        };
        const extractionMap: Record<string, string> = {
          post_text: extraction.post_text?.value || "",
          likes: String(extraction.likes?.value ?? ""),
          comments: String(extraction.comments?.value ?? ""),
          reposts: String(extraction.reposts?.value ?? ""),
          impressions: String(extraction.impressions?.value ?? ""),
          visual_summary: extraction.visual_summary?.value || "",
          post_format: extraction.post_format?.value || "",
          post_url: extraction.post_url?.value || "",
        };
        for (const key of Object.keys(fieldMap)) {
          if (fieldMap[key] !== extractionMap[key] && fieldMap[key].trim()) {
            corrections[key] = true;
            confidenceObj[key] = "manual";
          }
        }
      }
      // Also mark fields as manual if they were missing but user provided a value
      if (!extraction) {
        if (reviewData.post_url?.trim()) confidenceObj.post_url = "manual";
      }

      const originalWithScreenshots = {
        ...(extraction || {}),
        all_screenshot_urls: reviewData.all_screenshot_urls || [reviewData.screenshot_url],
      };

      const { error } = await supabase.from("competitor_posts").insert({
        user_id: user!.id,
        competitor_id: competitorId,
        content: reviewData.post_text.trim(),
        topic: reviewData.topic?.trim() || null,
        post_url: reviewData.post_url?.trim() || null,
        likes: parseInt(reviewData.likes) || 0,
        comments: parseInt(reviewData.comments) || 0,
        reposts: parseInt(reviewData.reposts) || 0,
        impressions: parseInt(reviewData.impressions) || 0,
        source_type: "screenshot",
        screenshot_url: reviewData.screenshot_url,
        visual_summary: reviewData.visual_summary?.trim() || null,
        post_format: reviewData.post_format || null,
        extraction_confidence: confidenceObj,
        original_extraction: originalWithScreenshots,
        manual_corrections: corrections,
      });
      if (error) throw error;
      toast.success("Post saved from screenshot");
      resetPostForm();
      const { data } = await supabase.from("competitor_posts").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id);
      setPosts(prev => ({ ...prev, [competitorId]: (data as any) || [] }));
    } catch (err: any) {
      toast.error(err.message || "Failed to save post");
    }
    setSavingPost(false);
  };

  const addPost = async (competitorId: string) => {
    if (!newPostContent.trim()) return;
    setSavingPost(true);
    const { error } = await supabase.from("competitor_posts").insert({
      user_id: user!.id, competitor_id: competitorId,
      content: newPostContent.trim(), topic: newPostTopic.trim() || null,
      post_url: newPostUrl.trim() || null,
      likes: parseInt(newPostLikes) || 0, comments: parseInt(newPostComments) || 0,
      reposts: parseInt(newPostReposts) || 0, impressions: parseInt(newPostImpressions) || 0,
      source_type: "manual",
    });
    if (error) toast.error("Failed to add post");
    else {
      toast.success("Post added");
      resetPostForm();
      const { data } = await supabase.from("competitor_posts").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id);
      setPosts(prev => ({ ...prev, [competitorId]: (data as any) || [] }));
    }
    setSavingPost(false);
  };

  const deletePost = async (postId: string, competitorId: string) => {
    await supabase.from("competitor_posts").delete().eq("id", postId);
    setPosts(prev => ({ ...prev, [competitorId]: (prev[competitorId] || []).filter(p => p.id !== postId) }));
    toast.success("Post removed");
  };

  const analyzePost = async (post: CompetitorPost, competitorId: string) => {
    setAnalyzingPostId(post.id);
    try {
      const comp = competitors.find(c => c.id === competitorId);
      const { data, error } = await supabase.functions.invoke("analyze-competitor", {
        body: { competitor_id: competitorId, competitor_name: comp?.name, posts: [post], action: "analyze_post" },
      });
      if (error) throw error;
      const { data: updatedPosts } = await supabase.from("competitor_posts").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id);
      setPosts(prev => ({ ...prev, [competitorId]: (updatedPosts as any) || [] }));
      setExpandedPostId(post.id);
      toast.success("Post analyzed");
    } catch (err: any) { toast.error(err.message || "Analysis failed"); }
    setAnalyzingPostId(null);
  };

  const analyzeAllPosts = async (competitorId: string) => {
    const compPosts = posts[competitorId];
    if (!compPosts || compPosts.length < 2) { toast.error("Add at least 2 posts to run full analysis"); return; }
    setAnalyzingId(competitorId);
    try {
      const comp = competitors.find(c => c.id === competitorId);
      const { error } = await supabase.functions.invoke("analyze-competitor", {
        body: { competitor_id: competitorId, competitor_name: comp?.name, posts: compPosts },
      });
      if (error) throw error;
      const [postsRes, insightRes] = await Promise.all([
        supabase.from("competitor_posts").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id),
        supabase.from("competitor_insights").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id).maybeSingle(),
      ]);
      setPosts(prev => ({ ...prev, [competitorId]: (postsRes.data as any) || [] }));
      setInsights(prev => ({ ...prev, [competitorId]: (insightRes.data as any) || null }));
      toast.success("Full analysis complete");
    } catch (err: any) { toast.error(err.message || "Analysis failed"); }
    setAnalyzingId(null);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Competitor Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Deep analysis of competitor content strategy — find gaps, exploit weaknesses, win.</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Competitor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add a Competitor</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Competitor name" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input placeholder="LinkedIn profile URL (optional)" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
              <Input placeholder="Tags (comma separated)" value={newTags} onChange={e => setNewTags(e.target.value)} />
              <Button onClick={addCompetitor} disabled={adding || !newName.trim()} className="w-full">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {competitors.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No competitors tracked yet. Add one to start analyzing.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map(comp => {
            const isExpanded = expandedId === comp.id;
            const compPosts = posts[comp.id] || [];
            const compInsight = insights[comp.id];
            return (
              <div key={comp.id} className="border border-border rounded-lg bg-card overflow-hidden">
                <button onClick={() => toggleExpand(comp.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <p className="font-medium text-foreground text-sm">{comp.name}</p>
                      {comp.linkedin_url && (
                        <a href={comp.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5">
                          <ExternalLink className="h-3 w-3" /> LinkedIn
                        </a>
                      )}
                    </div>
                    {comp.tags?.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{compPosts.length} posts</Badge>
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); deleteCompetitor(comp.id); }} className="h-7 w-7 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <Tabs defaultValue="posts" className="w-full">
                      <div className="px-4 pt-2 flex items-center justify-between">
                        <TabsList className="h-8">
                          <TabsTrigger value="posts" className="text-xs">Posts</TabsTrigger>
                          <TabsTrigger value="insights" className="text-xs">Insights</TabsTrigger>
                          <TabsTrigger value="strategy" className="text-xs">Strategy</TabsTrigger>
                        </TabsList>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => { setAddingPostFor(comp.id); setPostInputMode("screenshot"); }} className="h-7 text-xs">
                            <Plus className="h-3 w-3 mr-1" /> Add Post
                          </Button>
                          <Button size="sm" onClick={() => analyzeAllPosts(comp.id)} disabled={analyzingId === comp.id || compPosts.length < 2} className="h-7 text-xs">
                            {analyzingId === comp.id ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Analyzing...</> : <><Zap className="h-3 w-3 mr-1" /> Full Analysis</>}
                          </Button>
                        </div>
                      </div>

                      {/* POSTS TAB */}
                      <TabsContent value="posts" className="px-4 pb-4 space-y-3 mt-2">
                        {addingPostFor === comp.id && (
                          <div className="border border-border rounded-lg p-4 bg-muted/20 space-y-4">
                            {/* Mode toggle */}
                            <div className="flex gap-2">
                              <Button size="sm" variant={postInputMode === "screenshot" ? "default" : "outline"} onClick={() => setPostInputMode("screenshot")} className="h-7 text-xs">
                                <Camera className="h-3 w-3 mr-1" /> Screenshot (Recommended)
                              </Button>
                              <Button size="sm" variant={postInputMode === "manual" ? "default" : "outline"} onClick={() => setPostInputMode("manual")} className="h-7 text-xs">
                                Manual Entry
                              </Button>
                            </div>

                            {postInputMode === "screenshot" ? (
                              <ScreenshotPostFlow
                                screenshotPreviews={screenshotPreviews}
                                screenshotFiles={screenshotFiles}
                                extracting={extracting}
                                extraction={extraction}
                                reviewData={reviewData}
                                setReviewData={setReviewData}
                                onFileSelect={handleScreenshotSelect}
                                onPaste={handlePaste}
                                onExtract={runExtraction}
                                onSave={() => saveScreenshotPost(comp.id)}
                                onCancel={resetPostForm}
                                saving={savingPost}
                                fileInputRef={fileInputRef}
                                onRemoveScreenshot={removeScreenshot}
                              />
                            ) : (
                              <ManualPostForm
                                onSave={() => addPost(comp.id)} onCancel={resetPostForm} saving={savingPost}
                                content={newPostContent} setContent={setNewPostContent}
                                topic={newPostTopic} setTopic={setNewPostTopic}
                                url={newPostUrl} setUrl={setNewPostUrl}
                                likes={newPostLikes} setLikes={setNewPostLikes}
                                comments={newPostComments} setComments={setNewPostComments}
                                reposts={newPostReposts} setReposts={setNewPostReposts}
                                impressions={newPostImpressions} setImpressions={setNewPostImpressions}
                              />
                            )}
                          </div>
                        )}

                        {compPosts.length === 0 && addingPostFor !== comp.id ? (
                          <p className="text-xs text-muted-foreground italic py-4 text-center">No posts tracked yet. Add competitor posts to enable analysis.</p>
                        ) : compPosts.map(post => (
                          <PostCard key={post.id} post={post} competitorId={comp.id} onDelete={deletePost} onAnalyze={analyzePost} analyzing={analyzingPostId === post.id} expanded={expandedPostId === post.id} onToggle={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)} />
                        ))}
                      </TabsContent>

                      {/* INSIGHTS TAB */}
                      <TabsContent value="insights" className="px-4 pb-4 mt-2">
                        {compInsight ? (
                          <div className="space-y-6">
                            <WinStrategySummary strategy={compInsight.win_strategy} />
                            <ContentGapMatrix matrix={compInsight.content_gap_matrix} />
                            <PredictedOutcomePanel outcomes={compInsight.predicted_outcomes} />
                            <WinningPositionCard position={compInsight.winning_position} />
                            <InsightsPanel insight={compInsight} />
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Run "Full Analysis" with 2+ posts to generate insights.
                          </div>
                        )}
                      </TabsContent>

                      {/* STRATEGY TAB */}
                      <TabsContent value="strategy" className="px-4 pb-4 mt-2">
                        {compInsight ? (
                          <div className="space-y-6">
                            <ContentAnglesPanel
                              angles={compInsight.content_angles}
                              onCreatePost={(angle) => {
                                // Store angle data for create page
                                sessionStorage.setItem("competitor_strategy", JSON.stringify({
                                  hook_type: angle.hook_type,
                                  intent: angle.intent,
                                  title: angle.title,
                                  example_hook: angle.example_hook,
                                }));
                                navigate("/create");
                              }}
                            />
                            <OpportunityScoringCards scores={compInsight.opportunity_scores} />
                            <CampaignFromCompetitor
                              blueprint={compInsight.campaign_blueprint}
                              competitorName={comp.name}
                              onGenerateCampaign={() => {
                                sessionStorage.setItem("competitor_campaign_blueprint", JSON.stringify({
                                  ...compInsight.campaign_blueprint,
                                  competitor_name: comp.name,
                                  win_strategy: compInsight.win_strategy,
                                }));
                                navigate("/campaign/new");
                              }}
                            />
                            <StrategyPanel insight={compInsight} />
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground text-sm">
                            <Swords className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Run "Full Analysis" to get strategic recommendations.
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ========== SCREENSHOT FLOW ==========

function ScreenshotPostFlow({
  screenshotPreviews, screenshotFiles, extracting, extraction, reviewData, setReviewData,
  onFileSelect, onPaste, onExtract, onSave, onCancel, saving, fileInputRef, onRemoveScreenshot,
}: {
  screenshotPreviews: string[]; screenshotFiles: File[]; extracting: boolean;
  extraction: ExtractionResult | null; reviewData: Record<string, any>;
  setReviewData: (d: Record<string, any>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  onExtract: () => void; onSave: () => void; onCancel: () => void; saving: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onRemoveScreenshot: (index: number) => void;
}) {
  const updateField = (key: string, value: any) => setReviewData({ ...reviewData, [key]: value });

  // Step 1: Upload (no screenshots yet)
  if (screenshotPreviews.length === 0) {
    return (
      <div className="space-y-3" onPaste={onPaste}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={onFileSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-8 hover:border-primary/50 hover:bg-muted/30 transition-colors flex flex-col items-center gap-2 focus:outline-none focus:border-primary/50"
          tabIndex={0}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Upload Screenshots or Videos</p>
          <p className="text-xs text-muted-foreground">Click to browse, drag & drop, or paste (Ctrl+V / ⌘V)</p>
          <p className="text-[10px] text-muted-foreground">PNG, JPG, WebP, MP4, MOV — Max 50MB each — Multiple allowed</p>
        </button>
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }

  // Step 2: Preview + Extract
  if (!extraction) {
    return (
      <div className="space-y-3" onPaste={onPaste}>
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={onFileSelect} className="hidden" />
        <div className="flex gap-3 flex-wrap">
          {screenshotPreviews.map((preview, idx) => (
            <div key={idx} className="relative w-32 h-32 rounded-lg border border-border overflow-hidden bg-muted/50 shrink-0 group">
              {screenshotFiles[idx]?.type.startsWith("video/") ? (
                <video src={preview} className="w-full h-full object-contain" muted />
              ) : (
                <img src={preview} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-contain" />
              )}
              {idx === 0 && (
                <span className="absolute top-1 left-1 text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-medium">Primary</span>
              )}
              {screenshotFiles[idx]?.type.startsWith("video/") && (
                <span className="absolute bottom-1 left-1 text-[9px] bg-foreground/70 text-background px-1.5 py-0.5 rounded font-medium">Video</span>
              )}
              <button
                onClick={() => onRemoveScreenshot(idx)}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-32 h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-1"
          >
            <Plus className="h-5 w-5 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Add more</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {extracting ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Analyzing {screenshotFiles.length} file{screenshotFiles.length > 1 ? "s" : ""} with AI vision...
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {screenshotFiles.length} file{screenshotFiles.length > 1 ? "s" : ""} ready.
              {screenshotFiles.length > 1 && " All files will be analyzed together for extraction."}
            </p>
          )}
        </div>
        <div className="flex justify-between">
          <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button onClick={onExtract} size="sm" disabled={extracting}>
            <Zap className="h-3.5 w-3.5 mr-1" /> Extract Post Data
          </Button>
        </div>
      </div>
    );
  }

  // Step 3: Review & Correct
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        Review Extracted Data
        <span className="text-xs text-muted-foreground font-normal ml-2">Edit any field before saving</span>
      </div>

      <div className="flex gap-4">
        {/* Screenshot thumbnails */}
        <div className="flex flex-col gap-2 shrink-0">
          {screenshotPreviews.map((preview, idx) => (
            <div key={idx} className="w-24 h-24 rounded-lg border border-border overflow-hidden bg-muted/50 relative">
              <img src={preview} alt={`Screenshot ${idx + 1}`} className="w-full h-full object-contain" />
              {idx === 0 && <span className="absolute top-0.5 left-0.5 text-[8px] bg-primary text-primary-foreground px-1 py-0.5 rounded">Primary</span>}
            </div>
          ))}
        </div>

        <div className="flex-1 space-y-3">
          {/* Post text */}
          <ReviewField label="Post Text" confidence={extraction.post_text?.confidence || "missing"}>
            <Textarea value={reviewData.post_text || ""} onChange={e => updateField("post_text", e.target.value)} rows={4} className="text-xs" />
          </ReviewField>

          {/* Topic / Label */}
          <ReviewField label="Label / Author" confidence={extraction.author_name?.confidence || "missing"}>
            <Input value={reviewData.topic || ""} onChange={e => updateField("topic", e.target.value)} placeholder="Short label or author name" className="text-xs h-8" />
          </ReviewField>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3">
        <ReviewField label="Likes" confidence={extraction.likes?.confidence || "missing"}>
          <Input type="number" value={reviewData.likes ?? ""} onChange={e => updateField("likes", e.target.value)} className="text-xs h-8" placeholder="—" />
        </ReviewField>
        <ReviewField label="Comments" confidence={extraction.comments?.confidence || "missing"}>
          <Input type="number" value={reviewData.comments ?? ""} onChange={e => updateField("comments", e.target.value)} className="text-xs h-8" placeholder="—" />
        </ReviewField>
        <ReviewField label="Reposts" confidence={extraction.reposts?.confidence || "missing"}>
          <Input type="number" value={reviewData.reposts ?? ""} onChange={e => updateField("reposts", e.target.value)} className="text-xs h-8" placeholder="—" />
        </ReviewField>
        <ReviewField label="Impressions" confidence={extraction.impressions?.confidence || "missing"}>
          <Input type="number" value={reviewData.impressions ?? ""} onChange={e => updateField("impressions", e.target.value)} className="text-xs h-8" placeholder="—" />
        </ReviewField>
      </div>

      {/* Post format & visual summary */}
      <div className="grid grid-cols-2 gap-3">
        <ReviewField label="Post Format" confidence={extraction.post_format?.confidence || "missing"}>
          <select
            value={reviewData.post_format || "unknown"}
            onChange={e => updateField("post_format", e.target.value)}
            className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="text_only">Text Only</option>
            <option value="image_text">Image + Text</option>
            <option value="carousel">Carousel</option>
            <option value="video_preview">Video Preview</option>
            <option value="infographic">Infographic</option>
            <option value="product_screenshot">Product Screenshot</option>
            <option value="founder_image">Founder Image</option>
            <option value="meme_style">Meme Style</option>
            <option value="branded_graphic">Branded Graphic</option>
            <option value="unknown">Unknown</option>
          </select>
        </ReviewField>
        <ReviewField label="Visual Summary" confidence={extraction.visual_summary?.confidence || "missing"}>
          <Input value={reviewData.visual_summary || ""} onChange={e => updateField("visual_summary", e.target.value)} placeholder="e.g. text-heavy educational graphic" className="text-xs h-8" />
        </ReviewField>
      </div>

      {/* Post URL */}
      <ReviewField label="Post URL" confidence={extraction.post_url?.confidence || "missing"}>
        <Input value={reviewData.post_url || ""} onChange={e => updateField("post_url", e.target.value)} placeholder="https://linkedin.com/feed/update/..." className="text-xs h-8" />
      </ReviewField>

      <div className="flex justify-between pt-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving || !reviewData.post_text?.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle2 className="h-3 w-3 mr-1" />}
          Save Post
        </Button>
      </div>
    </div>
  );
}

function ReviewField({ label, confidence, children }: { label: string; confidence: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        {confidenceIcon(confidence)}
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <Badge variant="outline" className={cn("text-[9px] h-4 px-1", confidenceColor(confidence))}>
          {confidence}
        </Badge>
      </div>
      {children}
    </div>
  );
}

// ========== MANUAL POST FORM ==========

function ManualPostForm({ onSave, onCancel, saving, content, setContent, topic, setTopic, url, setUrl, likes, setLikes, comments, setComments, reposts, setReposts, impressions, setImpressions }: any) {
  return (
    <div className="space-y-3">
      <Input placeholder="Topic (optional)" value={topic} onChange={(e: any) => setTopic(e.target.value)} />
      <Textarea placeholder="Paste competitor's post content..." value={content} onChange={(e: any) => setContent(e.target.value)} rows={4} />
      <Input placeholder="Post URL (optional)" value={url} onChange={(e: any) => setUrl(e.target.value)} />
      <div className="grid grid-cols-4 gap-2">
        <Input placeholder="Likes" type="number" value={likes} onChange={(e: any) => setLikes(e.target.value)} />
        <Input placeholder="Comments" type="number" value={comments} onChange={(e: any) => setComments(e.target.value)} />
        <Input placeholder="Reposts" type="number" value={reposts} onChange={(e: any) => setReposts(e.target.value)} />
        <Input placeholder="Impressions" type="number" value={impressions} onChange={(e: any) => setImpressions(e.target.value)} />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving || !content.trim()}>
          {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save Post
        </Button>
      </div>
    </div>
  );
}

// ========== POST CARD ==========

function PostCard({ post, competitorId, onDelete, onAnalyze, analyzing, expanded, onToggle }: {
  post: CompetitorPost; competitorId: string; onDelete: (id: string, cid: string) => void;
  onAnalyze: (p: CompetitorPost, cid: string) => void; analyzing: boolean; expanded: boolean; onToggle: () => void;
}) {
  const hasMetrics = post.likes || post.comments || post.reposts || post.impressions;
  const hasAnalysis = post.post_analysis && Object.keys(post.post_analysis).length > 0;
  const a = post.post_analysis;
  const isScreenshot = post.source_type === "screenshot";

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-3 flex-1 min-w-0">
            {/* Screenshot thumbnail */}
            {isScreenshot && post.screenshot_url && (
              <div className="w-16 h-16 rounded border border-border overflow-hidden bg-muted/50 shrink-0">
                <img src={post.screenshot_url} alt="Screenshot" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                {isScreenshot && (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 gap-0.5">
                    <Camera className="h-2.5 w-2.5" /> Screenshot
                  </Badge>
                )}
                {post.post_format && post.post_format !== "unknown" && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1">{post.post_format.replace(/_/g, " ")}</Badge>
                )}
                {post.topic && <span className="text-[10px] font-medium text-primary">{post.topic}</span>}
              </div>
              <p className="text-xs text-foreground line-clamp-3 whitespace-pre-wrap">{post.content}</p>
              {post.visual_summary && (
                <p className="text-[10px] text-muted-foreground mt-1 italic flex items-center gap-1">
                  <ImageIcon className="h-2.5 w-2.5" /> {post.visual_summary}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!hasAnalysis && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onAnalyze(post, competitorId)} disabled={analyzing}>
                {analyzing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Zap className="h-3 w-3 mr-1" /> Analyze</>}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onDelete(post.id, competitorId)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Metrics bar */}
        {hasMetrics ? (
          <div className="flex gap-3 mt-2 text-[10px] text-muted-foreground">
            {post.likes > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="h-2.5 w-2.5" /> {post.likes}</span>}
            {post.comments > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-2.5 w-2.5" /> {post.comments}</span>}
            {post.reposts > 0 && <span className="flex items-center gap-0.5"><Share2 className="h-2.5 w-2.5" /> {post.reposts}</span>}
            {post.impressions > 0 && <span className="flex items-center gap-0.5"><Eye className="h-2.5 w-2.5" /> {post.impressions.toLocaleString()}</span>}
          </div>
        ) : null}

        {/* Confidence summary for screenshot posts */}
        {isScreenshot && post.extraction_confidence && Object.keys(post.extraction_confidence).length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {Object.entries(post.extraction_confidence).filter(([, v]) => v === "low" || v === "missing").map(([k, v]) => (
              <Badge key={k} variant="outline" className={cn("text-[9px] h-4 px-1", confidenceColor(v as string))}>
                {k.replace(/_/g, " ")}: {v as string}
              </Badge>
            ))}
          </div>
        )}

        {/* Tags */}
        {(post.hook_style || post.tone || post.cta_type) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.hook_style && <Badge variant="outline" className="text-[10px]">Hook: {post.hook_style}</Badge>}
            {post.tone && <Badge variant="outline" className="text-[10px]">Tone: {post.tone}</Badge>}
            {post.cta_type && <Badge variant="outline" className="text-[10px]">CTA: {post.cta_type}</Badge>}
          </div>
        )}

        {/* Expand analysis */}
        {hasAnalysis && (
          <button onClick={onToggle} className="flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
            <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
            {expanded ? "Hide analysis" : "View analysis"}
          </button>
        )}
      </div>

      {/* Expanded post analysis */}
      {expanded && hasAnalysis && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-4">
          {a.audience_targeting && (
            <AnalysisSection icon={<Users className="h-3.5 w-3.5" />} title="Audience Targeting">
              <p className="text-xs text-muted-foreground"><strong>Target:</strong> {a.audience_targeting.who_targeted}</p>
              <p className="text-xs text-muted-foreground"><strong>Awareness:</strong> {a.audience_targeting.awareness_level}</p>
              {a.audience_targeting.relevance_to_user && <p className="text-xs text-primary/80 mt-1 italic">→ {a.audience_targeting.relevance_to_user}</p>}
            </AnalysisSection>
          )}

          {a.strength_analysis && (
            <AnalysisSection icon={<TrendingUp className="h-3.5 w-3.5 text-green-500" />} title="Strengths">
              <p className="text-xs text-muted-foreground">{a.strength_analysis.why_it_works}</p>
              {a.strength_analysis.strong_lines?.length > 0 && (
                <div className="mt-1 space-y-1">
                  {a.strength_analysis.strong_lines.map((line: string, i: number) => (
                    <p key={i} className="text-xs text-foreground/80 pl-2 border-l-2 border-green-500/40 italic">"{line}"</p>
                  ))}
                </div>
              )}
            </AnalysisSection>
          )}

          {a.weakness_analysis && (
            <AnalysisSection icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} title="Weaknesses">
              {a.weakness_analysis.failures?.map((f: string, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">• {f}</p>
              ))}
              {a.weakness_analysis.weak_elements && (
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {Object.entries(a.weakness_analysis.weak_elements).filter(([, v]) => v !== "strong").map(([k, v]) => (
                    <p key={k} className="text-[10px] text-amber-600"><strong className="capitalize">{k}:</strong> {v as string}</p>
                  ))}
                </div>
              )}
            </AnalysisSection>
          )}

          {/* Creative analysis for screenshot posts */}
          {a.creative_analysis && (
            <AnalysisSection icon={<ImageIcon className="h-3.5 w-3.5 text-purple-500" />} title="Creative / Visual Analysis">
              {a.creative_analysis.visual_assessment && <p className="text-xs text-muted-foreground">{a.creative_analysis.visual_assessment}</p>}
              {a.creative_analysis.message_alignment && <p className="text-xs text-muted-foreground"><strong>Visual-Message Fit:</strong> {a.creative_analysis.message_alignment}</p>}
              {a.creative_analysis.performance_impact && <p className="text-xs text-muted-foreground"><strong>Impact:</strong> {a.creative_analysis.performance_impact}</p>}
            </AnalysisSection>
          )}

          {a.engagement_insight && a.engagement_insight !== "skip" && (
            <AnalysisSection icon={<BarChart3 className="h-3.5 w-3.5" />} title="Engagement Insight">
              <p className="text-xs text-muted-foreground">{a.engagement_insight}</p>
            </AnalysisSection>
          )}

          {a.improvement_suggestions?.length > 0 && (
            <AnalysisSection icon={<Lightbulb className="h-3.5 w-3.5 text-blue-500" />} title="Improvements">
              {a.improvement_suggestions.map((s: string, i: number) => (
                <p key={i} className="text-xs text-muted-foreground">• {s}</p>
              ))}
            </AnalysisSection>
          )}

          {(a.rewritten_hook || a.rewritten_cta) && (
            <AnalysisSection icon={<Swords className="h-3.5 w-3.5 text-primary" />} title="If YOU Wrote This">
              {a.rewritten_hook && <div className="bg-primary/5 border border-primary/20 rounded p-2"><p className="text-[10px] font-semibold text-primary mb-0.5">Better Hook:</p><p className="text-xs text-foreground">{a.rewritten_hook}</p></div>}
              {a.rewritten_cta && <div className="bg-primary/5 border border-primary/20 rounded p-2 mt-1"><p className="text-[10px] font-semibold text-primary mb-0.5">Better CTA:</p><p className="text-xs text-foreground">{a.rewritten_cta}</p></div>}
            </AnalysisSection>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">{icon} {title}</p>
      <div className="pl-5 space-y-0.5">{children}</div>
    </div>
  );
}

function InsightsPanel({ insight }: { insight: CompetitorInsight }) {
  return (
    <div className="space-y-5">
      {insight.content_strategy_overview && Object.keys(insight.content_strategy_overview).length > 0 && (
        <ReportSection icon={<BarChart3 className="h-4 w-4" />} title="Content Strategy Overview">
          {insight.content_strategy_overview.content_type_distribution && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
              {Object.entries(insight.content_strategy_overview.content_type_distribution).map(([k, v]) => (
                <div key={k} className="bg-muted/50 rounded p-2 text-center">
                  <p className="text-[10px] text-muted-foreground capitalize">{k.replace(/_/g, " ")}</p>
                  <p className="text-sm font-semibold text-foreground">{v as string}</p>
                </div>
              ))}
            </div>
          )}
          {insight.content_strategy_overview.posting_consistency && <p className="text-xs text-muted-foreground"><strong>Consistency:</strong> {insight.content_strategy_overview.posting_consistency}</p>}
          {insight.content_strategy_overview.variety_vs_repetition && <p className="text-xs text-muted-foreground"><strong>Variety:</strong> {insight.content_strategy_overview.variety_vs_repetition}</p>}
        </ReportSection>
      )}

      {insight.messaging_patterns && Object.keys(insight.messaging_patterns).length > 0 && (
        <ReportSection icon={<MessageSquare className="h-4 w-4" />} title="Messaging Patterns">
          {insight.messaging_patterns.positioning_statement && <p className="text-xs text-foreground italic mb-2">"{insight.messaging_patterns.positioning_statement}"</p>}
          {renderList("Core Themes", insight.messaging_patterns.core_themes)}
          {renderList("Repeated Narratives", insight.messaging_patterns.repeated_narratives)}
        </ReportSection>
      )}

      {insight.audience_strategy && Object.keys(insight.audience_strategy).length > 0 && (
        <ReportSection icon={<Users className="h-4 w-4" />} title="Audience Strategy">
          {insight.audience_strategy.primary_target && <p className="text-xs text-muted-foreground"><strong>Primary Target:</strong> {insight.audience_strategy.primary_target}</p>}
          {insight.audience_strategy.awareness_level_focus && <p className="text-xs text-muted-foreground"><strong>Awareness Focus:</strong> {insight.audience_strategy.awareness_level_focus}</p>}
          {renderList("Personas Addressed", insight.audience_strategy.personas_addressed)}
          {renderList("Personas Ignored (Your Opportunity)", insight.audience_strategy.personas_ignored, true)}
        </ReportSection>
      )}

      {insight.strengths_analysis && Array.isArray(insight.strengths_analysis) && insight.strengths_analysis.length > 0 && (
        <ReportSection icon={<TrendingUp className="h-4 w-4 text-green-500" />} title="Pattern-Based Strengths">
          {insight.strengths_analysis.map((s: string, i: number) => <p key={i} className="text-xs text-muted-foreground">• {s}</p>)}
        </ReportSection>
      )}

      {insight.weaknesses_analysis && Array.isArray(insight.weaknesses_analysis) && insight.weaknesses_analysis.length > 0 && (
        <ReportSection icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} title="Weaknesses & Gaps">
          {insight.weaknesses_analysis.map((s: string, i: number) => <p key={i} className="text-xs text-amber-700 dark:text-amber-400">• {s}</p>)}
        </ReportSection>
      )}

      {insight.performance_insights && Object.keys(insight.performance_insights).length > 0 && (
        <ReportSection icon={<BarChart3 className="h-4 w-4" />} title="Performance Insights">
          {insight.performance_insights.best_performing_type && <p className="text-xs text-muted-foreground"><strong>Best:</strong> {insight.performance_insights.best_performing_type}</p>}
          {insight.performance_insights.worst_performing_type && <p className="text-xs text-muted-foreground"><strong>Worst:</strong> {insight.performance_insights.worst_performing_type}</p>}
          {renderList("Engagement Triggers", insight.performance_insights.engagement_triggers)}
          {renderList("Engagement Killers", insight.performance_insights.engagement_killers, true)}
        </ReportSection>
      )}

      {renderLegacyList("Content Patterns", insight.patterns)}
      {renderLegacyList("Strategic Gaps", insight.gaps)}
      {renderLegacyList("Overused Themes", insight.overused_themes)}
    </div>
  );
}

function StrategyPanel({ insight }: { insight: CompetitorInsight }) {
  return (
    <div className="space-y-5">
      {insight.strategic_opportunities && Array.isArray(insight.strategic_opportunities) && insight.strategic_opportunities.length > 0 && (
        <ReportSection icon={<Swords className="h-4 w-4 text-primary" />} title="How YOU Can Beat This Competitor">
          <div className="space-y-3">
            {insight.strategic_opportunities.map((opp: any, i: number) => (
              <div key={i} className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-xs font-semibold text-foreground">{typeof opp === "string" ? opp : opp.opportunity}</p>
                {opp.reasoning && <p className="text-xs text-muted-foreground mt-1">{opp.reasoning}</p>}
                {opp.action && <p className="text-xs text-primary mt-1 font-medium">→ {opp.action}</p>}
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {insight.actionable_recommendations && Array.isArray(insight.actionable_recommendations) && insight.actionable_recommendations.length > 0 && (
        <ReportSection icon={<Target className="h-4 w-4" />} title="Actionable Recommendations">
          <div className="space-y-2">
            {insight.actionable_recommendations.map((rec: any, i: number) => (
              <div key={i} className="border border-border rounded-lg p-3 flex gap-3 items-start">
                <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"} className="text-[10px] shrink-0 mt-0.5">
                  {rec.priority || "medium"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">{typeof rec === "string" ? rec : rec.action}</p>
                  {rec.reasoning && <p className="text-xs text-muted-foreground mt-0.5">{rec.reasoning}</p>}
                  {rec.category && <Badge variant="outline" className="text-[10px] mt-1">{rec.category}</Badge>}
                </div>
              </div>
            ))}
          </div>
        </ReportSection>
      )}

      {renderLegacyList("Suggested Content Angles", insight.suggested_angles)}
    </div>
  );
}

function ReportSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground flex items-center gap-2">{icon} {title}</p>
      <div className="pl-6 space-y-1">{children}</div>
    </div>
  );
}

function renderList(label: string, items: any, highlight = false) {
  if (!items || !Array.isArray(items) || items.length === 0) return null;
  return (
    <div className="mt-1">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      {items.map((item: string, i: number) => (
        <p key={i} className={cn("text-xs pl-2 border-l-2 py-0.5", highlight ? "border-amber-500/40 text-amber-700 dark:text-amber-400" : "border-primary/30 text-muted-foreground")}>
          {item}
        </p>
      ))}
    </div>
  );
}

function renderLegacyList(title: string, data: any) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : typeof data === "object" ? Object.values(data) : [data];
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-foreground">{title}</p>
      {items.map((item: any, i: number) => (
        <p key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30 py-0.5">
          {typeof item === "string" ? item : JSON.stringify(item)}
        </p>
      ))}
    </div>
  );
}

export default CompetitorsPage;
