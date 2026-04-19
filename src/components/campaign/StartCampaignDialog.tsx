import { useState, useEffect, useMemo } from "react";
import { format, addDays, differenceInCalendarDays } from "date-fns";
import { CalendarIcon, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface StartCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  campaign: any;
  /** Called after dates are saved successfully — page should trigger generatePlan(). */
  onStarted: () => void;
}

const TIMEFRAME_DAYS: Record<string, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
  quarterly: 90,
};

export default function StartCampaignDialog({
  open,
  onOpenChange,
  campaignId,
  campaign,
  onStarted,
}: StartCampaignDialogProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [startDate, setStartDate] = useState<Date | undefined>(today);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Pre-fill end date based on existing campaign data or timeframe hint.
  useEffect(() => {
    if (!open) return;
    const existingStart = campaign?.target_start_date ? new Date(campaign.target_start_date) : today;
    const existingEnd = campaign?.target_end_date ? new Date(campaign.target_end_date) : null;
    setStartDate(existingStart);
    if (existingEnd) {
      setEndDate(existingEnd);
    } else {
      const tf = campaign?.target_timeframe as string | undefined;
      const days = tf && TIMEFRAME_DAYS[tf] ? TIMEFRAME_DAYS[tf] : 28;
      setEndDate(addDays(existingStart, days));
    }
  }, [open, campaign, today]);

  const totalDays = startDate && endDate ? differenceInCalendarDays(endDate, startDate) : 0;
  const totalWeeks = totalDays > 0 ? Math.max(1, Math.round(totalDays / 7)) : 0;
  const validRange = !!startDate && !!endDate && totalDays > 0;

  const handleSave = async () => {
    if (!validRange) {
      toast.error("End date must be after start date");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campaigns")
        .update({
          target_start_date: startDate!.toISOString(),
          target_end_date: endDate!.toISOString(),
          started_at: startDate!.toISOString(),
          execution_status: "active",
        })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Campaign started — generating plan…");
      onOpenChange(false);
      onStarted();
    } catch (err: any) {
      toast.error(err.message || "Failed to start campaign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-4 w-4" /> Start Campaign
          </DialogTitle>
          <DialogDescription>
            Set the campaign window. Posts will be scheduled across this range based on the plan frequency.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PP") : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => {
                      setStartDate(d);
                      // Keep end date >= start.
                      if (d && endDate && endDate <= d) {
                        setEndDate(addDays(d, 28));
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">End date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PP") : <span>Pick date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => (startDate ? date <= startDate : false)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Duration</span>
              <span className="text-foreground font-medium tabular-nums">
                {validRange ? `${totalDays} days · ~${totalWeeks} ${totalWeeks === 1 ? "week" : "weeks"}` : "—"}
              </span>
            </div>
            <p className="leading-relaxed pt-1">
              Each post will get a planned date distributed evenly across this window.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!validRange || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Start & Generate Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
