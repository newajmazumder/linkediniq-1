import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3 } from "lucide-react";

interface GapRow {
  content_type: string;
  competitor_pct: number;
  ideal_pct: number;
  gap_level: string;
  action: string;
}

const gapColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-green-500",
};

const gapBadgeColors: Record<string, string> = {
  high: "text-red-700 bg-red-500/10 border-red-500/30",
  medium: "text-amber-700 bg-amber-500/10 border-amber-500/30",
  low: "text-green-700 bg-green-500/10 border-green-500/30",
};

export function ContentGapMatrix({ matrix }: { matrix: GapRow[] }) {
  if (!matrix || matrix.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Content Gap Matrix</h3>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-[10px] font-semibold">Content Type</TableHead>
              <TableHead className="text-[10px] font-semibold text-center">Competitor</TableHead>
              <TableHead className="text-[10px] font-semibold text-center">Ideal</TableHead>
              <TableHead className="text-[10px] font-semibold text-center">Gap</TableHead>
              <TableHead className="text-[10px] font-semibold">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matrix.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium">{row.content_type}</TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-muted-foreground/40 rounded-full" style={{ width: `${row.competitor_pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{row.competitor_pct}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary/50 rounded-full" style={{ width: `${row.ideal_pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{row.ideal_pct}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${gapColors[row.gap_level] || gapColors.low}`} />
                    <Badge variant="outline" className={`text-[9px] h-4 px-1 ${gapBadgeColors[row.gap_level] || gapBadgeColors.low}`}>
                      {row.gap_level}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-[10px] text-muted-foreground max-w-[200px]">{row.action}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
