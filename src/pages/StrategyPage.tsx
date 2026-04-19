import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, Plus, Trash2, Target, Sparkles, ArrowRight,
  AlertTriangle, ChevronRight, Zap, Flame, Edit2, AlertCircle, Wrench,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  computeCampaignState, STATE_META, computeStrategyScore, scoreColor,
  diagnoseScore, primaryAction as buildPrimaryAction, buildNarrativeSummary,
  scoreInterpretation, scoreSeverity, computeVelocity,
} from "@/lib/strategy";
import CampaignGoalProgressBar from "@/components/campaign/CampaignGoalProgressBar";
import { goalUpdatedEvent } from "@/lib/goal-metrics";

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
  primary_objective: string | null;
  target_metric: string | null;
  target_quantity: number | null;
  target_timeframe: string | null;
  target_priority: string | null;
};

type CampaignProgress = {
  campaign_id: string;
  current_value: number;
  target_value: number;
  metric_name: string;
  gap_analysis: string | null;
};

type PostingStat = { campaign_id: string; total: number; drafted: number; week1Remaining: number; weeks: number };

const objectives = [
  "awareness", "engagement", "followers", "profile_visits",
  "dms", "leads", "demo_bookings", "signups", "education",
];

const targetMetrics: Record<string, string[]> = {
  awareness: ["impressions", "engagement_rate"],
  engagement: ["engagement_rate", "impressions"],
  followers: ["follower_count", "profile_visits"],
  profile_visits: ["profile_visits", "impressions"],
  dms: ["dm_count", "engagement_rate"],
  leads: ["lead_count", "dm_count"],
  demo_bookings: ["demo_booking_count", "lead_count"],
  signups: ["signup_count", "lead_count"],
  education: ["impressions", "engagement_rate"],
};

const metricLabels: Record<string, string> = {
  follower_count: "Followers",
  dm_count: "DMs",
  lead_count: "Leads",
  demo_booking_count: "Demo Bookings",
  signup_count: "Signups",
  profile_visits: "Profile Visits",
  impressions: "Impressions",
  engagement_rate: "Engagement Rate (%)",
};

const timeframes = ["weekly", "monthly", "campaign_duration"];
const priorities = ["high", "medium", "low"];
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
  primary_objective: "awareness",
  target_metric: "",
  target_quantity: "",
  target_timeframe: "monthly",
  target_priority: "medium",
  language: "english",
  market_context_id: "",
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

type MarketContextOption = { id: string; region_code: string; region_name: string; audience_type: string };

const StrategyPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [marketContexts, setMarketContexts] = useState<MarketContextOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"campaigns" | "recommendations">("campaigns");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysis | null>(null);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [progress, setProgress] = useState<Record<string, CampaignProgress>>({});
  const [postingStats, setPostingStats] = useState<Record<string, PostingStat>>({});

  useEffect(() => {
    if (user) {
      Promise.all([
        fetchCampaigns(),
        fetchPersonas(),
        fetchRecommendations(),
        fetchProgress(),
        fetchPostingStats(),
      ]).then(() => setLoading(false));
      supabase.from("market_contexts").select("id, region_code, region_name, audience_type").eq("is_preset", true).then(({ data }) => setMarketContexts((data || []) as MarketContextOption[]));
    }
  }, [user]);

  const fetchProgress = async () => {
    const { data } = await supabase
      .from("campaign_progress")
      .select("campaign_id, current_value, target_value, metric_name, gap_analysis")
      .eq("user_id", user!.id);
    if (data) {
      const map: Record<string, CampaignProgress> = {};
      for (const p of data) map[p.campaign_id] = p as CampaignProgress;
      setProgress(map);
    }
  };

  const fetchPostingStats = async () => {
    const { data } = await supabase
      .from("campaign_post_plans")
      .select("campaign_id, status, week_number")
      .eq("user_id", user!.id);
    if (data) {
      const map: Record<string, PostingStat> = {};
      for (const row of data as any[]) {
        if (!map[row.campaign_id]) map[row.campaign_id] = { campaign_id: row.campaign_id, total: 0, drafted: 0, week1Remaining: 0, weeks: 0 };
        const stat = map[row.campaign_id];
        stat.total += 1;
        if (row.week_number > stat.weeks) stat.weeks = row.week_number;
        const isDrafted = row.status && row.status !== "planned";
        if (isDrafted) stat.drafted += 1;
        if (row.week_number === 1 && !isDrafted) stat.week1Remaining += 1;
      }
      setPostingStats(map);
    }
  };

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
        primary_objective: form.primary_objective,
        target_metric: form.target_metric || null,
        target_quantity: form.target_quantity ? parseInt(form.target_quantity) : null,
        target_timeframe: form.target_timeframe,
        target_priority: form.target_priority,
        language: form.language,
        market_context_id: form.market_context_id || null,
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
      primary_objective: c.primary_objective || "awareness",
      target_metric: c.target_metric || "",
      target_quantity: c.target_quantity?.toString() || "",
      target_timeframe: c.target_timeframe || "monthly",
      target_priority: c.target_priority || "medium",
      language: (c as any).language || "english",
      market_context_id: (c as any).market_context_id || "",
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

  const availableMetrics = targetMetrics[form.primary_objective] || ["impressions"];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="content-fade-in space-y-6 px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Strategy Control Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">Run every campaign as a measurable bet — not a content calendar.</p>
        </div>
        {tab === "campaigns" && (
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => navigate("/campaign/new")}>
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              AI Strategist
            </Button>
            <Button size="sm" onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); }}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New Campaign
            </Button>
          </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
                  <label className="text-xs font-medium text-foreground">Target Market</label>
                  <Select value={form.market_context_id} onValueChange={(v) => setForm({ ...form, market_context_id: v })}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Select market" /></SelectTrigger>
                    <SelectContent>
                      {marketContexts.map((mc) => (
                        <SelectItem key={mc.id} value={mc.id}>
                          {mc.region_code === "BD" ? "🇧🇩" : mc.region_code === "US" ? "🇺🇸" : "🌍"} {mc.region_name} — {mc.audience_type.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Content Language</label>
                  <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="bangla">বাংলা (Bangla)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Measurable Target Section */}
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-3">
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Measurable Target
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Primary Objective</label>
                    <Select value={form.primary_objective} onValueChange={(v) => setForm({ ...form, primary_objective: v, target_metric: "" })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{objectives.map((o) => <SelectItem key={o} value={o} className="capitalize">{o.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Target Metric</label>
                    <Select value={form.target_metric} onValueChange={(v) => setForm({ ...form, target_metric: v })}>
                      <SelectTrigger className="text-sm"><SelectValue placeholder="Select metric" /></SelectTrigger>
                      <SelectContent>{availableMetrics.map((m) => <SelectItem key={m} value={m}>{metricLabels[m] || m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Target Quantity</label>
                    <Input type="number" value={form.target_quantity} onChange={(e) => setForm({ ...form, target_quantity: e.target.value })} placeholder="e.g. 100" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Timeframe</label>
                    <Select value={form.target_timeframe} onValueChange={(v) => setForm({ ...form, target_timeframe: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{timeframes.map((t) => <SelectItem key={t} value={t} className="capitalize">{t.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Priority</label>
                    <Select value={form.target_priority} onValueChange={(v) => setForm({ ...form, target_priority: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{priorities.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              {campaigns.map((c) => {
                const prog = progress[c.id];
                const posting = postingStats[c.id];
                const outcomePct = prog && prog.target_value > 0
                  ? Math.min(100, Math.round((prog.current_value / prog.target_value) * 100))
                  : null;
                const postingPct = posting && posting.total > 0
                  ? Math.round((posting.drafted / posting.total) * 100)
                  : null;

                const state = computeCampaignState({
                  outcomePct,
                  postingPct,
                  totalPlanned: posting?.total,
                  hasPlan: !!posting,
                });
                const meta = STATE_META[state];

                const score = computeStrategyScore({
                  hasCoreMessage: !!c.core_message,
                  hasPersona: !!c.primary_persona_id,
                  hasOffer: !!c.offer,
                  hasMeasurableTarget: !!(c.target_metric && c.target_quantity),
                  postingPct,
                  outcomePct,
                });

                // Diagnostic verdict for Strategy Score
                const diag = diagnoseScore(score, {
                  hasCoreMessage: !!c.core_message,
                  hasPersona: !!c.primary_persona_id,
                  hasOffer: !!c.offer,
                  hasMeasurableTarget: !!(c.target_metric && c.target_quantity),
                  postingPct,
                  outcomePct,
                });

                // Primary action — the single "do this now"
                const action = buildPrimaryAction(c.id, state, {
                  totalPlanned: posting?.total,
                  postingPct,
                  firstWeekPostsRemaining: posting?.week1Remaining,
                });

                // Narrative summary
                const summary = buildNarrativeSummary(c, posting?.weeks ?? 0);

                // Velocity — psychological pressure (actual vs required)
                const velocity = posting && posting.weeks > 0
                  ? computeVelocity(posting.drafted, posting.total, posting.weeks)
                  : null;

                const interp = scoreInterpretation(diag.severity);
                const isUrgent = diag.severity === "critical" || diag.severity === "warning";

                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-xl border border-border bg-card border-l-[3px] overflow-hidden transition-shadow hover:shadow-sm",
                      meta.borderClass,
                    )}
                  >
                    <div className="p-5 sm:p-6 space-y-5">
                      {/* LEVEL 1 — Title + status whisper + DOMINANT score */}
                      <div className="flex items-start justify-between gap-6">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
                            <span className={cn("font-medium", meta.textClass)}>{meta.label}</span>
                            <span className="text-border">·</span>
                            <span className="capitalize">
                              {(c.primary_objective || c.goal || "").replace(/_/g, " ")}
                              {c.target_timeframe && ` · ${c.target_timeframe.replace(/_/g, " ")}`}
                            </span>
                            {c.target_priority === "high" && (
                              <>
                                <span className="text-border">·</span>
                                <span className="text-foreground font-medium">High priority</span>
                              </>
                            )}
                          </div>
                          <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight leading-tight">
                            {c.name}
                          </h2>
                        </div>

                        {/* DOMINANT Strategy Score — single calm accent */}
                        <div className="shrink-0 text-right">
                          <div className={cn("text-4xl sm:text-5xl font-semibold leading-none tabular-nums", scoreColor(score.total))}>
                            {score.total.toFixed(1)}
                            <span className="text-base text-muted-foreground font-normal">/10</span>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Strategy · <span className="text-foreground">{interp}</span>
                          </p>
                        </div>
                      </div>

                      {/* LEVEL 2 — Strategy Hook (editorial typography, no tint) */}
                      <div className="border-l-2 border-border pl-4">
                        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-medium">
                          Strategy
                        </p>
                        <p className="mt-1 text-base sm:text-[17px] font-medium text-foreground leading-snug">
                          {c.core_message || summary}
                        </p>
                      </div>

                      {/* LEVEL 2 — One quiet action row (only when there's a real problem) */}
                      {isUrgent && (
                        <button
                          onClick={() => navigate(action.href)}
                          className="group/act w-full flex items-center justify-between gap-3 rounded-md bg-muted/40 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">
                              Why · {diag.why[0] || "Strategy gap"}
                            </p>
                            <p className="mt-0.5 text-sm font-medium text-foreground">
                              {action.label}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover/act:text-foreground group-hover/act:translate-x-0.5 transition-all" />
                        </button>
                      )}

                      {/* LEVEL 3 — Goal · Execution · Velocity (compact, divided, not tinted) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border border-y border-border">
                        <div className="px-4 py-3 first:pl-0">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Goal</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {c.target_quantity && c.target_metric
                              ? `${c.target_quantity} ${metricLabels[c.target_metric] || c.target_metric}`
                              : <span className="text-muted-foreground font-normal">Not set</span>}
                          </p>
                          {outcomePct !== null && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{prog!.current_value}/{prog!.target_value} · {outcomePct}%</p>
                          )}
                        </div>
                        <div className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Execution</p>
                          <p className="mt-1 text-sm font-medium text-foreground">
                            {posting ? `${posting.drafted}/${posting.total} posts` : <span className="text-muted-foreground font-normal">No plan</span>}
                          </p>
                          {posting && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{(postingPct ?? 0)}% drafted</p>
                          )}
                        </div>
                        <div className="px-4 py-3 last:pr-0">
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Velocity</p>
                          {velocity ? (
                            <>
                              <p className="mt-1 text-sm font-medium text-foreground tabular-nums">
                                {velocity.actual} <span className="text-muted-foreground font-normal">/ {velocity.required} per wk</span>
                              </p>
                              <p className={cn("mt-0.5 text-[11px]", velocity.onPace ? "text-muted-foreground" : meta.textClass)}>
                                {velocity.onPace ? "On pace" : `${(velocity.required - velocity.actual).toFixed(1)} short / week`}
                              </p>
                            </>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground font-normal">—</p>
                          )}
                        </div>
                      </div>

                      {/* LEVEL 4 — Quiet meta + actions */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span>{personaName(c.primary_persona_id)}</span>
                          {c.tone && <><span className="text-border">·</span><span className="capitalize">{c.tone}</span></>}
                          {c.cta_type && <><span className="text-border">·</span><span className="capitalize">{c.cta_type} CTA</span></>}
                          {c.offer && <><span className="text-border">·</span><span>{c.offer}</span></>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => navigate(`/campaign/${c.id}`)} className="h-8 text-xs">
                            View plan <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="h-8 w-8 p-0">
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
