import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { Plus, Search, Filter, ExternalLink, Calendar, Target, MessageSquare, Eye, ThumbsUp, Share2, Tag } from "lucide-react";
import { toast } from "sonner";

type LinkedInPost = {
  id: string;
  content: string;
  publish_date: string | null;
  post_url: string | null;
  source_type: string;
  has_media: boolean;
  imported_at: string;
  context?: {
    goal: string | null;
    strategy_type: string | null;
    tone: string | null;
    hook_type: string | null;
  } | null;
  metrics?: {
    reactions: number;
    comments: number;
    reposts: number;
    impressions: number;
  } | null;
  evaluation?: {
    goal_fulfillment_score: number;
    fulfillment_status: string;
  } | null;
};

const goalColors: Record<string, string> = {
  "brand_awareness": "bg-blue-100 text-blue-700",
  "education": "bg-emerald-100 text-emerald-700",
  "storytelling": "bg-purple-100 text-purple-700",
  "lead_generation": "bg-amber-100 text-amber-700",
};

const statusColors: Record<string, string> = {
  "fulfilled": "text-green-600",
  "partially_fulfilled": "text-amber-600",
  "not_fulfilled": "text-red-600",
  "not_evaluated": "text-muted-foreground",
};

const PerformancePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importContent, setImportContent] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importDate, setImportDate] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchPosts();
  }, [user]);

  const fetchPosts = async () => {
    // Fetch posts with context and metrics
    const { data: postsData, error } = await supabase
      .from("linkedin_posts")
      .select("*")
      .order("publish_date", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    if (!postsData || postsData.length === 0) {
      setPosts([]);
      setLoading(false);
      return;
    }

    const postIds = postsData.map(p => p.id);

    // Fetch related data in parallel
    const [contextRes, metricsRes, evalRes] = await Promise.all([
      supabase.from("post_context").select("linkedin_post_id, goal, strategy_type, tone, hook_type").in("linkedin_post_id", postIds),
      supabase.from("post_metrics").select("linkedin_post_id, reactions, comments, reposts, impressions").in("linkedin_post_id", postIds),
      supabase.from("goal_evaluations").select("linkedin_post_id, goal_fulfillment_score, fulfillment_status").in("linkedin_post_id", postIds),
    ]);

    const contextMap = new Map((contextRes.data || []).map(c => [c.linkedin_post_id, c]));
    const metricsMap = new Map((metricsRes.data || []).map(m => [m.linkedin_post_id, m]));
    const evalMap = new Map((evalRes.data || []).map(e => [e.linkedin_post_id, e]));

    const enriched: LinkedInPost[] = postsData.map(p => ({
      ...p,
      context: contextMap.get(p.id) || null,
      metrics: metricsMap.get(p.id) || null,
      evaluation: evalMap.get(p.id) || null,
    }));

    setPosts(enriched);
    setLoading(false);
  };

  const handleImport = async () => {
    if (!importContent.trim()) {
      toast.error("Post content is required");
      return;
    }
    setImporting(true);
    try {
      const { error } = await supabase.from("linkedin_posts").insert({
        user_id: user!.id,
        content: importContent.trim(),
        post_url: importUrl.trim() || null,
        publish_date: importDate || null,
        source_type: "manual",
        has_media: false,
      });
      if (error) throw error;
      toast.success("Post imported successfully");
      setImportContent("");
      setImportUrl("");
      setImportDate("");
      setShowImport(false);
      await fetchPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  };

  const filtered = posts.filter(p => {
    const matchSearch = !search || p.content.toLowerCase().includes(search.toLowerCase());
    const matchGoal = !goalFilter || p.context?.goal === goalFilter;
    return matchSearch && matchGoal;
  });

  const totalPosts = posts.length;
  const evaluatedPosts = posts.filter(p => p.evaluation && p.evaluation.fulfillment_status !== "not_evaluated");
  const avgScore = evaluatedPosts.length > 0
    ? Math.round(evaluatedPosts.reduce((s, p) => s + (p.evaluation?.goal_fulfillment_score || 0), 0) / evaluatedPosts.length)
    : 0;
  const fulfilledCount = posts.filter(p => p.evaluation?.fulfillment_status === "fulfilled").length;

  return (
    <div className="content-fade-in h-full flex">
      {/* Left: Post list */}
      <div className="w-[420px] shrink-0 border-r border-border overflow-y-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Performance</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Track & analyze your LinkedIn posts</p>
          </div>
          <button
            onClick={() => setShowImport(!showImport)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Import
          </button>
        </div>

        {/* Import form */}
        {showImport && (
          <div className="rounded-lg border border-border bg-card p-4 mb-4 space-y-3">
            <h3 className="text-sm font-medium text-foreground">Import Published Post</h3>
            <textarea
              value={importContent}
              onChange={e => setImportContent(e.target.value)}
              placeholder="Paste your LinkedIn post content here..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="url"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              placeholder="LinkedIn post URL (optional)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <input
              type="date"
              value={importDate}
              onChange={e => setImportDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import Post"}
              </button>
              <button
                onClick={() => setShowImport(false)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-semibold text-foreground">{totalPosts}</p>
            <p className="text-[10px] text-muted-foreground">Posts</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-semibold text-foreground">{avgScore}%</p>
            <p className="text-[10px] text-muted-foreground">Avg Score</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-lg font-semibold text-foreground">{fulfilledCount}</p>
            <p className="text-[10px] text-muted-foreground">Goals Met</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search posts..."
              className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={goalFilter}
            onChange={e => setGoalFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All goals</option>
            <option value="brand_awareness">Brand Awareness</option>
            <option value="education">Education</option>
            <option value="storytelling">Storytelling</option>
            <option value="lead_generation">Lead Generation</option>
          </select>
        </div>

        {/* Post list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {posts.length === 0
                ? "No published posts yet. Import your first LinkedIn post to start tracking."
                : "No posts match your filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(post => (
              <Link
                key={post.id}
                to={`/performance/${post.id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors"
              >
                <p className="text-sm text-foreground line-clamp-2 mb-2">{post.content}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {post.publish_date && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.publish_date).toLocaleDateString()}
                    </span>
                  )}
                  {post.context?.goal && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${goalColors[post.context.goal] || "bg-secondary text-foreground"}`}>
                      <Target className="h-2.5 w-2.5" />
                      {post.context.goal.replace("_", " ")}
                    </span>
                  )}
                  {post.metrics && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <ThumbsUp className="h-2.5 w-2.5" />{post.metrics.reactions}
                      <MessageSquare className="h-2.5 w-2.5 ml-1" />{post.metrics.comments}
                      <Eye className="h-2.5 w-2.5 ml-1" />{post.metrics.impressions}
                    </span>
                  )}
                  {post.evaluation && post.evaluation.fulfillment_status !== "not_evaluated" && (
                    <span className={`text-[10px] font-medium ${statusColors[post.evaluation.fulfillment_status]}`}>
                      {post.evaluation.goal_fulfillment_score}%
                    </span>
                  )}
                  {!post.context?.goal && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-600">
                      <Tag className="h-2.5 w-2.5" />
                      Needs tagging
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Right: Empty state / instructions */}
      <div className="flex-1 overflow-y-auto px-6 py-8 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Target className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">Select a post to analyze</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Click on any post from the list to see its performance analysis, writing diagnosis, and strategic recommendations.
          </p>
          <p className="text-xs text-muted-foreground">
            Import your published LinkedIn posts, tag them with goals and strategy context, add performance metrics, then run AI analysis to understand what works and what to improve.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerformancePage;
