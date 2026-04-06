import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Trash2, Save, Copy, X, CalendarIcon, Check, XCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Draft = {
  id: string;
  idea_id: string;
  selected_post_id: string | null;
  custom_content: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  updated_at: string;
  ideas?: { idea_title: string | null; instruction: string } | null;
};

const statusOptions = ["idea", "draft", "approved", "scheduled", "posted"] as const;
type Status = (typeof statusOptions)[number];

const statusColors: Record<Status, string> = {
  idea: "bg-muted text-muted-foreground",
  draft: "bg-secondary text-secondary-foreground",
  approved: "bg-primary/20 text-primary",
  scheduled: "bg-accent text-accent-foreground",
  posted: "bg-primary text-primary-foreground",
};

const DraftsPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [scheduleId, setScheduleId] = useState<string | null>(null);

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

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase
      .from("drafts")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      setDrafts((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status } : d))
      );
      toast.success(`Marked as ${status}`);
    }
  };

  const scheduleDraft = async (id: string, date: Date) => {
    const { error } = await supabase
      .from("drafts")
      .update({ scheduled_at: date.toISOString(), status: "scheduled" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to schedule");
    } else {
      toast.success(`Scheduled for ${format(date, "PPP")}`);
      setScheduleId(null);
      fetchDrafts();
    }
  };

  const approveDraft = (id: string) => updateStatus(id, "approved");
  const rejectDraft = (id: string) => updateStatus(id, "draft");

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

  const filtered = filter === "all" ? drafts : drafts.filter((d) => d.status === filter);

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
        <h1 className="text-2xl font-semibold text-foreground">Drafts & Workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {drafts.length} saved {drafts.length === 1 ? "draft" : "drafts"}
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", ...statusOptions] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize",
              filter === s
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s}
            {s !== "all" && (
              <span className="ml-1 text-muted-foreground">
                {drafts.filter((d) => d.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {filter === "all" ? "No drafts saved yet." : `No ${filter} drafts.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => (
            <div key={draft.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground truncate">
                    {(draft.ideas as any)?.idea_title || (draft.ideas as any)?.instruction || "Untitled"}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">
                      {new Date(draft.created_at).toLocaleDateString()}
                    </span>
                    {/* Status pills */}
                    <div className="flex gap-1">
                      {statusOptions.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(draft.id, s)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors",
                            draft.status === s
                              ? statusColors[s]
                              : "bg-transparent text-muted-foreground hover:bg-secondary"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {draft.scheduled_at && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(draft.scheduled_at), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {/* Review actions */}
                  {draft.status === "draft" && (
                    <button
                      onClick={() => approveDraft(draft.id)}
                      title="Approve"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {draft.status === "approved" && (
                    <button
                      onClick={() => rejectDraft(draft.id)}
                      title="Send back to draft"
                      className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {/* Schedule */}
                  {(draft.status === "approved" || draft.status === "draft") && (
                    <Popover open={scheduleId === draft.id} onOpenChange={(o) => setScheduleId(o ? draft.id : null)}>
                      <PopoverTrigger asChild>
                        <button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Schedule">
                          <CalendarIcon className="h-3.5 w-3.5" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={draft.scheduled_at ? new Date(draft.scheduled_at) : undefined}
                          onSelect={(date) => date && scheduleDraft(draft.id, date)}
                          disabled={(date) => date < new Date()}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  )}
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
