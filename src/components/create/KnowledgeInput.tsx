import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronUp, Brain } from "lucide-react";

export type KnowledgeContext = {
  productDescription: string;
  features: string;
  targetAudience: string;
};

type Props = {
  value: KnowledgeContext;
  onChange: (ctx: KnowledgeContext) => void;
};

const KnowledgeInput = ({ value, onChange }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const hasContent = value.productDescription || value.features || value.targetAudience;

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Product Context</span>
          {hasContent && !expanded && (
            <span className="text-xs text-muted-foreground">· configured</span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Add context about your product to improve generation quality.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Product Description</label>
            <Textarea
              placeholder="e.g. LinkedinIQ is an AI-powered customer support platform..."
              value={value.productDescription}
              onChange={(e) => onChange({ ...value, productDescription: e.target.value })}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Key Features</label>
            <Input
              placeholder="e.g. AI chatbot, WhatsApp integration, analytics"
              value={value.features}
              onChange={(e) => onChange({ ...value, features: e.target.value })}
              className="text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Target Audience</label>
            <Input
              placeholder="e.g. Ecommerce brands, SaaS founders, CX leaders"
              value={value.targetAudience}
              onChange={(e) => onChange({ ...value, targetAudience: e.target.value })}
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeInput;
