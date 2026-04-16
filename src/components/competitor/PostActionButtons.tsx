import { Button } from "@/components/ui/button";
import { RefreshCw, Swords, Zap, AlertTriangle } from "lucide-react";

interface PostActionButtonsProps {
  post: {
    content: string;
    hook_style?: string | null;
    tone?: string | null;
    cta_type?: string | null;
    post_analysis?: any;
  };
  onRewriteBetter: () => void;
  onGenerateCompeting: () => void;
  onUseHook: () => void;
  onExploitWeakness: () => void;
}

export function PostActionButtons({
  post,
  onRewriteBetter,
  onGenerateCompeting,
  onUseHook,
  onExploitWeakness,
}: PostActionButtonsProps) {
  const hasWeakness = post.post_analysis?.weakness_analysis?.failures?.length > 0;

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-border">
      <Button size="sm" variant="default" className="h-6 text-[10px] px-2 gap-1" onClick={onRewriteBetter}>
        <RefreshCw className="h-2.5 w-2.5" /> Rewrite Better
      </Button>
      <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={onGenerateCompeting}>
        <Swords className="h-2.5 w-2.5" /> Generate Competing Post
      </Button>
      {post.hook_style && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1" onClick={onUseHook}>
          <Zap className="h-2.5 w-2.5" /> Use This Hook
        </Button>
      )}
      {hasWeakness && (
        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onExploitWeakness}>
          <AlertTriangle className="h-2.5 w-2.5" /> Exploit Weakness
        </Button>
      )}
    </div>
  );
}
