import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type ScheduledDraft = {
  id: string;
  custom_content: string | null;
  status: string;
  scheduled_at: string | null;
  ideas?: { idea_title: string | null; instruction: string } | null;
};

const CalendarPage = () => {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<ScheduledDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);

  const fetchDrafts = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("drafts")
      .select("id, custom_content, status, scheduled_at, ideas(idea_title, instruction)")
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true });

    if (!error && data) setDrafts(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchDrafts();
  }, [user]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad to start on Monday
  const startDay = monthStart.getDay();
  const padBefore = startDay === 0 ? 6 : startDay - 1;

  const getDraftsForDay = (day: Date) =>
    drafts.filter((d) => d.scheduled_at && isSameDay(new Date(d.scheduled_at), day));

  const reschedule = async (id: string, date: Date) => {
    const { error } = await supabase
      .from("drafts")
      .update({ scheduled_at: date.toISOString(), status: "scheduled" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to reschedule");
    } else {
      toast.success(`Rescheduled to ${format(date, "PPP")}`);
      setRescheduleId(null);
      fetchDrafts();
    }
  };

  const mockPublish = async (id: string) => {
    const { error } = await supabase
      .from("drafts")
      .update({ status: "posted" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to publish");
    } else {
      toast.success("Post marked as published (mock)");
      fetchDrafts();
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      idea: "bg-muted text-muted-foreground",
      draft: "bg-secondary text-secondary-foreground",
      approved: "bg-primary/20 text-primary",
      scheduled: "bg-accent text-accent-foreground",
      posted: "bg-primary text-primary-foreground",
    };
    return map[status] || map.draft;
  };

  const selectedDayDrafts = selectedDate ? getDraftsForDay(selectedDate) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="content-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {drafts.length} scheduled {drafts.length === 1 ? "post" : "posts"}
        </p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-medium text-foreground">{format(currentMonth, "MMMM yyyy")}</h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {Array.from({ length: padBefore }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[80px] border-b border-r border-border bg-muted/30" />
          ))}
          {days.map((day) => {
            const dayDrafts = getDraftsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);

            return (
              <div
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  "min-h-[80px] border-b border-r border-border p-1.5 cursor-pointer transition-colors hover:bg-secondary/50",
                  isSelected && "bg-secondary",
                  isToday && "ring-1 ring-inset ring-primary/30"
                )}
              >
                <span className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                  isToday ? "bg-primary text-primary-foreground font-medium" : "text-foreground"
                )}>
                  {format(day, "d")}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayDrafts.slice(0, 2).map((d) => (
                    <div key={d.id} className={cn("truncate rounded px-1 py-0.5 text-[10px] font-medium", statusBadge(d.status))}>
                      {(d.ideas as any)?.idea_title?.slice(0, 20) || "Post"}
                    </div>
                  ))}
                  {dayDrafts.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayDrafts.length - 2} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">
            {format(selectedDate, "EEEE, MMMM d, yyyy")}
            <span className="ml-2 text-muted-foreground">
              ({selectedDayDrafts.length} {selectedDayDrafts.length === 1 ? "post" : "posts"})
            </span>
          </h3>

          {selectedDayDrafts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No posts scheduled for this day.</p>
          ) : (
            selectedDayDrafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-medium capitalize", statusBadge(draft.status))}>
                      {draft.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(draft.ideas as any)?.idea_title || "Untitled"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <Popover open={rescheduleId === draft.id} onOpenChange={(o) => setRescheduleId(o ? draft.id : null)}>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-7 text-xs">
                          <Clock className="mr-1 h-3 w-3" />
                          Move
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="single"
                          selected={draft.scheduled_at ? new Date(draft.scheduled_at) : undefined}
                          onSelect={(date) => date && reschedule(draft.id, date)}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    {draft.status === "scheduled" && (
                      <Button size="sm" className="h-7 text-xs" onClick={() => mockPublish(draft.id)}>
                        Publish
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground whitespace-pre-line line-clamp-3">
                  {draft.custom_content || "No content"}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPage;
