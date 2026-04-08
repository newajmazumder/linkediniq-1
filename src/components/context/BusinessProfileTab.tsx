import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2 } from "lucide-react";

type Profile = {
  id?: string;
  company_summary: string;
  founder_story: string;
  product_summary: string;
  target_audience: string;
  industries_served: string[];
  customer_problems: string[];
  product_features: string[];
  customer_benefits: string[];
  differentiators: string[];
  proof_points: string[];
  offers_campaigns: string[];
  objections: string[];
  brand_tone: string;
  desired_perception: string;
  current_priorities: string[];
  messaging_pillars: string[];
  valid_ctas: string[];
  restricted_claims: string[];
  keywords: string[];
};

const emptyProfile: Profile = {
  company_summary: "", founder_story: "", product_summary: "", target_audience: "",
  industries_served: [], customer_problems: [], product_features: [], customer_benefits: [],
  differentiators: [], proof_points: [], offers_campaigns: [], objections: [],
  brand_tone: "", desired_perception: "",
  current_priorities: [], messaging_pillars: [], valid_ctas: [], restricted_claims: [], keywords: [],
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    {children}
  </div>
);

const Field = ({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    {multiline ? (
      <Textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className="text-sm" />
    ) : (
      <Input value={value} onChange={e => onChange(e.target.value)} className="text-sm" />
    )}
  </div>
);

const ArrayField = ({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    <Textarea
      value={Array.isArray(value) ? value.join("\n") : ""}
      onChange={e => onChange(e.target.value.split("\n").filter(Boolean))}
      rows={3}
      className="text-sm"
      placeholder="One item per line"
    />
  </div>
);

const BusinessProfileTab = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("business_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as any);
      setHasProfile(true);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const update = (field: keyof Profile, value: any) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = { ...profile, user_id: user.id };
      delete (payload as any).id;
      delete (payload as any).created_at;
      delete (payload as any).updated_at;

      if (hasProfile) {
        const { error } = await supabase.from("business_profiles").update(payload as any).eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("business_profiles").insert(payload as any);
        if (error) throw error;
        setHasProfile(true);
      }
      toast.success("Business profile saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="space-y-3 pt-4">{[1, 2, 3].map(i => <div key={i} className="h-32 rounded-lg border border-border bg-card animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasProfile ? "Edit your structured business knowledge below." : "No profile yet — add sources to auto-extract, or fill in manually."}
        </p>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save
        </Button>
      </div>

      <Section title="Identity">
        <Field label="Company Summary" value={profile.company_summary || ""} onChange={v => update("company_summary", v)} multiline />
        <Field label="Founder / Company Story" value={profile.founder_story || ""} onChange={v => update("founder_story", v)} multiline />
      </Section>

      <Section title="Product">
        <Field label="Product Summary" value={profile.product_summary || ""} onChange={v => update("product_summary", v)} multiline />
        <ArrayField label="Product Features" value={profile.product_features || []} onChange={v => update("product_features", v)} />
        <ArrayField label="Customer Benefits" value={profile.customer_benefits || []} onChange={v => update("customer_benefits", v)} />
        <ArrayField label="Differentiators" value={profile.differentiators || []} onChange={v => update("differentiators", v)} />
      </Section>

      <Section title="Audience">
        <Field label="Target Audience" value={profile.target_audience || ""} onChange={v => update("target_audience", v)} multiline />
        <ArrayField label="Industries Served" value={profile.industries_served || []} onChange={v => update("industries_served", v)} />
        <ArrayField label="Customer Problems" value={profile.customer_problems || []} onChange={v => update("customer_problems", v)} />
        <ArrayField label="Objections" value={profile.objections || []} onChange={v => update("objections", v)} />
      </Section>

      <Section title="Messaging">
        <Field label="Brand Tone" value={profile.brand_tone || ""} onChange={v => update("brand_tone", v)} />
        <Field label="Desired Perception" value={profile.desired_perception || ""} onChange={v => update("desired_perception", v)} />
        <ArrayField label="Messaging Pillars" value={profile.messaging_pillars || []} onChange={v => update("messaging_pillars", v)} />
        <ArrayField label="Proof Points" value={profile.proof_points || []} onChange={v => update("proof_points", v)} />
      </Section>

      <Section title="Strategy">
        <ArrayField label="Current Priorities" value={profile.current_priorities || []} onChange={v => update("current_priorities", v)} />
        <ArrayField label="Active Offers / Campaigns" value={profile.offers_campaigns || []} onChange={v => update("offers_campaigns", v)} />
        <ArrayField label="Valid CTAs" value={profile.valid_ctas || []} onChange={v => update("valid_ctas", v)} />
        <ArrayField label="Keywords" value={profile.keywords || []} onChange={v => update("keywords", v)} />
      </Section>

      <Section title="Restrictions">
        <ArrayField label="Restricted / Forbidden Claims" value={profile.restricted_claims || []} onChange={v => update("restricted_claims", v)} />
      </Section>
    </div>
  );
};

export default BusinessProfileTab;
