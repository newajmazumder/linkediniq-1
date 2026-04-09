import { useEffect, useState } from "react";
import LinkedInPostPreview from "@/components/create/LinkedInPostPreview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { Trash2, Save, Copy, X, CalendarIcon, Check, XCircle, Loader2, BarChart3, AlertTriangle, CheckCircle, Lightbulb, ShieldAlert, ShieldCheck, Zap, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getScoreInterpretation } from "@/components/create/PostCard";

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

type PredictionResult = {
  hook_strength: number;
  persona_relevance: number;
  clarity: number;
  goal_alignment: number;
  cta_alignment: number;
  context_relevance: number;
  predicted_score: number;
  risk_level: string;
  suggestions: string[];
  historical_comparison: string;
  strongest_element: string;
  weakest_element: string;
  failure_reasons: string[];
  improved_hooks: string[];
  improved_ctas: string[];
  publish_recommendation: string;
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

const riskColors: Record<string, string> = {
  low: "text-green-600",
  medium: "text-yellow-600",
  high: "text-destructive",
};

const publishColors: Record<string, { bg: string; text: string; label: string }> = {
  publish: { bg: "bg-green-500/10", text: "text-green-600", label: "Ready to publish" },
  revise: { bg: "bg-yellow-500/10", text: "text-yellow-600", label: "Revise before publishing" },
  not_recommended: { bg: "bg-destructive/10", text: "text-destructive", label: "Not recommended" },
};

const DraftsPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scoringId, setScoringId] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({});
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  const fetchDrafts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("drafts")
      .select("*, ideas(idea_title, instruction)")
      .order("created_at", { ascending: false });
    if (!error && data) setDrafts(data as any);
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, [user]);

  const startEdit = (draft: Draft) => { setEditingId(draft.id); setEditContent(draft.custom_content || ""); };

  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("drafts").update({ custom_content: editContent }).eq("id", editingId);
    if (error) { toast.error("Failed to save"); } else { toast.success("Draft updated"); setEditingId(null); fetchDrafts(); }
  };

  const updateStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("drafts").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update status"); } else { setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, status } : d))); toast.success(`Marked as ${status}`); }
  };

  const scheduleDraft = async (id: string, date: Date) => {
    const { error } = await supabase.from("drafts").update({ scheduled_at: date.toISOString(), status: "scheduled" }).eq("id", id);
    if (error) { toast.error("Failed to schedule"); } else { toast.success(`Scheduled for ${format(date, "PPP")}`); setScheduleId(null); fetchDrafts(); }
  };

  const deleteDraft = async (id: string) => {
    const { error } = await supabase.from("drafts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); } else { toast.success("Draft deleted"); setDrafts(drafts.filter((d) => d.id !== id)); }
  };

  const copyDraft = (content: string | null) => { if (!content) return; navigator.clipboard.writeText(content); toast.success("Copied"); };

  const predictScore = async (draftId: string) => {
    setScoringId(draftId);
    try {
      const { data, error } = await supabase.functions.invoke("predict-score", { body: { draft_id: draftId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPredictions((prev) => ({ ...prev, [draftId]: data }));
      setExpandedPrediction(draftId);
      toast.success("Prediction complete!");
    } catch (err: any) {
      toast.error(err.message || "Prediction failed");
    } finally { setScoringId(null); }
  };

  const filtered = filter === "all" ? drafts : drafts.filter((d) => d.status === filter);

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Loading...</p></div>;

  return (
    <div className="content-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Drafts & Workflow</h1>
        <p className="mt-1 text-sm text-muted-foreground">{drafts.length} saved {drafts.length === 1 ? "draft" : "drafts"}</p>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {(["all", ...statusOptions] as const).map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize", filter === s ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {s}{s !== "all" && <span className="ml-1 text-muted-foreground">{drafts.filter((d) => d.status === s).length}</span>}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">{filter === "all" ? "No drafts saved yet." : `No ${filter} drafts.`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((draft) => {
            const prediction = predictions[draft.id];
            const isExpanded = expandedPrediction === draft.id;
            const pubRec = prediction ? publishColors[prediction.publish_recommendation] || publishColors.revise : null;

            return (
              <div key={draft.id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground truncate">{(draft.ideas as any)?.idea_title || (draft.ideas as any)?.instruction || "Untitled"}</p>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">{new Date(draft.created_at).toLocaleDateString()}</span>
                      <div className="flex gap-1">
                        {statusOptions.map((s) => (
                          <button key={s} onClick={() => updateStatus(draft.id, s)} className={cn("rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors", draft.status === s ? statusColors[s] : "bg-transparent text-muted-foreground hover:bg-secondary")}>{s}</button>
                        ))}
                      </div>
                      {draft.scheduled_at && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{format(new Date(draft.scheduled_at), "MMM d, yyyy")}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {(draft.status === "draft" || draft.status === "approved") && (
                      <button onClick={() => predictScore(draft.id)} disabled={scoringId === draft.id} title="Predict performance" className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                        {scoringId === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {draft.status === "draft" && <button onClick={() => updateStatus(draft.id, "approved")} title="Approve" className="rounded-md p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"><Check className="h-3.5 w-3.5" /></button>}
                    {draft.status === "approved" && <button onClick={() => updateStatus(draft.id, "draft")} title="Send back" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><XCircle className="h-3.5 w-3.5" /></button>}
                    {(draft.status === "approved" || draft.status === "draft") && (
                      <Popover open={scheduleId === draft.id} onOpenChange={(o) => setScheduleId(o ? draft.id : null)}>
                        <PopoverTrigger asChild><button className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" title="Schedule"><CalendarIcon className="h-3.5 w-3.5" /></button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={draft.scheduled_at ? new Date(draft.scheduled_at) : undefined} onSelect={(date) => date && scheduleDraft(draft.id, date)} disabled={(date) => date < new Date()} className="p-3 pointer-events-auto" /></PopoverContent>
                      </Popover>
                    )}
                    <button onClick={() => copyDraft(draft.custom_content)} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => deleteDraft(draft.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>

                {editingId === draft.id ? (
                  <div className="space-y-2">
                    <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={8} className="text-sm" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit}><Save className="mr-1.5 h-3.5 w-3.5" />Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1.5 h-3.5 w-3.5" />Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => startEdit(draft)} className="cursor-pointer">
                    <LinkedInPostPreview
                      type="text"
                      content={draft.custom_content || "No content"}
                    />
                  </div>
                )}

                {/* Prediction Score Card */}
                {prediction && (
                  <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
                    {/* Header: Score + Risk + Publish Recommendation */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-foreground">{prediction.predicted_score}</span>
                          <span className="text-xs text-muted-foreground">/100</span>
                        </div>
                        {(() => { const interp = getScoreInterpretation(prediction.predicted_score); return (
                          <span className={cn("text-xs font-medium", interp.color)}>{interp.label}</span>
                        ); })()}
                      </div>
                      {pubRec && (
                        <Badge variant="outline" className={cn("text-[10px]", pubRec.bg, pubRec.text)}>
                          {prediction.publish_recommendation === "publish" ? <ShieldCheck className="h-3 w-3 mr-1" /> : prediction.publish_recommendation === "not_recommended" ? <ShieldAlert className="h-3 w-3 mr-1" /> : null}
                          {pubRec.label}
                        </Badge>
                      )}
                    </div>

                    {/* 6 Scoring Dimensions */}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {[
                        { label: "Hook", value: prediction.hook_strength },
                        { label: "Persona", value: prediction.persona_relevance },
                        { label: "Clarity", value: prediction.clarity },
                        { label: "Goal", value: prediction.goal_alignment },
                        { label: "CTA", value: prediction.cta_alignment },
                        { label: "Context", value: prediction.context_relevance },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <p className={cn("text-sm font-semibold", value >= 70 ? "text-green-600" : value >= 40 ? "text-yellow-600" : "text-destructive")}>{value}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Strongest / Weakest */}
                    {(prediction.strongest_element || prediction.weakest_element) && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {prediction.strongest_element && (
                          <div className="rounded-md bg-green-500/5 border border-green-500/20 p-2">
                            <p className="text-[10px] font-medium text-green-600 flex items-center gap-1"><ArrowUp className="h-3 w-3" /> Strongest</p>
                            <p className="text-xs text-foreground mt-0.5">{prediction.strongest_element}</p>
                          </div>
                        )}
                        {prediction.weakest_element && (
                          <div className="rounded-md bg-destructive/5 border border-destructive/20 p-2">
                            <p className="text-[10px] font-medium text-destructive flex items-center gap-1"><ArrowDown className="h-3 w-3" /> Weakest</p>
                            <p className="text-xs text-foreground mt-0.5">{prediction.weakest_element}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expandable details */}
                    <button onClick={() => setExpandedPrediction(isExpanded ? null : draft.id)} className="text-[10px] text-primary hover:underline">
                      {isExpanded ? "Show less" : "Show detailed analysis"}
                    </button>

                    {isExpanded && (
                      <div className="space-y-3 pt-1">
                        {/* Failure Reasons */}
                        {prediction.failure_reasons && prediction.failure_reasons.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Why this may underperform</p>
                            {prediction.failure_reasons.map((r, i) => (
                              <p key={i} className="text-xs text-foreground flex items-start gap-1.5 pl-1"><span className="mt-1 h-1 w-1 rounded-full bg-destructive shrink-0" />{r}</p>
                            ))}
                          </div>
                        )}

                        {/* Improved Hooks */}
                        {prediction.improved_hooks && prediction.improved_hooks.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-primary flex items-center gap-1"><Zap className="h-3 w-3" /> Better hook options</p>
                            {prediction.improved_hooks.map((h, i) => (
                              <div key={i} className="flex items-start gap-1.5 pl-1">
                                <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                                <p className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(h); toast.success("Hook copied"); }}>{h}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Improved CTAs */}
                        {prediction.improved_ctas && prediction.improved_ctas.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-primary flex items-center gap-1"><Lightbulb className="h-3 w-3" /> Better CTA options</p>
                            {prediction.improved_ctas.map((c, i) => (
                              <div key={i} className="flex items-start gap-1.5 pl-1">
                                <span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />
                                <p className="text-xs text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => { navigator.clipboard.writeText(c); toast.success("CTA copied"); }}>{c}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Suggestions */}
                        {prediction.suggestions && prediction.suggestions.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium text-foreground flex items-center gap-1"><Lightbulb className="h-3 w-3 text-primary" /> Quick fixes</p>
                            {prediction.suggestions.map((s, i) => (
                              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 pl-1"><span className="mt-1 h-1 w-1 rounded-full bg-primary shrink-0" />{s}</p>
                            ))}
                          </div>
                        )}

                        {prediction.historical_comparison && (
                          <p className="text-xs text-muted-foreground italic">{prediction.historical_comparison}</p>
                        )}
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

export default DraftsPage;
