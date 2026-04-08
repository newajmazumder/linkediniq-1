import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";

const allCategories = [
  { key: "company_overview", label: "Company Overview" },
  { key: "product_overview", label: "Product Overview" },
  { key: "feature_docs", label: "Feature Documentation" },
  { key: "founder_voice", label: "Founder Voice" },
  { key: "positioning", label: "Positioning / Messaging" },
  { key: "pain_points", label: "Customer Pain Points" },
  { key: "audience_notes", label: "Audience / ICP Notes" },
  { key: "campaign_brief", label: "Campaign Brief" },
  { key: "case_study", label: "Case Study / Proof" },
  { key: "release_notes", label: "Release Notes" },
  { key: "cta_guidance", label: "CTA / Offer Guidance" },
  { key: "restrictions", label: "Restrictions" },
];

const profileFields = [
  { key: "company_summary", label: "Company Summary" },
  { key: "product_summary", label: "Product Summary" },
  { key: "target_audience", label: "Target Audience" },
  { key: "differentiators", label: "Differentiators", isArray: true },
  { key: "customer_problems", label: "Customer Problems", isArray: true },
  { key: "brand_tone", label: "Brand Tone" },
  { key: "messaging_pillars", label: "Messaging Pillars", isArray: true },
  { key: "current_priorities", label: "Current Priorities", isArray: true },
];

const ContextHealthTab = () => {
  const { user } = useAuth();
  const [categoryCoverage, setCategoryCoverage] = useState<Record<string, { count: number; active: number; latest: string | null }>>({});
  const [profileCoverage, setProfileCoverage] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [sourcesRes, profileRes] = await Promise.all([
        supabase.from("context_sources").select("source_category, is_active, updated_at"),
        supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      ]);

      // Category coverage
      const catMap: Record<string, { count: number; active: number; latest: string | null }> = {};
      for (const cat of allCategories) catMap[cat.key] = { count: 0, active: 0, latest: null };
      for (const src of (sourcesRes.data || []) as any[]) {
        const cat = src.source_category;
        if (!catMap[cat]) catMap[cat] = { count: 0, active: 0, latest: null };
        catMap[cat].count++;
        if (src.is_active) catMap[cat].active++;
        if (!catMap[cat].latest || src.updated_at > catMap[cat].latest!) catMap[cat].latest = src.updated_at;
      }
      setCategoryCoverage(catMap);

      // Profile coverage
      const pc: Record<string, boolean> = {};
      if (profileRes.data) {
        for (const f of profileFields) {
          const val = (profileRes.data as any)[f.key];
          if (f.isArray) {
            pc[f.key] = Array.isArray(val) && val.length > 0;
          } else {
            pc[f.key] = !!val && val.trim().length > 0;
          }
        }
      }
      setProfileCoverage(pc);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return <div className="h-64 rounded-lg border border-border bg-card animate-pulse mt-4" />;
  }

  const totalCategories = allCategories.length;
  const coveredCategories = allCategories.filter(c => (categoryCoverage[c.key]?.active || 0) > 0).length;
  const coveragePct = Math.round((coveredCategories / totalCategories) * 100);

  const totalFields = profileFields.length;
  const coveredFields = profileFields.filter(f => profileCoverage[f.key]).length;
  const fieldPct = Math.round((coveredFields / totalFields) * 100);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  return (
    <div className="space-y-6 pt-4">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Source Coverage</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{coveragePct}%</p>
          <p className="text-xs text-muted-foreground">{coveredCategories} of {totalCategories} categories covered</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Profile Completeness</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{fieldPct}%</p>
          <p className="text-xs text-muted-foreground">{coveredFields} of {totalFields} key fields filled</p>
        </div>
      </div>

      {/* Source categories */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Source Category Coverage</h3>
        <div className="space-y-2">
          {allCategories.map(cat => {
            const info = categoryCoverage[cat.key];
            const hasActive = (info?.active || 0) > 0;
            const isOutdated = info?.latest && info.latest < thirtyDaysAgo;
            return (
              <div key={cat.key} className="flex items-center gap-2 text-sm">
                {hasActive ? (
                  isOutdated ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" /> : <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <span className={hasActive ? "text-foreground" : "text-muted-foreground"}>{cat.label}</span>
                {hasActive && <span className="text-xs text-muted-foreground ml-auto">{info?.active} active</span>}
                {isOutdated && <span className="text-xs text-amber-500 ml-1">outdated</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile fields */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Business Profile Fields</h3>
        <div className="space-y-2">
          {profileFields.map(f => (
            <div key={f.key} className="flex items-center gap-2 text-sm">
              {profileCoverage[f.key] ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={profileCoverage[f.key] ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ContextHealthTab;
