import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  Trash2,
  Search,
  Sparkles,
  Lightbulb,
  Eye,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";

type Competitor = {
  id: string;
  name: string;
  linkedin_url: string | null;
  tags: string[];
  created_at: string;
};

type PostAnalysis = {
  hook_style: string;
  tone: string;
  topic: string;
  cta_type: string;
};

type Insights = {
  patterns: string[];
  overused_themes: string[];
  gaps: string[];
  suggested_angles: string[];
};

type GapIdea = {
  title: string;
  angle: string;
  why_it_works: string;
  suggested_hook: string;
  post_style: string;
};

const CompetitorsPage = () => {
  const { user } = useAuth();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTags, setNewTags] = useState("");
  const [adding, setAdding] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pastedPosts, setPastedPosts] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [postAnalyses, setPostAnalyses] = useState<PostAnalysis[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);

  const [gapIdeas, setGapIdeas] = useState<GapIdea[]>([]);
  const [generatingIdeas, setGeneratingIdeas] = useState(false);

  const [expandedSections, setExpandedSections] = useState({
    analyses: true,
    insights: true,
    ideas: true,
  });

  useEffect(() => {
    if (user) fetchCompetitors();
  }, [user]);

  const fetchCompetitors = async () => {
    const { data } = await supabase
      .from("competitors")
      .select("*")
      .order("created_at", { ascending: false });
    setCompetitors((data as any[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!newName.trim() || !user) return;
    setAdding(true);
    const tags = newTags.split(",").map((t) => t.trim()).filter(Boolean);
    const { error } = await supabase.from("competitors").insert({
      user_id: user.id,
      name: newName.trim(),
      linkedin_url: newUrl.trim() || null,
      tags,
    } as any);
    if (error) {
      toast.error("Failed to add competitor");
    } else {
      toast.success("Competitor added");
      setNewName("");
      setNewUrl("");
      setNewTags("");
      setShowAdd(false);
      fetchCompetitors();
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("competitors").delete().eq("id", id);
    setCompetitors((prev) => prev.filter((c) => c.id !== id));
    if (selectedId === id) {
      setSelectedId(null);
      setPostAnalyses([]);
      setInsights(null);
      setGapIdeas([]);
    }
    toast.success("Competitor removed");
  };

  const handleAnalyze = async () => {
    if (!pastedPosts.trim() || !selectedId) return;
    setAnalyzing(true);
    setPostAnalyses([]);
    setInsights(null);
    setGapIdeas([]);
    const posts = pastedPosts.split(/\n{2,}|---/).map((p) => p.trim()).filter((p) => p.length > 20);
    if (posts.length === 0) {
      toast.error("Paste at least one post (separate multiple posts with blank lines)");
      setAnalyzing(false);
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke("analyze-competitor", {
        body: { action: "analyze_posts", competitor_id: selectedId, posts },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPostAnalyses(data.analysis.post_analyses || []);
      setInsights({
        patterns: data.analysis.patterns || [],
        overused_themes: data.analysis.overused_themes || [],
        gaps: data.analysis.gaps || [],
        suggested_angles: data.analysis.suggested_angles || [],
      });
      toast.success("Analysis complete!");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateFromGaps = async () => {
    if (!selectedId) return;
    setGeneratingIdeas(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-competitor", {
        body: { action: "generate_from_gaps", competitor_id: selectedId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGapIdeas(data.ideas || []);
      toast.success("Ideas generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate ideas");
    } finally {
      setGeneratingIdeas(false);
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const selectedCompetitor = competitors.find((c) => c.id === selectedId);
  const hasOutput = postAnalyses.length > 0 || insights || gapIdeas.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="content-fade-in flex h-full">
      {/* Left column — Competitors list & paste input */}
      <div className={`space-y-5 overflow-y-auto transition-all duration-300 ${hasOutput ? "w-[380px] min-w-[340px] shrink-0 border-r border-border px-6 py-8" : "mx-auto w-full max-w-2xl px-6 py-8"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Competitors</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Analyze competitor content and find gaps to exploit.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? <X className="mr-1.5 h-3.5 w-3.5" /> : <Plus className="mr-1.5 h-3.5 w-3.5" />}
            {showAdd ? "Cancel" : "Add"}
          </Button>
        </div>

        {/* Add Competitor Form */}
        {showAdd && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <Input placeholder="Competitor name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="LinkedIn URL (optional)" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} />
            <Input placeholder="Tags (comma-separated)" value={newTags} onChange={(e) => setNewTags(e.target.value)} />
            <Button size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>
              {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Add
            </Button>
          </div>
        )}

        {/* Competitor List */}
        <div className="space-y-2">
          {competitors.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedId(c.id === selectedId ? null : c.id);
                setPostAnalyses([]);
                setInsights(null);
                setGapIdeas([]);
                setPastedPosts("");
              }}
              className={`group relative w-full rounded-lg border p-3 text-left transition-colors ${
                selectedId === c.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  {c.linkedin_url && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.linkedin_url}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {c.tags && c.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                  ))}
                </div>
              )}
            </button>
          ))}
          {competitors.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">No competitors added yet.</p>
            </div>
          )}
        </div>

        {/* Paste Posts Panel */}
        {selectedCompetitor && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground mb-2">
              Paste {selectedCompetitor.name}'s posts
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Separate multiple posts with blank lines or ---.
            </p>
            <Textarea
              placeholder="Paste competitor posts here..."
              value={pastedPosts}
              onChange={(e) => setPastedPosts(e.target.value)}
              rows={6}
              className="resize-none text-sm"
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {pastedPosts.split(/\n{2,}|---/).filter((p) => p.trim().length > 20).length} post(s) detected
              </span>
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing || !pastedPosts.trim()}>
                {analyzing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                Analyze
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right column — Analysis results */}
      {hasOutput && (
        <div className="flex-1 min-w-0 overflow-y-auto space-y-4 px-6 py-8">
          {/* Post Analyses */}
          {postAnalyses.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <button onClick={() => toggleSection("analyses")} className="flex w-full items-center justify-between p-4">
                <h3 className="text-sm font-medium text-foreground">Post Breakdown</h3>
                {expandedSections.analyses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSections.analyses && (
                <div className="border-t border-border p-4 space-y-3">
                  {postAnalyses.map((pa, i) => (
                    <div key={i} className="rounded-md bg-muted/50 p-3 space-y-1.5">
                      <p className="text-xs font-medium text-foreground">Post {i + 1}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Hook: </span><span className="text-foreground">{pa.hook_style}</span></div>
                        <div><span className="text-muted-foreground">Tone: </span><span className="text-foreground">{pa.tone}</span></div>
                        <div><span className="text-muted-foreground">Topic: </span><span className="text-foreground">{pa.topic}</span></div>
                        <div><span className="text-muted-foreground">CTA: </span><span className="text-foreground">{pa.cta_type}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Insights */}
          {insights && (
            <div className="rounded-lg border border-border bg-card">
              <button onClick={() => toggleSection("insights")} className="flex w-full items-center justify-between p-4">
                <h3 className="text-sm font-medium text-foreground">Insights</h3>
                {expandedSections.insights ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSections.insights && (
                <div className="border-t border-border p-4 space-y-4">
                  <InsightBlock title="Patterns" items={insights.patterns} color="text-blue-500" />
                  <InsightBlock title="Overused Themes" items={insights.overused_themes} color="text-amber-500" />
                  <InsightBlock title="Gaps to Exploit" items={insights.gaps} color="text-green-500" />
                  <InsightBlock title="Suggested Angles" items={insights.suggested_angles} color="text-purple-500" />
                  <Button size="sm" onClick={handleGenerateFromGaps} disabled={generatingIdeas} className="w-full">
                    {generatingIdeas ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="mr-1.5 h-3.5 w-3.5" />}
                    Generate ideas from competitor gaps
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Gap Ideas */}
          {gapIdeas.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <button onClick={() => toggleSection("ideas")} className="flex w-full items-center justify-between p-4">
                <h3 className="text-sm font-medium text-foreground">
                  <Sparkles className="mr-1.5 inline h-4 w-4 text-primary" />
                  Content Ideas from Gaps
                </h3>
                {expandedSections.ideas ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedSections.ideas && (
                <div className="border-t border-border p-4 space-y-3">
                  {gapIdeas.map((idea, i) => (
                    <div key={i} className="rounded-md border border-border p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <p className="text-sm font-medium text-foreground">{idea.title}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{idea.post_style.replace("_", " ")}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{idea.angle}</p>
                      <div className="rounded bg-muted/50 p-2">
                        <p className="text-xs text-muted-foreground mb-0.5">Suggested hook:</p>
                        <p className="text-xs text-foreground italic">"{idea.suggested_hook}"</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-medium">Why it works:</span> {idea.why_it_works}
                      </p>
                    </div>
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

const InsightBlock = ({ title, items, color }: { title: string; items: string[]; color: string }) => {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className={`text-xs font-medium ${color} mb-1.5`}>{title}</p>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-foreground/80 pl-3 relative before:absolute before:left-0 before:top-1.5 before:h-1 before:w-1 before:rounded-full before:bg-current">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CompetitorsPage;
