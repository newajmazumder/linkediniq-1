import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, ChevronDown, ChevronUp, Users } from "lucide-react";

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

const emptyPersona = {
  name: "",
  industry: "",
  business_size: "SME",
  geography: "",
  language_style: "english",
  awareness_level: "unaware",
  pain_points: [] as string[],
  goals: [] as string[],
  objections: [] as string[],
  buying_triggers: "",
  content_preference: "educational",
};

const awarenessLevels = ["unaware", "problem-aware", "solution-aware", "product-aware"];
const businessSizes = ["SME", "mid", "enterprise"];
const languageStyles = ["formal", "casual", "banglish", "english"];
const contentPrefs = ["storytelling", "educational", "direct value", "bold opinion"];

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

  useEffect(() => {
    if (user) fetchPersonas();
  }, [user]);

  const fetchPersonas = async () => {
    const { data } = await supabase
      .from("audience_personas")
      .select("*")
      .order("created_at", { ascending: false });
    setPersonas(
      (data || []).map((d: any) => ({
        ...d,
        pain_points: Array.isArray(d.pain_points) ? d.pain_points : [],
        goals: Array.isArray(d.goals) ? d.goals : [],
        objections: Array.isArray(d.objections) ? d.objections : [],
      }))
    );
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        industry: form.industry || null,
        business_size: form.business_size,
        geography: form.geography || null,
        language_style: form.language_style,
        awareness_level: form.awareness_level,
        pain_points: form.pain_points,
        goals: form.goals,
        objections: form.objections,
        buying_triggers: form.buying_triggers || null,
        content_preference: form.content_preference,
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
      setForm(emptyPersona);
      setEditingId(null);
      setShowForm(false);
      fetchPersonas();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("audience_personas").delete().eq("id", id);
    setPersonas((p) => p.filter((x) => x.id !== id));
    toast.success("Persona deleted");
  };

  const startEdit = (p: Persona) => {
    setForm({
      name: p.name,
      industry: p.industry || "",
      business_size: p.business_size || "SME",
      geography: p.geography || "",
      language_style: p.language_style || "english",
      awareness_level: p.awareness_level || "unaware",
      pain_points: p.pain_points,
      goals: p.goals,
      objections: p.objections,
      buying_triggers: p.buying_triggers || "",
      content_preference: p.content_preference || "educational",
    });
    setEditingId(p.id);
    setShowForm(true);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="content-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audience Profiles</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define target personas for strategy-aware content.</p>
        </div>
        <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyPersona); }}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Persona
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-medium text-foreground">{editingId ? "Edit" : "Create"} Persona</h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Persona Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder='e.g. "Ecommerce Founder – BD"' className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Industry</label>
              <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} placeholder="e.g. Ecommerce, SaaS" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Business Size</label>
              <Select value={form.business_size} onValueChange={(v) => setForm({ ...form, business_size: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{businessSizes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Geography</label>
              <Input value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} placeholder="e.g. Bangladesh, South Asia" className="text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Language Style</label>
              <Select value={form.language_style} onValueChange={(v) => setForm({ ...form, language_style: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{languageStyles.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Awareness Level</label>
              <Select value={form.awareness_level} onValueChange={(v) => setForm({ ...form, awareness_level: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{awarenessLevels.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Content Preference</label>
              <Select value={form.content_preference} onValueChange={(v) => setForm({ ...form, content_preference: v })}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{contentPrefs.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">Buying Triggers</label>
              <Input value={form.buying_triggers} onChange={(e) => setForm({ ...form, buying_triggers: e.target.value })} placeholder="e.g. Black Friday, funding round" className="text-sm" />
            </div>
          </div>

          {/* List fields */}
          {([
            { label: "Pain Points", field: "pain_points" as const, key: "pain" as const },
            { label: "Goals", field: "goals" as const, key: "goal" as const },
            { label: "Objections", field: "objections" as const, key: "objection" as const },
          ]).map(({ label, field, key }) => (
            <div key={field} className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">{label}</label>
              <div className="flex gap-2">
                <Input
                  value={listInputs[key]}
                  onChange={(e) => setListInputs({ ...listInputs, [key]: e.target.value })}
                  placeholder={`Add ${label.toLowerCase()}...`}
                  className="text-sm"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addToList(field, key))}
                />
                <Button size="sm" variant="outline" onClick={() => addToList(field, key)}>Add</Button>
              </div>
              {form[field].length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {form[field].map((item, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
                      {item}
                      <button onClick={() => removeFromList(field, idx)} className="text-muted-foreground hover:text-foreground">×</button>
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

      {/* Persona Cards */}
      {personas.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No personas yet. Create one to start.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card">
              <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="flex w-full items-center justify-between p-4 text-left">
                <div>
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.industry && <span className="text-xs text-muted-foreground">{p.industry}</span>}
                    {p.awareness_level && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{p.awareness_level}</span>}
                    {p.business_size && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{p.business_size}</span>}
                  </div>
                </div>
                {expandedId === p.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedId === p.id && (
                <div className="border-t border-border px-4 py-3 space-y-2 text-xs text-muted-foreground">
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="font-medium text-foreground">Geography:</span> {p.geography || "—"}</div>
                    <div><span className="font-medium text-foreground">Language:</span> {p.language_style || "—"}</div>
                    <div><span className="font-medium text-foreground">Content Pref:</span> {p.content_preference || "—"}</div>
                    <div><span className="font-medium text-foreground">Buying Triggers:</span> {p.buying_triggers || "—"}</div>
                  </div>
                  {p.pain_points.length > 0 && <div><span className="font-medium text-foreground">Pain Points:</span> {p.pain_points.join(", ")}</div>}
                  {p.goals.length > 0 && <div><span className="font-medium text-foreground">Goals:</span> {p.goals.join(", ")}</div>}
                  {p.objections.length > 0 && <div><span className="font-medium text-foreground">Objections:</span> {p.objections.join(", ")}</div>}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(p)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="mr-1 h-3 w-3" /> Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AudiencePage;
