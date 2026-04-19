// Proactive Advisor — surfaces critical missing info as questions the user
// can answer or dismiss. When the question maps to known data (persona, offer,
// tone, CTA, metric, language) we render a Select; otherwise a Textarea.
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  answerAdvisorQuestion, dismissAdvisorQuestion,
  type AdvisorQuestion,
} from "@/lib/campaign-brain";
import { toast } from "sonner";

const SEVERITY_TONE = {
  high:   { dot: "bg-destructive", text: "text-destructive", label: "Blocking decision quality" },
  medium: { dot: "bg-amber-500",   text: "text-amber-700 dark:text-amber-400", label: "Improves recommendations" },
  low:    { dot: "bg-muted-foreground", text: "text-muted-foreground", label: "Optional context" },
} as const;

const CUSTOM_VALUE = "__custom__";

type ResolvedKind = "persona" | "offer" | "tone" | "cta" | "metric" | "language" | null;
type Option = { value: string; label: string; meta?: Record<string, any> };

interface Resolved {
  kind: ResolvedKind;
  options: Option[];
}

/** Match a question_key (or question text) against known data domains. */
function classifyQuestion(q: AdvisorQuestion): ResolvedKind {
  const k = `${q.question_key} ${q.question}`.toLowerCase();
  if (/persona|audience|target.*(audience|customer|buyer)/.test(k)) return "persona";
  if (/\boffer\b|product|package|deal/.test(k)) return "offer";
  if (/\btone\b|voice|style/.test(k)) return "tone";
  if (/\bcta\b|call.to.action/.test(k)) return "cta";
  if (/metric|kpi|goal.*(measure|metric)/.test(k)) return "metric";
  if (/\blanguage\b/.test(k)) return "language";
  return null;
}

const STATIC_OPTIONS: Record<Exclude<ResolvedKind, null | "persona" | "offer">, Option[]> = {
  tone: [
    { value: "authoritative", label: "Authoritative" },
    { value: "friendly",      label: "Friendly" },
    { value: "bold",          label: "Bold" },
    { value: "empathetic",    label: "Empathetic" },
    { value: "professional",  label: "Professional" },
    { value: "conversational",label: "Conversational" },
  ],
  cta: [
    { value: "comment",  label: "Comment to engage" },
    { value: "dm",       label: "Send a DM" },
    { value: "link",     label: "Click a link" },
    { value: "demo",     label: "Book a demo" },
    { value: "download", label: "Download a resource" },
    { value: "soft",     label: "Soft (no explicit ask)" },
  ],
  metric: [
    { value: "followers",     label: "Followers" },
    { value: "dms",           label: "DMs / inbound replies" },
    { value: "demo_bookings", label: "Demo bookings" },
    { value: "leads",         label: "Leads" },
    { value: "clicks",        label: "Link clicks" },
    { value: "impressions",   label: "Impressions" },
  ],
  language: [
    { value: "english", label: "English" },
    { value: "bangla",  label: "Bangla (Bengali)" },
  ],
};

/** Field on `campaigns` to update when the user picks a known option. */
function campaignFieldFor(kind: ResolvedKind): string | null {
  switch (kind) {
    case "persona":  return "primary_persona_id";
    case "offer":    return "offer";
    case "tone":     return "tone";
    case "cta":      return "cta_type";
    case "metric":   return "target_metric";
    case "language": return "language";
    default:         return null;
  }
}

