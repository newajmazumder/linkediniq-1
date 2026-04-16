import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Users, TrendingUp, TrendingDown, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type Persona = {
  id: string;
  name: string;
  industry: string | null;
  business_size: string | null;
  geography: string | null;
  language_style: string | null;
  awareness_level: string | null;
  pain_points: string[];
  goals: string[];
  objections: string[];
  buying_triggers: string | null;
  content_preference: string | null;
};

type PersonaIntelligence = {
  bestPatterns: { dimension: string; value: string; engagement: number; confidence: string }[];
  worstPatterns: { dimension: string; value: string; engagement: number; confidence: string }[];
};

const emptyPersona = {
  name: "", industry: "", business_size: "SME", geography: "", language_style: "english",
  awareness_level: "unaware", pain_points: [] as string[], goals: [] as string[],
  objections: [] as string[], buying_triggers: "", content_preference: "educational",
};

const awarenessLevels = ["unaware", "problem-aware", "solution-aware", "product-aware"];
const businessSizes = ["SME", "mid", "enterprise"];
const languageStyles = ["formal", "casual", "banglish", "english"];
const contentPrefs = ["storytelling", "educational", "direct value", "bold opinion"];

const confidenceColors: Record<string, string> = {
  high: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  low: "bg-muted text-muted-foreground border-border",
};

