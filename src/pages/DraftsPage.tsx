import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, Save, Copy, X } from "lucide-react";

type Draft = {
  id: string;
  idea_id: string;
  selected_post_id: string | null;
  custom_content: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  ideas?: { idea_title: string | null; instruction: string } | null;
};

const DraftsPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const fetchDrafts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("drafts")
      .select("*, ideas(idea_title, instruction)")
      .order("created_at", { ascending: false });

    if (!error && data) setDrafts(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrafts();
  }, [user]);

  const startEdit = (draft: Draft) => {
    setEditingId(draft.id);
    setEditContent(draft.custom_content || "");
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase
      .from("drafts")
      .update({ custom_content: editContent })
      .eq("id", editingId);

    if (error) {
      toast.error("Failed to save");
    } else {
      toast.success("Draft updated");
      setEditingId(null);
      fetchDrafts();
    }
  };

  const deleteDraft = async (id: string) => {
    const { error } = await supabase.from("drafts").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Draft deleted");
      setDrafts(drafts.filter((d) => d.id !== id));
    }
  };

  const copyDraft = (content: string | null) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    toast.success("Copied");
  };

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
        <h1 className="text-2xl font-semibold text-foreground">Drafts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {drafts.length} saved {drafts.length === 1 ? "draft" : "drafts"}
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No drafts saved yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">
                    {(draft.ideas as any)?.idea_title || (draft.ideas as any)?.instruction || "Untitled"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {new Date(draft.created_at).toLocaleDateString()} ·{" "}
                    <span className="capitalize">{draft.status}</span>
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => copyDraft(draft.custom_content)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteDraft(draft.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {editingId === draft.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit}>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="mr-1.5 h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startEdit(draft)}
                  className="cursor-pointer rounded-md bg-secondary/50 p-3 text-sm text-foreground whitespace-pre-line leading-relaxed hover:bg-secondary transition-colors"
                >
                  {draft.custom_content || "No content"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DraftsPage;