export default function CampaignAdvisorBanner({
  questions,
  onChange,
}: {
  questions: AdvisorQuestion[];
  onChange?: () => void;
}) {
  const open = questions.filter(q => q.status === "open");
  const [expanded, setExpanded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<string>("");
  const [customAnswer, setCustomAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [personas, setPersonas] = useState<Option[]>([]);
  const [offers, setOffers] = useState<Option[]>([]);

  // Lazy-load persona + offer options once a question is being answered.
  useEffect(() => {
    if (!activeId) return;
    (async () => {
      const [{ data: pers }, { data: biz }] = await Promise.all([
        supabase.from("audience_personas").select("id, name, industry").order("name"),
        supabase.from("business_profiles").select("offers_campaigns").maybeSingle(),
      ]);
      setPersonas((pers || []).map(p => ({
        value: p.id,
        label: p.industry ? `${p.name} · ${p.industry}` : p.name,
      })));
      const rawOffers = Array.isArray(biz?.offers_campaigns) ? biz!.offers_campaigns : [];
      setOffers(
        rawOffers
          .map((o: any, i: number) => {
            const label =
              typeof o === "string" ? o :
              o?.name || o?.title || o?.offer || JSON.stringify(o);
            return label ? { value: String(label), label: String(label), meta: { index: i } } : null;
          })
          .filter(Boolean) as Option[],
      );
    })();
  }, [activeId]);

  const activeQuestion = open.find(q => q.id === activeId) || null;

  const resolved = useMemo<Resolved>(() => {
    if (!activeQuestion) return { kind: null, options: [] };
    const kind = classifyQuestion(activeQuestion);
    if (!kind) return { kind: null, options: [] };
    if (kind === "persona") return { kind, options: personas };
    if (kind === "offer")   return { kind, options: offers };
    return { kind, options: STATIC_OPTIONS[kind] };
  }, [activeQuestion, personas, offers]);

  if (open.length === 0) return null;

  const top = open[0];
  const tone = SEVERITY_TONE[top.severity];

  function startAnswering(q: AdvisorQuestion) {
    setActiveId(q.id);
    setSelectedValue("");
    setCustomAnswer(q.answer || "");
    setExpanded(false);
  }

  async function submit(q: AdvisorQuestion) {
    const usingCustom = !resolved.options.length || selectedValue === CUSTOM_VALUE || selectedValue === "";
    let savedAnswer = "";
    let campaignPatch: Record<string, any> | null = null;

    if (usingCustom) {
      savedAnswer = customAnswer.trim();
      if (!savedAnswer) { toast.error("Add an answer first"); return; }
    } else {
      const opt = resolved.options.find(o => o.value === selectedValue);
      if (!opt) { toast.error("Pick an option"); return; }
      savedAnswer = opt.label;
      const field = campaignFieldFor(resolved.kind);
      if (field) {
        // For persona we store the UUID; for offer we store the label string;
        // for enums we store the canonical value (e.g. "friendly").
        const value =
          resolved.kind === "persona" ? opt.value :
          resolved.kind === "offer"   ? opt.label :
          opt.value;
        campaignPatch = { [field]: value };
      }
    }

    setSubmitting(true);
    if (campaignPatch) {
      const { error: cErr } = await supabase
        .from("campaigns").update(campaignPatch).eq("id", q.campaign_id);
      if (cErr) {
        setSubmitting(false);
        toast.error("Could not update campaign");
        return;
      }
    }
    const { error } = await answerAdvisorQuestion(q.id, savedAnswer);
    setSubmitting(false);
    if (error) { toast.error("Could not save answer"); return; }

    toast.success(campaignPatch ? "Saved — campaign updated" : "Got it — recommendations will improve");
    setActiveId(null);
    setSelectedValue("");
    setCustomAnswer("");
    onChange?.();
  }

  async function dismiss(q: AdvisorQuestion) {
    const { error } = await dismissAdvisorQuestion(q.id);
    if (error) { toast.error("Could not dismiss"); return; }
    onChange?.();
  }

  function renderInput(q: AdvisorQuestion) {
    const hasOptions = resolved.options.length > 0;
    const showTextarea = !hasOptions || selectedValue === CUSTOM_VALUE;

    return (
      <div className="pt-2 space-y-2">
        {hasOptions && (
          <Select value={selectedValue} onValueChange={setSelectedValue}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={`Choose ${resolved.kind}…`} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {resolved.options.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
              <SelectItem value={CUSTOM_VALUE}>Custom answer…</SelectItem>
            </SelectContent>
          </Select>
        )}
        {showTextarea && (
          <Textarea
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder={hasOptions ? "Type your custom answer…" : "Type your answer…"}
            className="min-h-[72px] text-sm"
            autoFocus
          />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => submit(q)} disabled={submitting}>
            <Check className="h-3.5 w-3.5 mr-1" /> Save answer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setActiveId(null); setSelectedValue(""); setCustomAnswer(""); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-l-[3px] border-foreground/40 px-4 py-3 sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
              <span className={cn("font-medium uppercase tracking-wider", tone.text)}>Advisor</span>
              <span className="text-muted-foreground">· {tone.label}</span>
              {open.length > 1 && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground tabular-nums">{open.length} questions</span>
                </>
              )}
            </div>
            <p className="text-sm text-foreground leading-snug">{top.question}</p>
            {top.why_it_matters && (
              <p className="text-xs text-muted-foreground leading-relaxed">{top.why_it_matters}</p>
            )}

            {activeId === top.id ? renderInput(top) : (
              <div className="pt-1.5 flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" onClick={() => startAnswering(top)}>
                  Answer
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => dismiss(top)}>
                  <X className="h-3 w-3 mr-1" /> Not now
                </Button>
                {open.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={() => setExpanded(!expanded)}>
                    {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                    {expanded ? "Hide" : `+${open.length - 1} more`}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        {expanded && open.length > 1 && (
          <div className="mt-4 ml-7 space-y-3 border-t border-border pt-3">
            {open.slice(1).map((q) => {
              const t = SEVERITY_TONE[q.severity];
              const isActive = activeId === q.id;
              return (
                <div key={q.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
                    <span className={cn("font-medium uppercase tracking-wider", t.text)}>{q.severity}</span>
                  </div>
                  <p className="text-sm text-foreground">{q.question}</p>
                  {q.why_it_matters && <p className="text-xs text-muted-foreground">{q.why_it_matters}</p>}
                  {isActive ? renderInput(q) : (
                    <div className="flex items-center gap-1.5 pt-0.5">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => startAnswering(q)}>
                        Answer
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={() => dismiss(q)}>
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
