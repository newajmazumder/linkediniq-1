import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Type, Globe, Upload } from "lucide-react";

const categories = [
  { value: "company_overview", label: "Company Overview" },
  { value: "product_overview", label: "Product Overview" },
  { value: "feature_docs", label: "Feature Documentation" },
  { value: "founder_voice", label: "Founder Voice" },
  { value: "positioning", label: "Positioning / Messaging" },
  { value: "pain_points", label: "Customer Pain Points" },
  { value: "audience_notes", label: "Audience / ICP Notes" },
  { value: "campaign_brief", label: "Campaign Brief" },
  { value: "case_study", label: "Case Study / Proof" },
  { value: "release_notes", label: "Release Notes" },
  { value: "cta_guidance", label: "CTA / Offer Guidance" },
  { value: "restrictions", label: "Restrictions / Forbidden Claims" },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSourceAdded: () => void;
};

const AddSourceDialog = ({ open, onOpenChange, onSourceAdded }: Props) => {
  const { user } = useAuth();
  const [tab, setTab] = useState("text");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("company_overview");
  const [textContent, setTextContent] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setTitle("");
    setCategory("company_overview");
    setTextContent("");
    setUrl("");
    setTab("text");
  };

  const handleSave = async () => {
    if (!user) return;
    if (!title.trim()) { toast.error("Please enter a title"); return; }

    let source_type = tab;
    let raw_content: string | null = null;
    let source_url: string | null = null;

    if (tab === "text" || tab === "markdown") {
      if (!textContent.trim()) { toast.error("Please enter content"); return; }
      raw_content = textContent.trim();
    } else if (tab === "website") {
      if (!url.trim()) { toast.error("Please enter a URL"); return; }
      source_url = url.trim();
      if (!source_url.startsWith("http")) source_url = "https://" + source_url;
      source_type = "website";
    }

    setSaving(true);
    try {
      const { data: source, error } = await supabase
        .from("context_sources")
        .insert({
          user_id: user.id,
          title: title.trim(),
          source_type,
          source_category: category,
          raw_content,
          source_url,
          ingestion_status: "pending",
        } as any)
        .select("id")
        .single();

      if (error) throw error;

      // Trigger ingestion
      const { error: invokeErr } = await supabase.functions.invoke("ingest-context", {
        body: { source_id: source.id },
      });

      if (invokeErr) {
        console.error("Ingestion invoke error:", invokeErr);
        toast.warning("Source saved but ingestion may still be processing");
      } else {
        toast.success("Source added and processed!");
      }

      reset();
      onOpenChange(false);
      onSourceAdded();
    } catch (err: any) {
      toast.error(err.message || "Failed to add source");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Business Context Source</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Title</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Product Overview Doc" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground">Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full">
              <TabsTrigger value="text" className="flex-1 gap-1.5">
                <Type className="h-3.5 w-3.5" /> Text
              </TabsTrigger>
              <TabsTrigger value="markdown" className="flex-1 gap-1.5">
                <Type className="h-3.5 w-3.5" /> Markdown
              </TabsTrigger>
              <TabsTrigger value="website" className="flex-1 gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Website
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <Textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Paste your text content here... product descriptions, founder notes, campaign briefs, etc."
                rows={8}
                className="text-sm"
              />
            </TabsContent>

            <TabsContent value="markdown">
              <Textarea
                value={textContent}
                onChange={e => setTextContent(e.target.value)}
                placeholder="Paste your markdown content here..."
                rows={8}
                className="text-sm font-mono"
              />
            </TabsContent>

            <TabsContent value="website">
              <Input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/about"
                type="url"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">We'll extract the main content from the page.</p>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Processing...</> : "Add Source"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddSourceDialog;
