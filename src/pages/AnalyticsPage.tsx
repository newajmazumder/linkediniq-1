import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BarChart3,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  MessageCircle,
  Loader2,
  Save,
  Sparkles,
  Users,
  Zap,
  BookOpen,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PostedDraft = {
  id: string;
  custom_content: string | null;
  status: string;
  ideas?: { idea_title: string | null } | null;
  performance?: {
    id: string;
    impressions: number;
    likes: number;
    comments: number;
  } | null;
};

type Insights = {
  best_hooks: string[];
  best_themes: string[];
  best_post_types: string[];
  summary: string;
};

type Suggestions = {
  post_next: string[];
  avoid: string[];
};

type PersonaInsight = {
  persona_name: string;
  best_hook_type: string;
  best_content_style: string;
  best_tone: string;
  best_content_intent: string;
  engagement_pattern: string;
  recommendation: string;
};

type ContentLearnings = {
  hook_performance: {
    curiosity: string;
    contrarian: string;
    pain_driven: string;
    data_bold: string;
  };
  style_performance: {
    storytelling: string;
    educational: string;
    hybrid: string;
    product_led: string;
  };
  tone_performance: string;
};

type LearnedPattern = {
  dimension: string;
  dimension_value: string;
  sample_count: number;
  avg_impressions: number;
  avg_engagement_rate: number;
  avg_likes: number;
  avg_comments: number;
  insight: string | null;
};

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<PostedDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [learning, setLearning] = useState(false);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [personaInsights, setPersonaInsights] = useState<PersonaInsight[]>([]);
  const [contentLearnings, setContentLearnings] = useState<ContentLearnings | null>(null);
  const [learnedPatterns, setLearnedPatterns] = useState<LearnedPattern[]>([]);
  const [perfInputs, setPerfInputs] = useState<
    Record<string, { impressions: string; likes: string; comments: string }>
  >({});
  const fetchData = async () => {
    if (!user) return;

    const { data: draftData } = await supabase
      .from("drafts")
      .select("id, custom_content, status, ideas(idea_title)")
      .eq("status", "posted")
      .order("updated_at", { ascending: false });

    const { data: perfData } = await supabase
      .from("post_performance")
      .select("*")
      .eq("user_id", user.id);

    const merged: PostedDraft[] = (draftData || []).map((d: any) => {
      const perf = (perfData || []).find((p: any) => p.draft_id === d.id);
      return { ...d, performance: perf || null };
    });

    setDrafts(merged);

    const inputs: typeof perfInputs = {};
    merged.forEach((d) => {
      inputs[d.id] = {
        impressions: String(d.performance?.impressions || 0),
        likes: String(d.performance?.likes || 0),
        comments: String(d.performance?.comments || 0),
      };
    });
    setPerfInputs(inputs);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    fetchPatterns();
  }, [user]);

  const fetchPatterns = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("content_patterns")
      .select("*")
      .eq("user_id", user.id)
      .order("avg_engagement_rate", { ascending: false });
    setLearnedPatterns((data || []) as LearnedPattern[]);
  };

  const learnFromData = async () => {
    setLearning(true);
    try {
      const { data, error } = await supabase.functions.invoke("learn-patterns");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Learned ${data.patterns_count || 0} patterns!`);
      fetchPatterns();
    } catch (err: any) {
      toast.error(err.message || "Failed to learn patterns");
    } finally {
      setLearning(false);
    }
  };

  const savePerformance = async (draftId: string) => {
    if (!user) return;
    const input = perfInputs[draftId];
    if (!input) return;

    setSaving(draftId);
    const payload = {
      draft_id: draftId,
      user_id: user.id,
      impressions: parseInt(input.impressions) || 0,
      likes: parseInt(input.likes) || 0,
      comments: parseInt(input.comments) || 0,
    };

    const existing = drafts.find((d) => d.id === draftId)?.performance;

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("post_performance")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("post_performance").insert(payload));
    }

    if (error) {
      toast.error("Failed to save metrics");
    } else {
      toast.success("Metrics saved");
      fetchData();
    }
    setSaving(null);
  };

  const generateInsights = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "analyze-performance"
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInsights(data.insights || null);
      setSuggestions(data.suggestions || null);
      setPersonaInsights(data.persona_insights || []);
      setContentLearnings(data.content_learnings || null);
      toast.success("Insights generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate insights");
    } finally {
      setAnalyzing(false);
    }
  };

  const updateInput = (
    draftId: string,
    field: "impressions" | "likes" | "comments",
    value: string
  ) => {
    setPerfInputs((prev) => ({
      ...prev,
      [draftId]: { ...prev[draftId], [field]: value },
    }));
  };

  const totalImpressions = drafts.reduce(
    (s, d) => s + (d.performance?.impressions || 0),
    0
  );
  const totalLikes = drafts.reduce(
    (s, d) => s + (d.performance?.likes || 0),
    0
  );
  const totalComments = drafts.reduce(
    (s, d) => s + (d.performance?.comments || 0),
    0
  );
  const avgEngagement =
    totalImpressions > 0
      ? (((totalLikes + totalComments) / totalImpressions) * 100).toFixed(1)
      : "0";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="content-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track performance, get persona-specific insights, and let the system learn what works.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Posts", value: drafts.length, icon: BarChart3 },
          { label: "Impressions", value: totalImpressions.toLocaleString(), icon: Eye },
          { label: "Likes", value: totalLikes.toLocaleString(), icon: Heart },
          { label: "Avg Engagement", value: `${avgEngagement}%`, icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Performance Input */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Performance Input
          </h2>
          <Button
            onClick={generateInsights}
            disabled={analyzing || drafts.length === 0}
            size="sm"
          >
            {analyzing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            Generate Insights
          </Button>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No posted content yet. Publish posts to start tracking
              performance.
            </p>
          </div>
        ) : (
          drafts.map((draft) => (
            <div
              key={draft.id}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {(draft.ideas as any)?.idea_title || "Untitled Post"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                    {draft.custom_content?.slice(0, 100) || "No content"}
                  </p>
                </div>
                {draft.performance && (
                  <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                    {draft.performance.impressions > 0
                      ? `${(
                          ((draft.performance.likes +
                            draft.performance.comments) /
                            draft.performance.impressions) *
                          100
                        ).toFixed(1)}% engagement`
                      : "No data"}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Impressions"
                    value={perfInputs[draft.id]?.impressions || ""}
                    onChange={(e) =>
                      updateInput(draft.id, "impressions", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <Heart className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Likes"
                    value={perfInputs[draft.id]?.likes || ""}
                    onChange={(e) =>
                      updateInput(draft.id, "likes", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-1">
                  <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    type="number"
                    min="0"
                    placeholder="Comments"
                    value={perfInputs[draft.id]?.comments || ""}
                    onChange={(e) =>
                      updateInput(draft.id, "comments", e.target.value)
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() => savePerformance(draft.id)}
                  disabled={saving === draft.id}
                >
                  {saving === draft.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Insights */}
      {insights && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            Insights
          </h2>

          {insights.summary && (
            <p className="text-sm text-muted-foreground rounded-lg border border-border bg-card p-4">
              {insights.summary}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { title: "Best Hooks", items: insights.best_hooks },
              { title: "Best Themes", items: insights.best_themes },
              { title: "Best Post Types", items: insights.best_post_types },
            ].map(({ title, items }) => (
              <div
                key={title}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <h3 className="text-xs font-medium text-primary">{title}</h3>
                {items && items.length > 0 ? (
                  <ul className="space-y-1">
                    {items.map((item, i) => (
                      <li
                        key={i}
                        className="text-xs text-foreground flex items-start gap-1.5"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not enough data yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Persona-Specific Insights */}
      {personaInsights.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Persona Learnings
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {personaInsights.map((pi, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-4 space-y-3"
              >
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary shrink-0" />
                  <h3 className="text-sm font-medium text-foreground">{pi.persona_name}</h3>
                </div>

                <p className="text-xs text-primary font-medium italic">
                  "{pi.engagement_pattern}"
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Best Hook", value: pi.best_hook_type },
                    { label: "Best Style", value: pi.best_content_style },
                    { label: "Best Tone", value: pi.best_tone },
                    { label: "Best Intent", value: pi.best_content_intent },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                      <p className="text-xs font-medium text-foreground">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-border pt-2">
                  <div className="flex items-start gap-1.5">
                    <Zap className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">{pi.recommendation}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content Learnings */}
      {contentLearnings && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Content Performance Breakdown
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Hook Performance */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-medium text-primary">Hook Performance</h3>
              {Object.entries(contentLearnings.hook_performance || {}).map(([key, val]) => (
                <div key={key} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">{key.replace("_", " ")}</span>
                    <p className="text-xs text-foreground">{val}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Style Performance */}
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <h3 className="text-xs font-medium text-primary">Style Performance</h3>
              {Object.entries(contentLearnings.style_performance || {}).map(([key, val]) => (
                <div key={key} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <div>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">{key.replace("_", " ")}</span>
                    <p className="text-xs text-foreground">{val}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {contentLearnings.tone_performance && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-medium text-primary mb-1">Tone Performance</h3>
              <p className="text-xs text-foreground">{contentLearnings.tone_performance}</p>
            </div>
          )}
        </div>
      )}

      {/* Smart Suggestions */}
      {suggestions && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Smart Suggestions
          </h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-medium text-primary">
                  What to Post Next
                </h3>
              </div>
              {suggestions.post_next && suggestions.post_next.length > 0 ? (
                <ul className="space-y-1.5">
                  {suggestions.post_next.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-foreground flex items-start gap-1.5"
                    >
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add more data to get suggestions.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                <h3 className="text-xs font-medium text-destructive">
                  What to Avoid
                </h3>
              </div>
              {suggestions.avoid && suggestions.avoid.length > 0 ? (
                <ul className="space-y-1.5">
                  {suggestions.avoid.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs text-foreground flex items-start gap-1.5"
                    >
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nothing to flag yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
