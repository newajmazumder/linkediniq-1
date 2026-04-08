import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Target, ChevronDown, ChevronUp, Sparkles, ArrowRight, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

type Persona = { id: string; name: string };
type Campaign = {
  id: string;
  name: string;
  goal: string | null;
  primary_persona_id: string | null;
  secondary_persona_id: string | null;
  core_message: string | null;
  offer: string | null;
  cta_type: string | null;
  style_storytelling: number;
  style_educational: number;
  style_product_led: number;
  style_authority: number;
  tone: string | null;
  is_active: boolean;
};

const goals = ["awareness", "engagement", "lead generation", "promotion"];
const ctaTypes = ["soft", "medium", "hard"];
const tones = ["calm", "bold", "authoritative", "friendly"];

const emptyForm = {
  name: "",
  goal: "awareness",
  primary_persona_id: "",
  secondary_persona_id: "",
  core_message: "",
  offer: "",
  cta_type: "soft",
  style_storytelling: 25,
  style_educational: 25,
  style_product_led: 25,
  style_authority: 25,
  tone: "friendly",
};

type Recommendation = {
  topic: string;
  hook_type: string;
  tone: string;
  persona_name: string;
  content_type: string;
  cta_type: string;
  reason: string;
};

type GapAnalysis = {
  underused_hooks?: string[];
  underused_personas?: string[];
  missing_topics?: string[];
  overused?: string[];
};

