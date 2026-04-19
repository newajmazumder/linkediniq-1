import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Copy, Swords, RefreshCw } from "lucide-react";

type Move = "mirror" | "outperform" | "oppose" | string | null | undefined;

interface Props {
  move: Move;
  className?: string;
  showIcon?: boolean;
}

const config: Record<string, { label: string; icon: any; classes: string }> = {
  mirror: {
    label: "Mirror",
    icon: Copy,
    classes: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  outperform: {
    label: "Outperform",
    icon: RefreshCw,
    classes: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  oppose: {
    label: "Oppose",
    icon: Swords,
    classes: "bg-destructive/10 text-destructive border-destructive/30",
  },
};

export function StrategicMoveBadge({ move, className, showIcon = true }: Props) {
  if (!move) return null;
  const cfg = config[String(move).toLowerCase()];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 gap-1 font-semibold uppercase tracking-wider", cfg.classes, className)}>
      {showIcon && <Icon className="h-2.5 w-2.5" />}
      {cfg.label}
    </Badge>
  );
}
