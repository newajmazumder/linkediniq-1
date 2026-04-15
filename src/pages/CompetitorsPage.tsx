import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2, Plus, Trash2, ChevronDown, ChevronUp, Eye, Lightbulb, ExternalLink, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

type Competitor = {
  id: string;
  name: string;
  linkedin_url: string | null;
  tags: string[] | null;
  created_at: string;
};

type CompetitorPost = {
  id: string;
  competitor_id: string;
  content: string;
  topic: string | null;
  hook_style: string | null;
  tone: string | null;
  cta_type: string | null;
};

type CompetitorInsight = {
  id: string;
  competitor_id: string | null;
  patterns: any;
  gaps: any;
  overused_themes: any;
  suggested_angles: any;
};

const CompetitorsPage = () => {
  const { user } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [posts, setPosts] = useState<Record<string, CompetitorPost[]>>({});
  const [insights, setInsights] = useState<Record<string, CompetitorInsight | null>>({});
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  // Add competitor form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  // Add post form
  const [addingPostFor, setAddingPostFor] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostTopic, setNewPostTopic] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  useEffect(() => {
    if (user) fetchCompetitors();
  }, [user]);

  const fetchCompetitors = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("competitors")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setCompetitors(data || []);
    setLoading(false);
  };

  const addCompetitor = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("competitors").insert({
      user_id: user!.id,
      name: newName.trim(),
      linkedin_url: newUrl.trim() || null,
      tags: tags.length > 0 ? tags : null,
    });
    if (error) {
      toast.error("Failed to add competitor");
    } else {
      toast.success("Competitor added");
      setNewName(""); setNewUrl(""); setNewTags(""); setShowAdd(false);
      fetchCompetitors();
    }
    setAdding(false);
  };

  const deleteCompetitor = async (id: string) => {
    const { error } = await supabase.from("competitors").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Competitor removed");
      setCompetitors((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!posts[id]) {
      const [postsRes, insightRes] = await Promise.all([
        supabase.from("competitor_posts").select("*").eq("competitor_id", id).eq("user_id", user!.id),
        supabase.from("competitor_insights").select("*").eq("competitor_id", id).eq("user_id", user!.id).maybeSingle(),
      ]);
      setPosts((prev) => ({ ...prev, [id]: postsRes.data || [] }));
      setInsights((prev) => ({ ...prev, [id]: insightRes.data || null }));
    }
  };

  const addPost = async (competitorId: string) => {
    if (!newPostContent.trim()) return;
    setSavingPost(true);
    const { error } = await supabase.from("competitor_posts").insert({
      user_id: user!.id,
      competitor_id: competitorId,
      content: newPostContent.trim(),
      topic: newPostTopic.trim() || null,
    });
    if (error) toast.error("Failed to add post");
    else {
      toast.success("Post added");
      setNewPostContent(""); setNewPostTopic(""); setAddingPostFor(null);
      const { data } = await supabase.from("competitor_posts").select("*").eq("competitor_id", competitorId).eq("user_id", user!.id);
      setPosts((prev) => ({ ...prev, [competitorId]: data || [] }));
    }
    setSavingPost(false);
  };

  const deletePost = async (postId: string, competitorId: string) => {
    await supabase.from("competitor_posts").delete().eq("id", postId);
    setPosts((prev) => ({
      ...prev,
      [competitorId]: (prev[competitorId] || []).filter((p) => p.id !== postId),
    }));
    toast.success("Post removed");
  };

  const analyzeCompetitor = async (competitorId: string) => {
    const competitorPosts = posts[competitorId];
    if (!competitorPosts || competitorPosts.length < 2) {
      toast.error("Add at least 2 posts before analyzing");
      return;
    }
    setAnalyzingId(competitorId);
    try {
      const competitor = competitors.find((c) => c.id === competitorId);
      const { data, error } = await supabase.functions.invoke("analyze-competitor", {
        body: { competitor_id: competitorId, competitor_name: competitor?.name, posts: competitorPosts },
      });
      if (error) throw error;
      // Refresh insights
      const { data: insightData } = await supabase
        .from("competitor_insights")
        .select("*")
        .eq("competitor_id", competitorId)
        .eq("user_id", user!.id)
        .maybeSingle();
      setInsights((prev) => ({ ...prev, [competitorId]: insightData || null }));
      toast.success("Analysis complete");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    }
    setAnalyzingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Competitors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track competitor content and discover strategic gaps you can exploit.
          </p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Competitor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Competitor</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <Input placeholder="Competitor name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="LinkedIn profile URL (optional)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
              <Input placeholder="Tags (comma separated, e.g. SaaS, AI)" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
              <Button onClick={addCompetitor} disabled={adding || !newName.trim()} className="w-full">
                {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {competitors.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No competitors tracked yet. Add one to start analyzing their content strategy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((comp) => {
            const isExpanded = expandedId === comp.id;
            const compPosts = posts[comp.id] || [];
            const compInsight = insights[comp.id];
            return (
              <div key={comp.id} className="border border-border rounded-lg bg-card overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => toggleExpand(comp.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left">
                    <div>
                      <p className="font-medium text-foreground text-sm">{comp.name}</p>
                      {comp.linkedin_url && (
                        <a
                          href={comp.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <ExternalLink className="h-3 w-3" /> LinkedIn
                        </a>
                      )}
                    </div>
                    {comp.tags && comp.tags.length > 0 && (
                      <div className="flex gap-1">
                        {comp.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); deleteCompetitor(comp.id); }}
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4">
                    {/* Posts section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tracked Posts ({compPosts.length})</p>
                        <Button size="sm" variant="outline" onClick={() => setAddingPostFor(comp.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add Post
                        </Button>
                      </div>

                      {addingPostFor === comp.id && (
                        <div className="border border-border rounded-md p-3 space-y-2 bg-muted/30">
                          <Input placeholder="Topic (optional)" value={newPostTopic} onChange={(e) => setNewPostTopic(e.target.value)} />
                          <Textarea placeholder="Paste competitor's post content here..." value={newPostContent} onChange={(e) => setNewPostContent(e.target.value)} rows={4} />
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setAddingPostFor(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => addPost(comp.id)} disabled={savingPost || !newPostContent.trim()}>
                              {savingPost ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Save Post
                            </Button>
                          </div>
                        </div>
                      )}

                      {compPosts.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No posts tracked yet. Add competitor posts to enable analysis.</p>
                      ) : (
                        <div className="space-y-2">
                          {compPosts.map((post) => (
                            <div key={post.id} className="border border-border rounded-md p-3 bg-background">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  {post.topic && <p className="text-xs font-medium text-primary mb-1">{post.topic}</p>}
                                  <p className="text-xs text-foreground line-clamp-3 whitespace-pre-wrap">{post.content}</p>
                                  {(post.hook_style || post.tone || post.cta_type) && (
                                    <div className="flex gap-1.5 mt-2">
                                      {post.hook_style && <Badge variant="outline" className="text-[10px]">Hook: {post.hook_style}</Badge>}
                                      {post.tone && <Badge variant="outline" className="text-[10px]">Tone: {post.tone}</Badge>}
                                      {post.cta_type && <Badge variant="outline" className="text-[10px]">CTA: {post.cta_type}</Badge>}
                                    </div>
                                  )}
                                </div>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                  onClick={() => deletePost(post.id, comp.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Analyze button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => analyzeCompetitor(comp.id)}
                      disabled={analyzingId === comp.id || compPosts.length < 2}
                    >
                      {analyzingId === comp.id ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Analyzing...</>
                      ) : (
                        <><Lightbulb className="h-3.5 w-3.5 mr-1" /> Analyze Content Strategy</>
                      )}
                    </Button>

                    {/* Insights */}
                    {compInsight && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5" /> AI Insights
                        </p>
                        {renderInsightBlock("Content Patterns", compInsight.patterns)}
                        {renderInsightBlock("Strategic Gaps You Can Exploit", compInsight.gaps)}
                        {renderInsightBlock("Overused Themes", compInsight.overused_themes)}
                        {renderInsightBlock("Suggested Angles for You", compInsight.suggested_angles)}
                      </div>
                    )}
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

function renderInsightBlock(title: string, data: any) {
  if (!data) return null;
  const items = Array.isArray(data) ? data : typeof data === "object" ? Object.values(data) : [data];
  if (items.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((item: any, i: number) => (
          <li key={i} className="text-xs text-muted-foreground pl-3 border-l-2 border-primary/30 py-0.5">
            {typeof item === "string" ? item : JSON.stringify(item)}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default CompetitorsPage;
