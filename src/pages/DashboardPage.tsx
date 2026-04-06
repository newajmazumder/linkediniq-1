import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lightbulb, FileText, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ ideas: 0, drafts: 0 });
  const [recentIdeas, setRecentIdeas] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const [ideasRes, draftsRes, recentRes] = await Promise.all([
        supabase.from("ideas").select("id", { count: "exact", head: true }),
        supabase.from("drafts").select("id", { count: "exact", head: true }),
        supabase.from("ideas").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      setStats({
        ideas: ideasRes.count ?? 0,
        drafts: draftsRes.count ?? 0,
      });
      setRecentIdeas(recentRes.data ?? []);
    };

    fetchStats();
  }, [user]);

  return (
    <div className="content-fade-in space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your content at a glance</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
              <Lightbulb className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.ideas}</p>
              <p className="text-xs text-muted-foreground">Ideas created</p>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary">
              <FileText className="h-4 w-4 text-foreground" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-foreground">{stats.drafts}</p>
              <p className="text-xs text-muted-foreground">Saved drafts</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-foreground">Recent ideas</h2>
          <Link to="/create" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Create new →
          </Link>
        </div>
        {recentIdeas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-12 text-center">
            <p className="text-sm text-muted-foreground">No ideas yet. Start by creating one.</p>
            <Link to="/create" className="mt-2 inline-block text-sm font-medium text-foreground hover:underline">
              Go to Create →
            </Link>
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
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(idea.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
