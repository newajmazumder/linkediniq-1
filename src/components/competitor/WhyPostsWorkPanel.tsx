import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, CheckCircle2, Plus, Zap } from "lucide-react";

interface WhyPostWork {
  post_index: number;
  post_preview: string;
  why_it_worked: string;
  key_elements: string[];
  what_you_should_replicate: string;
  what_you_should_add: string;
}

export function WhyPostsWorkPanel({
  items,
  onReplicatePattern,
  onGeneratePost,
}: {
  items: WhyPostWork[];
  onReplicatePattern?: (item: WhyPostWork) => void;
  onGeneratePost?: (item: WhyPostWork) => void;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold text-foreground">Why Their Posts Work</h3>
      </div>

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="border border-border rounded-lg bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 border-b border-border">
              <p className="text-[10px] text-muted-foreground">
                Post #{item.post_index}: <span className="text-foreground italic">"{item.post_preview}"</span>
              </p>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-xs text-muted-foreground">{item.why_it_worked}</p>

              {item.key_elements?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.key_elements.map((el, j) => (
                    <Badge key={j} variant="outline" className="text-[9px] h-4 px-1.5">
                      {el}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="bg-green-500/5 border border-green-500/20 rounded p-2 space-y-0.5">
                  <p className="text-[9px] font-semibold text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Replicate This
                  </p>
                  <p className="text-[11px] text-foreground">{item.what_you_should_replicate}</p>
                </div>
                <div className="bg-primary/5 border border-primary/20 rounded p-2 space-y-0.5">
                  <p className="text-[9px] font-semibold text-primary flex items-center gap-1">
                    <Plus className="h-2.5 w-2.5" /> Add This to Beat Them
                  </p>
                  <p className="text-[11px] text-foreground">{item.what_you_should_add}</p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                {onGeneratePost && (
                  <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => onGeneratePost(item)}>
                    <Zap className="h-2.5 w-2.5 mr-0.5" /> Generate Post Using This
                  </Button>
                )}
                {onReplicatePattern && (
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => onReplicatePattern(item)}>
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Replicate Pattern
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
