import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Send, Check, ArrowRight, Sparkles, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignRichText from "@/components/campaign/CampaignRichText";
import GoalStep from "@/components/campaign/GoalStep";
import StepModal, { STEP_CONFIGS } from "@/components/campaign/StepModal";

const STEP_LABELS: Record<string, string> = {
  goal: "Business Goal",
  targets: "Measurable Targets",
  structure: "Campaign Structure",
  audience: "Audience & Pain",
  product: "Product & Offer",
  style: "Campaign Style",
  blueprint: "Blueprint",
};

const STEPS = ["goal", "targets", "structure", "audience", "product", "style", "blueprint"];

type ChatMessageItem = {
  role: string;
  content: unknown;
};

const CampaignBuilderPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("goal");
  const [blueprint, setBlueprint] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  const [goalSubmitted, setGoalSubmitted] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [stepModalCompleted, setStepModalCompleted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && !conversationId) startConversation();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const startConversation = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-strategist", {
        body: { conversation_id: null, user_message: null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setConversationId(data.conversation_id);
      setCurrentStep(data.current_step);
      // Don't show initial AI message - show goal step UI instead
    } catch (err: any) {
      toast.error(err.message || "Failed to start");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string, showInChat = true) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    if (showInChat) {
      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("campaign-strategist", {
        body: { conversation_id: conversationId, user_message: userMsg },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCurrentStep(data.current_step);
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.blueprint) setBlueprint(data.blueprint);
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const handleGoalSubmit = async (_goalValue: string, message: string) => {
    setGoalSubmitted(true);
    await sendMessage(message, true);
    // After goal is processed, open the step modal for steps 2-6
    setTimeout(() => setShowStepModal(true), 600);
  };

  const handleStepModalComplete = async (answers: Record<string, Record<string, string | string[]>>) => {
    setShowStepModal(false);
    setStepModalCompleted(true);

    // Send all structured answers as sequential messages
    for (const stepConfig of STEP_CONFIGS) {
      const stepAnswers = answers[stepConfig.key];
      if (!stepAnswers) continue;

      // Build a structured message from the answers
      const parts: string[] = [];
      for (const q of stepConfig.questions) {
        const val = stepAnswers[q.id];
        if (val) {
          const display = Array.isArray(val) ? val.join(", ") : val;
          parts.push(`${q.label}: ${display}`);
        }
      }

      const customKey = `${stepConfig.key}_custom`;
      // Check custom inputs (stored in the modal's local state, passed via answers)
      const customText = stepAnswers[customKey];
      if (customText && typeof customText === "string" && customText.trim()) {
        parts.push(`Additional context: ${customText.trim()}`);
      }

      if (parts.length > 0) {
        const compositeMessage = parts.join(". ");
        // Show a summary in chat
        setMessages((prev) => [
          ...prev,
          { role: "user", content: `**${stepConfig.title}:** ${compositeMessage}` },
        ]);
        setLoading(true);

        try {
          const { data, error } = await supabase.functions.invoke("campaign-strategist", {
            body: { conversation_id: conversationId, user_message: compositeMessage },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);

          setCurrentStep(data.current_step);
          setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
          if (data.blueprint) {
            setBlueprint(data.blueprint);
            break; // Blueprint generated, stop sending
          }
        } catch (err: any) {
          toast.error(err.message || "Failed processing step");
          break;
        } finally {
          setLoading(false);
        }
      }
    }
  };

  const handleCreateCampaign = async () => {
    if (!conversationId) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-strategist", {
        body: { conversation_id: conversationId, user_message: null, action: "create_campaign" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Campaign created!");
      navigate(`/campaign/${data.campaign.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create campaign");
    } finally {
      setCreating(false);
    }
  };

  const currentStepIdx = STEPS.indexOf(currentStep);

  return (
    <div className="content-fade-in flex h-full overflow-hidden">
      {/* Left: Chat */}
      <div className="flex flex-col flex-1 min-w-0 border-r border-border h-full overflow-hidden">
        {/* Step indicator */}
        <div className="shrink-0 flex items-center gap-1 px-5 py-3 border-b border-border bg-card/50 overflow-x-auto">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-1 shrink-0">
              <div className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors",
                i < currentStepIdx ? "bg-primary/10 text-primary" :
                i === currentStepIdx ? "bg-primary text-primary-foreground" :
                "bg-muted text-muted-foreground"
              )}>
                {i < currentStepIdx ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}
                <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4 space-y-4">
          {/* Chat messages */}
          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer: Goal step card + chat input always visible */}
        <div className="shrink-0 border-t border-border bg-card">
          <div className="px-5 py-3 space-y-3">
            {/* Goal step inline card above input */}
            {!goalSubmitted && !loading && conversationId && (
              <GoalStep onSubmit={handleGoalSubmit} loading={loading} />
            )}

            {blueprint ? (
              <Button onClick={handleCreateCampaign} disabled={creating} className="w-full">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Create Campaign & Generate Plan
              </Button>
            ) : (
              <div className="flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                  placeholder="Add more context or ask a question..."
                  rows={2}
                  className="resize-none text-sm flex-1"
                  disabled={loading}
                />
                <Button size="icon" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Blueprint Preview */}
      <BlueprintPanel blueprint={blueprint} />

      {/* Step Modal for steps 2-6 */}
      <StepModal
        open={showStepModal}
        onClose={() => setShowStepModal(false)}
        onComplete={handleStepModalComplete}
      />
    </div>
  );
};

/* ── Chat Message ── */
const ChatMessage = ({ role, content }: { role: string; content: unknown }) => {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div className={cn(
        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
        isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
      )}>
        <CampaignRichText content={content} variant={isUser ? "user" : "assistant"} />
      </div>
    </div>
  );
};

/* ── Blueprint Panel ── */
const BlueprintPanel = ({ blueprint }: { blueprint: any }) => (
  <div className="w-[380px] min-w-[320px] shrink-0 overflow-y-auto bg-card/30 px-5 py-6 space-y-5">
    <div className="flex items-center gap-2">
      <MessageSquare className="h-4 w-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">Campaign Blueprint</h2>
    </div>

    {!blueprint ? (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-muted-foreground/40" />
        <p className="mt-2 text-xs text-muted-foreground">Your blueprint will appear here as you build the campaign.</p>
        <p className="mt-1 text-[10px] text-muted-foreground">Complete all steps to generate it.</p>
      </div>
    ) : (
      <div className="space-y-4">
        {blueprint.campaign_summary && (
          <BlueprintSection title="Campaign Summary">
            <KV label="Name" value={blueprint.campaign_summary.name} />
            <KV label="Objective" value={blueprint.campaign_summary.objective} />
            <KV label="Target" value={`${blueprint.campaign_summary.target_quantity || "?"} ${blueprint.campaign_summary.target_metric || ""}`} />
            <KV label="Duration" value={`${blueprint.campaign_summary.duration_weeks || "?"} weeks`} />
            <KV label="Posts" value={`${blueprint.campaign_summary.total_posts || "?"} total (${blueprint.campaign_summary.posts_per_week || "?"}/week)`} />
          </BlueprintSection>
        )}
        {blueprint.business_rationale && (
          <BlueprintSection title="Business Rationale">
            <p className="text-xs text-muted-foreground">{blueprint.business_rationale.why_this_campaign}</p>
            {blueprint.business_rationale.success_definition && (
              <KV label="Success" value={blueprint.business_rationale.success_definition} />
            )}
          </BlueprintSection>
        )}
        {blueprint.messaging_strategy && (
          <BlueprintSection title="Messaging">
            <KV label="Core Message" value={blueprint.messaging_strategy.core_message} />
            <KV label="Tone" value={blueprint.messaging_strategy.tone} />
            <KV label="Differentiator" value={blueprint.messaging_strategy.top_differentiator} />
          </BlueprintSection>
        )}
        {blueprint.cta_strategy && (
          <BlueprintSection title="CTA Strategy">
            <KV label="Type" value={blueprint.cta_strategy.cta_type} />
            <KV label="Primary CTA" value={blueprint.cta_strategy.primary_cta} />
          </BlueprintSection>
        )}
        {blueprint.ai_recommendations && blueprint.ai_recommendations.length > 0 && (
          <BlueprintSection title="AI Recommendations">
            {blueprint.ai_recommendations.map((rec: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {rec}</p>
            ))}
          </BlueprintSection>
        )}
      </div>
    )}
  </div>
);

const BlueprintSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-3 space-y-2">
    <h3 className="text-xs font-medium text-foreground">{title}</h3>
    {children}
  </div>
);

const KV = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
};

export default CampaignBuilderPage;
