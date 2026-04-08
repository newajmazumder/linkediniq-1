import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Plus, FileText, Globe, Type, Trash2, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AddSourceDialog from "./AddSourceDialog";

type Source = {
  id: string;
  title: string;
  source_type: string;
  source_category: string;
  ingestion_status: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const categoryLabels: Record<string, string> = {
  company_overview: "Company Overview",
  product_overview: "Product Overview",
  feature_docs: "Feature Docs",
  founder_voice: "Founder Voice",
  positioning: "Positioning",
  pain_points: "Pain Points",
  audience_notes: "Audience Notes",
  campaign_brief: "Campaign Brief",
  case_study: "Case Study",
  release_notes: "Release Notes",
  cta_guidance: "CTA Guidance",
  restrictions: "Restrictions",
};

const typeIcons: Record<string, typeof FileText> = {
  text: Type,
  markdown: FileText,
  pdf: FileText,
  website: Globe,
};

const SourcesTab = () => {
  const { user } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchSources = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("context_sources")
      .select("id, title, source_type, source_category, ingestion_status, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });
    setSources((data || []) as Source[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  const handleToggle = async (id: string, currentActive: boolean) => {
    await supabase.from("context_sources").update({ is_active: !currentActive }).eq("id", id);
    setSources(prev => prev.map(s => s.id === id ? { ...s, is_active: !currentActive } : s));
  };

  const handleDelete = async (id: string) => {
    await supabase.from("context_sources").delete().eq("id", id);
    setSources(prev => prev.filter(s => s.id !== id));
    toast.success("Source deleted");
  };

  const handleReprocess = async (id: string) => {
    setProcessingIds(prev => new Set(prev).add(id));
    try {
      const { error } = await supabase.functions.invoke("ingest-context", {
        body: { source_id: id },
      });
      if (error) throw error;
      toast.success("Source reprocessed");
      await fetchSources();
    } catch (err: any) {
      toast.error(err.message || "Reprocess failed");
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      done: "default",
      processing: "secondary",
      pending: "outline",
      error: "destructive",
    };
    return <Badge variant={variants[status] || "outline"} className="text-[10px]">{status}</Badge>;
  };

  if (loading) {
    return <div className="space-y-3 pt-4">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg border border-border bg-card animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{sources.length} source{sources.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Source
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No sources yet</p>
          <p className="text-xs text-muted-foreground mb-4">Upload documents, paste text, or add website links to build your business context.</p>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Your First Source
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const Icon = typeIcons[source.source_type] || FileText;
            const isProcessing = processingIds.has(source.id) || source.ingestion_status === "processing";
            return (
              <div key={source.id} className={`flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-opacity ${!source.is_active ? "opacity-50" : ""}`}>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
                    {statusBadge(source.ingestion_status)}
                  </div>
                  <p className="text-xs text-muted-foreground">{categoryLabels[source.source_category] || source.source_category}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleReprocess(source.id)} disabled={isProcessing} className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50" title="Reprocess">
                    <RefreshCw className={`h-3.5 w-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                  </button>
                  <button onClick={() => handleToggle(source.id, source.is_active)} className="rounded p-1.5 text-muted-foreground hover:text-foreground transition-colors" title={source.is_active ? "Deactivate" : "Activate"}>
                    {source.is_active ? <ToggleRight className="h-4 w-4 text-primary" /> : <ToggleLeft className="h-4 w-4" />}
                  </button>
                  <button onClick={() => handleDelete(source.id)} className="rounded p-1.5 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AddSourceDialog open={dialogOpen} onOpenChange={setDialogOpen} onSourceAdded={fetchSources} />
    </div>
  );
};

export default SourcesTab;
