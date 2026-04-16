import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, Zap, ArrowRight } from "lucide-react";

interface ContentAngle {
  title: string;
  description: string;
  hook_type: string;
  intent: string;
  goal?: string;
  cta_style?: string;
  why_it_beats_competitor: string;
  expected_outcome?: string;
  example_hook: string;
}

const intentColors: Record<string, string> = {
  engagement: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  lead: "bg-purple-500/10 text-purple-700 border-purple-500/30",
  awareness: "bg-green-500/10 text-green-700 border-green-500/30",
  conversion: "bg-orange-500/10 text-orange-700 border-orange-500/30",
};

export function ContentAnglesPanel({ angles, onCreatePost, onGeneratePost }: {
  angles: ContentAngle[];
  onCreatePost?: (angle: ContentAngle) => void;
  onGeneratePost?: (angle: ContentAngle) => void;
}) {
  if (!angles || angles.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Content Angles You Should Execute</h3>
        <Badge variant="secondary" className="text-[9px]">{angles.length} angles</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {angles.map((angle, i) => (
          <div key={i} className="border border-border rounded-lg p-4 bg-card hover:border-primary/30 transition-colors space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-xs font-semibold text-foreground flex-1">
                <span className="text-primary mr-1">{i + 1}.</span> {angle.title}
              </h4>
            </div>

            <p className="text-[11px] text-muted-foreground">{angle.description}</p>

            {/* Goal & CTA */}
            {(angle.goal || angle.cta_style) && (
              <div className="bg-muted/50 rounded p-2 space-y-1">
                {angle.goal && (
                  <p className="text-[10px] text-foreground"><strong>Goal:</strong> {angle.goal}</p>
                )}
                {angle.cta_style && (
                  <p className="text-[10px] text-foreground"><strong>CTA:</strong> {angle.cta_style}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                <Zap className="h-2.5 w-2.5 mr-0.5" /> {angle.hook_type}
              </Badge>
              <Badge variant="outline" className={`text-[9px] h-4 px-1.5 ${intentColors[angle.intent] || ""}`}>
                {angle.intent}
              </Badge>
            </div>

            <p className="text-[10px] text-muted-foreground italic">
              <strong>Why it beats them:</strong> {angle.why_it_beats_competitor}
            </p>

            {/* Expected outcome */}
            {angle.expected_outcome && (
              <p className="text-[10px] text-primary font-medium">
                📈 Expected: {angle.expected_outcome}
              </p>
            )}

            {angle.example_hook && (
              <div className="bg-primary/5 border border-primary/20 rounded p-2">
                <p className="text-[9px] font-semibold text-primary mb-0.5">Example Hook:</p>
                <p className="text-[11px] text-foreground italic">"{angle.example_hook}"</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              {onGeneratePost && (
                <Button
                  size="sm"
                  className="h-7 text-[10px] px-3"
                  onClick={() => onGeneratePost(angle)}
                >
                  <ArrowRight className="h-2.5 w-2.5 mr-0.5" /> Generate Post
                </Button>
              )}
              {onCreatePost && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] px-3"
                  onClick={() => onCreatePost(angle)}
                >
                  Use as Brief
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
