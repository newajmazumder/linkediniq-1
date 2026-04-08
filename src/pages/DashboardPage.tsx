import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, FileText, Clock, Sparkles, Loader2, TrendingUp, ArrowRight, Beaker, Wrench, Repeat } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Recommendation = {
  topic: string;
  hook_type: string;
  tone: string;
  persona_name: string;
  content_type: string;
  cta_type: string;
  reason: string;
  recommendation_type?: string;
  supporting_pattern?: string;
};

const recTypeConfig: Record<string, { icon: any; label: string; color: string }> = {
  exploit: { icon: Repeat, label: "Exploit", color: "bg-green-500/10 text-green-600 border-green-500/20" },
  fix: { icon: Wrench, label: "Fix", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  experiment: { icon: Beaker, label: "Experiment", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
};

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ ideas: 0, drafts: 0 });
  const [recentIdeas, setRecentIdeas] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const [ideasRes, draftsRes, recentRes] = await Promise.all([
        supabase.from("ideas").select("id", { count: "exact", head: true }),
        supabase.from("drafts").select("id", { count: "exact", head: true }),
        supabase.from("ideas").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({ ideas: ideasRes.count ?? 0, drafts: draftsRes.count ?? 0 });
      setRecentIdeas(recentRes.data ?? []);
    };
    const fetchRecs = async () => {
      const { data } = await supabase.from("strategy_recommendations").select("recommendation").eq("user_id", user.id).eq("status", "pending").order("created_at", { ascending: false }).limit(3);
      if (data) setRecommendations(data.map((r: any) => r.recommendation as Recommendation));
    };
    fetchStats();
    fetchRecs();
  }, [user]);

  const generateRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-next");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecommendations(data.recommendations || []);
      toast.success("Recommendations generated!");
    } catch (err: any) { toast.error(err.message || "Failed"); } finally { setLoadingRecs(false); }
  };

  return (
    <div className="content-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your content at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary"><Lightbulb className="h-4 w-4 text-foreground" /></div>
            <div><p className="text-2xl font-semibold text-foreground">{stats.ideas}</p><p className="text-xs text-muted-foreground">Ideas created</p></div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary"><FileText className="h-4 w-4 text-foreground" /></div>
            <div><p className="text-2xl font-semibold text-foreground">{stats.drafts}</p><p className="text-xs text-muted-foreground">Saved drafts</p></div>
          </div>
        </div>
      </div>

      {/* What to Post Next */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />What to Post Next</h2>
          <Button size="sm" variant="outline" onClick={generateRecommendations} disabled={loadingRecs}>
            {loadingRecs ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {recommendations.length > 0 ? "Refresh" : "Generate"}
          </Button>
        </div>

        {recommendations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">Click "Generate" to get AI-powered content recommendations.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((rec, i) => {
              const typeConfig = recTypeConfig[rec.recommendation_type || ""] || null;
              const TypeIcon = typeConfig?.icon;
              return (
                <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{rec.topic}</p>
                      {typeConfig && (
                        <Badge variant="outline" className={cn("text-[10px]", typeConfig.color)}>
                          {TypeIcon && <TypeIcon className="h-3 w-3 mr-1" />}
                          {typeConfig.label}
                        </Badge>
                      )}
                    </div>
                    <Link to="/create" className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Create this post">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{rec.hook_type}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{rec.tone}</span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{rec.content_type}</span>
                    {rec.persona_name && <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">{rec.persona_name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{rec.reason}</p>
                  {rec.supporting_pattern && (
                    <p className="text-[10px] text-primary/80 italic">📊 {rec.supporting_pattern}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent ideas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">Recent ideas</h2>
          <Link to="/create" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Create new →</Link>
        </div>
        {recentIdeas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No ideas yet. Start by creating one.</p>
            <Link to="/create" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">Go to Create →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentIdeas.map((idea) => (
              <div key={idea.id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Clock className="mt-0.5 h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{idea.idea_title || idea.instruction}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {idea.objective && <span className="capitalize">{idea.objective}</span>}
                    {idea.target_audience && <span> · {idea.target_audience}</span>}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(idea.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