const AudiencePage = () => {
  const { user } = useAuth();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyPersona);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [listInputs, setListInputs] = useState({ pain: "", goal: "", objection: "" });
  const [personaIntelligence, setPersonaIntelligence] = useState<Record<string, PersonaIntelligence>>({});

  useEffect(() => { if (user) { fetchPersonas(); fetchIntelligence(); } }, [user]);

  const fetchPersonas = async () => {
    const { data } = await supabase.from("audience_personas").select("*").order("created_at", { ascending: false });
    setPersonas((data || []).map((d: any) => ({
      ...d,
      pain_points: Array.isArray(d.pain_points) ? d.pain_points : [],
      goals: Array.isArray(d.goals) ? d.goals : [],
      objections: Array.isArray(d.objections) ? d.objections : [],
    })));
    setLoading(false);
  };

  const fetchIntelligence = async () => {
    if (!user) return;
    // Fetch content_tags with performance data to build persona intelligence
    const { data: tags } = await supabase
      .from("content_tags")
      .select("persona_id, hook_type, tone, post_style, cta_type, content_intent")
      .eq("user_id", user.id)
      .not("persona_id", "is", null);

    const { data: patterns } = await supabase
      .from("content_patterns")
      .select("dimension, dimension_value, avg_engagement_rate, sample_count, confidence_level")
      .eq("user_id", user.id);

    if (!patterns || patterns.length === 0) return;

    // For each persona, find tags associated with it, then look up pattern performance
    const personaIds = [...new Set((tags || []).map((t: any) => t.persona_id))];
    const intel: Record<string, PersonaIntelligence> = {};

    for (const pid of personaIds) {
      const personaTags = (tags || []).filter((t: any) => t.persona_id === pid);
      // Find which hook_types, tones, styles this persona uses
      const usedDims: Record<string, Set<string>> = { hook_type: new Set(), tone: new Set(), post_style: new Set(), cta_type: new Set() };
      for (const t of personaTags) {
        if (t.hook_type) usedDims.hook_type.add(t.hook_type);
        if (t.tone) usedDims.tone.add(t.tone);
        if (t.post_style) usedDims.post_style.add(t.post_style);
        if (t.cta_type) usedDims.cta_type.add(t.cta_type);
      }

      // Match against patterns
      const matched: { dimension: string; value: string; engagement: number; confidence: string }[] = [];
      for (const p of patterns) {
        const dimValues = usedDims[p.dimension];
        if (dimValues && dimValues.has(p.dimension_value)) {
          matched.push({ dimension: p.dimension, value: p.dimension_value, engagement: p.avg_engagement_rate || 0, confidence: (p as any).confidence_level || "low" });
        }
      }

      const sorted = matched.sort((a, b) => b.engagement - a.engagement);
      intel[pid] = {
        bestPatterns: sorted.slice(0, 3),
        worstPatterns: sorted.length > 1 ? sorted.slice(-2) : [],
      };
    }
    setPersonaIntelligence(intel);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id, name: form.name.trim(), industry: form.industry || null,
        business_size: form.business_size, geography: form.geography || null,
        language_style: form.language_style, awareness_level: form.awareness_level,
        pain_points: form.pain_points, goals: form.goals, objections: form.objections,
        buying_triggers: form.buying_triggers || null, content_preference: form.content_preference,
      };
      if (editingId) {
        const { error } = await supabase.from("audience_personas").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Persona updated");
      } else {
        const { error } = await supabase.from("audience_personas").insert(payload);
        if (error) throw error;
        toast.success("Persona created");
      }
      setForm(emptyPersona); setEditingId(null); setShowForm(false); fetchPersonas();
    } catch (err: any) { toast.error(err.message || "Failed to save"); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("audience_personas").delete().eq("id", id);
    setPersonas((p) => p.filter((x) => x.id !== id));
    toast.success("Persona deleted");
  };

  const startEdit = (p: Persona) => {
    setForm({
      name: p.name, industry: p.industry || "", business_size: p.business_size || "SME",
      geography: p.geography || "", language_style: p.language_style || "english",
      awareness_level: p.awareness_level || "unaware", pain_points: p.pain_points,
      goals: p.goals, objections: p.objections, buying_triggers: p.buying_triggers || "",
      content_preference: p.content_preference || "educational",
    });
    setEditingId(p.id); setShowForm(true);
  };

  const addToList = (field: "pain_points" | "goals" | "objections", inputKey: "pain" | "goal" | "objection") => {
    const val = listInputs[inputKey].trim();
    if (!val) return;
    setForm((f) => ({ ...f, [field]: [...f[field], val] }));
    setListInputs((l) => ({ ...l, [inputKey]: "" }));
  };

  const removeFromList = (field: "pain_points" | "goals" | "objections", idx: number) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="content-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audience Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define target personas for strategy-aware content.</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyPersona); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />New Persona
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">{editingId ? "Edit" : "Create"} Persona</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Persona Name *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Ecommerce Founder – BD"' className="text-sm" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Industry</label><Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Ecommerce, SaaS" className="text-sm" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Business Size</label><Select value={form.business_size} onValueChange={(v) => setForm({ ...form, business_size: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{businessSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Geography</label><Input value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} placeholder="e.g. Bangladesh, South Asia" className="text-sm" /></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Language Style</label><Select value={form.language_style} onValueChange={(v) => setForm({ ...form, language_style: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{languageStyles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Awareness Level</label><Select value={form.awareness_level} onValueChange={(v) => setForm({ ...form, awareness_level: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{awarenessLevels.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Content Preference</label><Select value={form.content_preference} onValueChange={(v) => setForm({ ...form, content_preference: v })}><SelectTrigger className="text-sm"><SelectValue /></SelectTrigger><SelectContent>{contentPrefs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1"><label className="text-xs font-medium text-foreground">Buying Triggers</label><Input value={form.buying_triggers} onChange={(e) => setForm({ ...form, buying_triggers: e.target.value })} placeholder="e.g. Black Friday" className="text-sm" /></div>
          </div>
          {([
            { label: "Pain Points", field: "pain_points" as const, key: "pain" as const },
            { label: "Goals", field: "goals" as const, key: "goal" as const },
            { label: "Objections", field: "objections" as const, key: "objection" as const },
          ]).map(({ label, field, key }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{label}</label>
              <div className="flex gap-2">
                <Input value={listInputs[key]} onChange={(e) => setListInputs({ ...listInputs, [key]: e.target.value })} placeholder={`Add ${label.toLowerCase()}...`} className="text-sm" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(field, key))} />
                <Button size="sm" variant="outline" onClick={() => addToList(field, key)}>Add</Button>
              </div>
              {form[field].length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form[field].map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      {item}<button onClick={() => removeFromList(field, idx)} className="text-muted-foreground hover:text-foreground">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {editingId ? "Update" : "Create"} Persona
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </div>
      )}

      {personas.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No personas yet. Create one to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((p) => {
            const intel = personaIntelligence[p.id];
            return (
              <div key={p.id} className="rounded-lg border border-border bg-card">
                <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="flex w-full items-center justify-between p-4 text-left">
                  <div>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.industry && <span className="text-xs text-muted-foreground">{p.industry}</span>}
                      {p.awareness_level && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{p.awareness_level}</span>}
                      {p.business_size && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{p.business_size}</span>}
                      {intel && intel.bestPatterns.length > 0 && (
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                          <Brain className="h-3 w-3 mr-1" />Intel available
                        </Badge>
                      )}
                    </div>
                  </div>
                  {expandedId === p.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {expandedId === p.id && (
                  <div className="border-t border-border px-4 py-3 space-y-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="font-medium text-foreground">Geography:</span> {p.geography || "—"}</div>
                      <div><span className="font-medium text-foreground">Language:</span> {p.language_style || "—"}</div>
                      <div><span className="font-medium text-foreground">Content Pref:</span> {p.content_preference || "—"}</div>
                      <div><span className="font-medium text-foreground">Buying Triggers:</span> {p.buying_triggers || "—"}</div>
                    </div>
                    {p.pain_points.length > 0 && <div><span className="font-medium text-foreground">Pain Points:</span> {p.pain_points.join(", ")}</div>}
                    {p.goals.length > 0 && <div><span className="font-medium text-foreground">Goals:</span> {p.goals.join(", ")}</div>}
                    {p.objections.length > 0 && <div><span className="font-medium text-foreground">Objections:</span> {p.objections.join(", ")}</div>}

                    {/* Persona Intelligence Profile */}
                    {intel && intel.bestPatterns.length > 0 && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs font-medium text-primary flex items-center gap-1"><Brain className="h-3.5 w-3.5" /> Intelligence Profile</p>
                        {intel.bestPatterns.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-green-600 flex items-center gap-1 mb-1"><TrendingUp className="h-3 w-3" /> What works</p>
                            <div className="flex flex-wrap gap-1">
                              {intel.bestPatterns.map((bp, i) => (
                                <Badge key={i} variant="outline" className={cn("text-[10px]", confidenceColors[bp.confidence] || confidenceColors.low)}>
                                  {bp.dimension.replace("_", " ")}: {bp.value} ({bp.engagement}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {intel.worstPatterns.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-destructive flex items-center gap-1 mb-1"><TrendingDown className="h-3 w-3" /> Underperforming</p>
                            <div className="flex flex-wrap gap-1">
                              {intel.worstPatterns.map((wp, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-destructive/5 text-destructive border-destructive/20">
                                  {wp.dimension.replace("_", " ")}: {wp.value} ({wp.engagement}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Delete
                      </Button>
                    </div>
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

export default AudiencePage;