const StrategyPage = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"campaigns" | "recommendations">("campaigns");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    if (user) {
      Promise.all([fetchCampaigns(), fetchPersonas(), fetchRecommendations()]).then(() => setLoading(false));
    }
  }, [user]);

  const fetchRecommendations = async () => {
    const { data } = await supabase
      .from("strategy_recommendations")
      .select("recommendation, gap_analysis")
      .eq("user_id", user!.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);
    if (data && data.length > 0) {
      setRecommendations(data.map((r: any) => r.recommendation as Recommendation));
      setGapAnalysis(data[0]?.gap_analysis as GapAnalysis || null);
    }
  };

  const generateRecommendations = async () => {
    setLoadingRecs(true);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-next");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRecommendations(data.recommendations || []);
      setGapAnalysis(data.gap_analysis || null);
      toast.success("Recommendations generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate");
    } finally {
      setLoadingRecs(false);
    }
  };

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
    setCampaigns((data || []) as Campaign[]);
  };

  const fetchPersonas = async () => {
    const { data } = await supabase.from("audience_personas").select("id, name").order("name");
    setPersonas((data || []) as Persona[]);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: form.name.trim(),
        goal: form.goal,
        primary_persona_id: form.primary_persona_id || null,
        secondary_persona_id: form.secondary_persona_id || null,
        core_message: form.core_message || null,
        offer: form.offer || null,
        cta_type: form.cta_type,
        style_storytelling: form.style_storytelling,
        style_educational: form.style_educational,
        style_product_led: form.style_product_led,
        style_authority: form.style_authority,
        tone: form.tone,
      };

      if (editingId) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Campaign updated");
      } else {
        const { error } = await supabase.from("campaigns").insert(payload);
        if (error) throw error;
        toast.success("Campaign created");
      }
      setForm(emptyForm);
      setEditingId(null);
      setShowForm(false);
      fetchCampaigns();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("campaigns").delete().eq("id", id);
    setCampaigns((c) => c.filter((x) => x.id !== id));
    toast.success("Campaign deleted");
  };

  const startEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      goal: c.goal || "awareness",
      primary_persona_id: c.primary_persona_id || "",
      secondary_persona_id: c.secondary_persona_id || "",
      core_message: c.core_message || "",
      offer: c.offer || "",
      cta_type: c.cta_type || "soft",
      style_storytelling: c.style_storytelling,
      style_educational: c.style_educational,
      style_product_led: c.style_product_led,
      style_authority: c.style_authority,
      tone: c.tone || "friendly",
    });
    setEditingId(c.id);
    setShowForm(true);
  };

  const updateStyleMix = (key: string, value: number) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const personaName = (id: string | null) => personas.find((p) => p.id === id)?.name || "—";

  const ctaLabel: Record<string, string> = {
    soft: "Soft (follow, comment)",
    medium: "Medium (DM, engage)",
    hard: "Hard (book demo, signup)",
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
          <h1 className="text-2xl font-semibold text-foreground">Strategy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define campaigns and get AI recommendations.</p>
        </div>
        {tab === "campaigns" && (
          <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Campaign
          </Button>
        )}
        {tab === "recommendations" && (
          <Button size="sm" onClick={generateRecommendations} disabled={loadingRecs}>
            {loadingRecs ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1 h-3.5 w-3.5" />}
            {recommendations.length > 0 ? "Refresh" : "Generate"}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["campaigns", "recommendations"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
              tab === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Campaigns tab */}
      {tab === "campaigns" && (
        <>
          {showForm && (
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <h3 className="text-sm font-medium text-foreground">{editingId ? "Edit" : "Create"} Campaign</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Campaign Name *</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q2 Lead Gen" className="text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Goal</label>
                  <Select value={form.goal} onValueChange={(v) => setForm({ ...form, goal: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{goals.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Primary Persona</label>
                  <Select value={form.primary_persona_id} onValueChange={(v) => setForm({ ...form, primary_persona_id: v })}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select persona" /></SelectTrigger>
                    <SelectContent>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Secondary Persona</label>
                  <Select value={form.secondary_persona_id} onValueChange={(v) => setForm({ ...form, secondary_persona_id: v })}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select persona" /></SelectTrigger>
                    <SelectContent>{personas.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">CTA Type</label>
                  <Select value={form.cta_type} onValueChange={(v) => setForm({ ...form, cta_type: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{ctaTypes.map((t) => <SelectItem key={t} value={t}>{ctaLabel[t]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Tone</label>
                  <Select value={form.tone} onValueChange={(v) => setForm({ ...form, tone: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{tones.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Core Message</label>
                <Textarea value={form.core_message} onChange={(e) => setForm({ ...form, core_message: e.target.value })} rows={2} placeholder="The main message this campaign delivers" className="resize-none text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-foreground">Offer (if any)</label>
                <Input value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="e.g. Free trial, 20% off" className="text-sm" />
              </div>
              <div className="space-y-3">
                <label className="text-xs font-medium text-foreground">Content Style Mix</label>
                {([
                  { key: "style_storytelling", label: "Storytelling" },
                  { key: "style_educational", label: "Educational" },
                  { key: "style_product_led", label: "Product-Led" },
                  { key: "style_authority", label: "Authority/Opinion" },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-28 text-xs text-muted-foreground">{label}</span>
                    <Slider value={[form[key]]} onValueChange={([v]) => updateStyleMix(key, v)} min={0} max={100} step={5} className="flex-1" />
                    <span className="w-10 text-right text-xs text-foreground">{form[key]}%</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  {editingId ? "Update" : "Create"} Campaign
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
              </div>
            </div>
          )}

          {campaigns.length === 0 && !showForm ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No campaigns yet. Create one to guide your content.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <div key={c.id} className="rounded-lg border border-border bg-card">
                  <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)} className="flex w-full items-center justify-between p-4 text-left">
                    <div>
                      <span className="text-sm font-medium text-foreground">{c.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{c.goal}</span>
                        <span className="text-xs text-muted-foreground">{c.tone} · {c.cta_type} CTA</span>
                      </div>
                    </div>
                    {expandedId === c.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </button>
                  {expandedId === c.id && (
                    <div className="border-t border-border px-4 py-3 space-y-2 text-xs text-muted-foreground">
                      <div className="grid grid-cols-2 gap-2">
                        <div><span className="font-medium text-foreground">Primary Persona:</span> {personaName(c.primary_persona_id)}</div>
                        <div><span className="font-medium text-foreground">Secondary Persona:</span> {personaName(c.secondary_persona_id)}</div>
                        <div className="col-span-2"><span className="font-medium text-foreground">Core Message:</span> {c.core_message || "—"}</div>
                        {c.offer && <div className="col-span-2"><span className="font-medium text-foreground">Offer:</span> {c.offer}</div>}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Style Mix:</span> Storytelling {c.style_storytelling}% · Educational {c.style_educational}% · Product {c.style_product_led}% · Authority {c.style_authority}%
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)}>Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="mr-1 h-3 w-3" /> Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Recommendations tab */}
      {tab === "recommendations" && (
        <div className="space-y-4">
          {recommendations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">Click "Generate" to get AI-powered content recommendations.</p>
              <p className="mt-1 text-xs text-muted-foreground">Based on your performance data, personas, and business context.</p>
            </div>
          ) : (
            <>
              {/* Gap Analysis */}
              {gapAnalysis && (
                <div className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <h3 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                    Content Gap Analysis
                  </h3>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {gapAnalysis.underused_hooks && gapAnalysis.underused_hooks.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Underused hooks</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {gapAnalysis.underused_hooks.map((h) => (
                            <span key={h} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">{h}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {gapAnalysis.underused_personas && gapAnalysis.underused_personas.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Underused personas</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {gapAnalysis.underused_personas.map((p) => (
                            <span key={p} className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-accent-foreground">{p}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {gapAnalysis.missing_topics && gapAnalysis.missing_topics.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Missing topics</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {gapAnalysis.missing_topics.map((t) => (
                            <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {gapAnalysis.overused && gapAnalysis.overused.length > 0 && (
                      <div>
                        <span className="text-[10px] text-muted-foreground">Overused</span>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {gapAnalysis.overused.map((o) => (
                            <span key={o} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive">{o}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              <div className="space-y-3">
                {recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">{rec.topic}</p>
                      <Link
                        to="/create"
                        className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        title="Create this post"
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{rec.hook_type}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{rec.tone}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{rec.content_type}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{rec.cta_type} CTA</span>
                      {rec.persona_name && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">{rec.persona_name}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{rec.reason}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StrategyPage;
