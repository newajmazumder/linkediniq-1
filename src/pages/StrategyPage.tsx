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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Plus, Trash2, Target, Sparkles, ArrowRight,
  AlertTriangle, ChevronRight, Zap, Flame, Edit2, AlertCircle, Wrench,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  current_goal_value?: number | null;
  goal_progress_percent?: number | null;
  goal_status?: string | null;
  started_at?: string | null;
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
  target_end_date: "",
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

  // Live refresh when any campaign's goal aggregate updates from elsewhere
  useEffect(() => {
    const handler = () => { fetchCampaigns(); };
    const off: (() => void)[] = [];
    campaigns.forEach((c) => {
      const evt = goalUpdatedEvent(c.id);
      window.addEventListener(evt, handler);
      off.push(() => window.removeEventListener(evt, handler));
    });
    return () => off.forEach((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns.map((c) => c.id).join(",")]);

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
        target_end_date: form.target_end_date ? new Date(form.target_end_date).toISOString() : null,
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
      target_end_date: (c as any).target_end_date ? new Date((c as any).target_end_date).toISOString().split("T")[0] : "",
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
    <div className="content-fade-in space-y-6 px-6 sm:px-10 lg:px-14 py-6">
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
      <Tabs value={tab} onValueChange={(v) => setTab(v as "campaigns" | "recommendations")}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Campaigns tab */}
      {tab === "campaigns" && (
        <>
          <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditingId(null); } }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit" : "Create"} Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
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
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-xs font-medium text-foreground">Campaign End Date</label>
                      <Input
                        type="date"
                        value={form.target_end_date}
                        onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
                        className="text-sm"
                      />
                      <p className="text-[10px] text-muted-foreground">When should this campaign be complete? Used for pacing & "expected by today" math.</p>
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
                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
                    {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                    {editingId ? "Update" : "Create"} Campaign
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {campaigns.length === 0 && !showForm ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">No campaigns yet. Create one to guide your content.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {campaigns.map((c) => {
                const prog = progress[c.id];
                const posting = postingStats[c.id];
                // Prefer the campaign's own rolled-up goal value (source of truth,
                // kept in sync by aggregate-campaign-goals). Fall back to the legacy
                // campaign_progress table only if the campaign row hasn't been rolled up yet.
                const campaignCurrent = c.current_goal_value ?? null;
                const campaignTarget = c.target_quantity ?? null;
                const outcomePct =
                  campaignCurrent != null && campaignTarget && campaignTarget > 0
                    ? Math.min(100, Math.round((campaignCurrent / campaignTarget) * 100))
                    : c.goal_progress_percent != null
                    ? Math.min(100, Math.round(c.goal_progress_percent))
                    : prog && prog.target_value > 0
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

                // Lifecycle pill — derived from started_at + state.
                // Open Seeding (active) = green tint; Not Started = green tint; Launch Paused = neutral gray.
                const lifecycle: { label: string; cls: string } = !c.started_at
                  ? { label: "Not Started", cls: "bg-primary/10 text-primary" }
                  : state === "off_track" || state === "at_risk"
                  ? { label: "Launch Paused", cls: "bg-muted text-muted-foreground" }
                  : { label: "Open Seeding", cls: "bg-primary/10 text-primary" };

                // Score subtitle — persona names if started, risk hint otherwise.
                const personaSubtitle = [c.primary_persona_id, c.secondary_persona_id]
                  .map(personaName)
                  .filter((n) => n && n !== "—")
                  .join(" — ");

                // Footer chip — only the primary persona, nothing else.
                const primaryPersonaName = c.primary_persona_id ? personaName(c.primary_persona_id) : null;
                const visibleTags: string[] = primaryPersonaName && primaryPersonaName !== "—" ? [primaryPersonaName] : [];
                const overflowCount = 0;

                const metricLabelLower = c.target_metric
                  ? (metricLabels[c.target_metric] || c.target_metric).toLowerCase()
                  : "";
                const goalLabel = c.target_quantity && c.target_metric
                  ? (campaignCurrent != null
                      ? `${Math.round(campaignCurrent)} / ${c.target_quantity} ${metricLabelLower}`
                      : `${c.target_quantity} ${metricLabelLower}`)
                  : (c.goal || "—");
                const goalPct = outcomePct ?? 0;

                return (
                  <div
                    key={c.id}
                    className="flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm"
                  >
                    {/* Body — single column stacked layout */}
                    <div className="flex-1 p-6 sm:p-7 space-y-4">
                      {/* Pills */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide", lifecycle.cls)}>
                          {lifecycle.label}
                        </span>
                        {c.target_timeframe && (
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {c.target_timeframe.replace(/_/g, " ")}
                          </span>
                        )}
                        {c.target_priority === "high" && (
                          <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
                            High Priority
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight leading-snug">
                        {c.name}
                      </h2>

                      {/* Strategy text */}
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {c.core_message ? `“${c.core_message}”` : summary}
                      </p>

                      {/* Goal row */}
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-foreground">{goalLabel}</span>
                          <span className="font-medium text-foreground tabular-nums">{goalPct}%</span>
                        </div>
                        <Progress value={goalPct} className="h-1" />
                      </div>
                    </div>

                    {/* Footer — score on left, actions on right */}
                    <div className="flex items-center justify-between gap-4 border-t border-border px-6 sm:px-7 py-4">
                      <div className="flex items-baseline">
                        {c.started_at ? (
                          <div className="font-serif text-3xl font-normal leading-none tabular-nums text-foreground">
                            {score.total.toFixed(1)}
                            <span className="text-xs text-muted-foreground ml-0.5">/10</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Not started</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" onClick={() => navigate(`/campaign/${c.id}`)} className="h-9 px-4 text-xs font-medium">
                          View plan
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startEdit(c)} className="h-9 w-9 p-0">
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
