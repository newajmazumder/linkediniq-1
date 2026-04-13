import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Check, ArrowRight, ArrowUp, Sparkles, MessageSquare, Mic, GripVertical, Plus, X, FileText, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import CampaignRichText from "@/components/campaign/CampaignRichText";
import StepCard, { STEP_CONFIGS } from "@/components/campaign/StepCard";

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

type AttachedFile = {
  file: File;
  preview?: string;
  type: "image" | "document";
};

const MIN_CHAT_WIDTH = 320;
const MIN_BLUEPRINT_WIDTH = 280;
const MAX_TEXTAREA_HEIGHT = 160;

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
  const [inlineStepIdx, setInlineStepIdx] = useState<number | null>(null);
  const [completedStepKeys, setCompletedStepKeys] = useState<Set<string>>(new Set());
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Resizable panel state
  const containerRef = useRef<HTMLDivElement>(null);
  const [chatWidthPercent, setChatWidthPercent] = useState(65);
  const isDragging = useRef(false);

  useEffect(() => {
    if (user && !conversationId) startConversation();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, inlineStepIdx]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";
    }
  }, [input]);

  // Drag handlers for resizable divider
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const newChatWidth = ev.clientX - rect.left;
      const percent = (newChatWidth / totalWidth) * 100;
      const minChatPct = (MIN_CHAT_WIDTH / totalWidth) * 100;
      const maxChatPct = 100 - (MIN_BLUEPRINT_WIDTH / totalWidth) * 100;
      setChatWidthPercent(Math.min(Math.max(percent, minChatPct), maxChatPct));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

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
      if (data.message) {
        setMessages([{ role: "assistant", content: data.message }]);
      }
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
    setAttachedFiles([]);
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
      if (data.blueprint) {
        setBlueprint(data.blueprint);
        setInlineStepIdx(null);
      }

      // If goal step and not yet submitted, the chat response counts as goal submission
      if (!goalSubmitted && data.current_step !== "goal") {
        setGoalSubmitted(true);
        setInlineStepIdx(0); // Show first structured step (targets)
      }
      // If user typed in chat while a structured step was showing, advance to next step
      else if (goalSubmitted && inlineStepIdx !== null && !data.blueprint) {
        const nextIdx = inlineStepIdx + 1;
        if (nextIdx < STEP_CONFIGS.length) {
          setInlineStepIdx(nextIdx);
        } else {
          setInlineStepIdx(null);
          generateBlueprint();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send");
    } finally {
      setLoading(false);
    }
  };

  const handleStepSubmit = async (stepConfigIdx: number, answers: Record<string, string | string[]>, customText: string) => {
    const config = STEP_CONFIGS[stepConfigIdx];

    const parts: string[] = [];
    for (const q of config.questions) {
      const val = answers[q.id];
      if (val) {
        const display = Array.isArray(val) ? val.join(", ") : val;
        parts.push(`${q.label}: ${display}`);
      }
    }
    if (customText.trim()) {
      parts.push(`Additional context: ${customText.trim()}`);
    }

    const compositeMessage = parts.join(". ");
    setMessages((prev) => [...prev, { role: "user", content: `**${config.title}:** ${compositeMessage}` }]);
    setCompletedStepKeys((prev) => new Set(prev).add(config.key));
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
        setInlineStepIdx(null);
      } else {
        const nextIdx = stepConfigIdx + 1;
        if (nextIdx < STEP_CONFIGS.length) {
          setInlineStepIdx(nextIdx);
        } else {
          setInlineStepIdx(null);
          generateBlueprint();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed processing step");
    } finally {
      setLoading(false);
    }
  };

  const generateBlueprint = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("campaign-strategist", {
        body: { conversation_id: conversationId, user_message: "All steps completed. Generate the campaign blueprint now." },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setCurrentStep(data.current_step);
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.blueprint) setBlueprint(data.blueprint);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate blueprint");
    } finally {
      setLoading(false);
    }
  };

  const handleSkipAndGenerate = async () => {
    setInlineStepIdx(null);
    await sendMessage("Skip remaining steps and generate the blueprint now.", true);
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

  // Attachment handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "document") => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: AttachedFile[] = [];
    Array.from(files).forEach((file) => {
      const attached: AttachedFile = { file, type };
      if (type === "image" && file.type.startsWith("image/")) {
        attached.preview = URL.createObjectURL(file);
      }
      newAttachments.push(attached);
    });
    setAttachedFiles((prev) => [...prev, ...newAttachments]);
    setShowAttachMenu(false);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles((prev) => {
      const file = prev[index];
      if (file.preview) URL.revokeObjectURL(file.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const currentStepIdx = STEPS.indexOf(currentStep);
  const hasInput = input.trim().length > 0 || attachedFiles.length > 0;

  return (
    <div ref={containerRef} className="content-fade-in flex h-full overflow-hidden">
      {/* Left: Chat */}
      <div className="flex flex-col min-w-0 h-full overflow-hidden" style={{ width: `${chatWidthPercent}%` }}>
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
          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}

          {/* Inline structured step card (step 2+) */}
          {goalSubmitted && inlineStepIdx !== null && !loading && !blueprint && (
            <div className="flex justify-start">
              <div className="max-w-[90%]">
                <StepCard
                  key={STEP_CONFIGS[inlineStepIdx].key}
                  stepIndex={inlineStepIdx + 2}
                  totalSteps={7}
                  config={STEP_CONFIGS[inlineStepIdx]}
                  onSubmit={(answers, customText) => handleStepSubmit(inlineStepIdx, answers, customText)}
                  onBack={inlineStepIdx > 0 ? () => setInlineStepIdx(inlineStepIdx - 1) : undefined}
                  onSkip={handleSkipAndGenerate}
                  loading={loading}
                  isLast={inlineStepIdx === STEP_CONFIGS.length - 1}
                />
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer - Chat Input */}
        <div className="shrink-0 px-4 py-3">
          {blueprint ? (
            <Button onClick={handleCreateCampaign} disabled={creating} className="w-full">
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Create Campaign & Generate Plan
            </Button>
          ) : (
            <div className="rounded-2xl border border-border bg-muted/40 shadow-sm">
              {/* Attachment previews */}
              {attachedFiles.length > 0 && (
                <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto">
                  {attachedFiles.map((att, i) => (
                    <div key={i} className="relative shrink-0 group">
                      {att.type === "image" && att.preview ? (
                        <img src={att.preview} alt={att.file.name} className="h-16 w-16 rounded-lg object-cover border border-border" />
                      ) : (
                        <div className="h-16 w-16 rounded-lg border border-border bg-background flex flex-col items-center justify-center gap-1">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[8px] text-muted-foreground truncate max-w-[56px]">{att.file.name}</span>
                        </div>
                      )}
                      <button
                        onClick={() => removeAttachment(i)}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Textarea */}
              <div className="px-4 pt-3 pb-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(input);
                    }
                  }}
                  placeholder="Ask about your campaign..."
                  rows={1}
                  style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
                  className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none overflow-y-auto"
                  disabled={loading}
                />
              </div>

              {/* Bottom bar: plus, voice, send */}
              <div className="flex items-center justify-between px-3 pb-2">
                {/* Left: Plus button */}
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  {showAttachMenu && (
                    <div className="absolute bottom-full left-0 mb-2 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[160px] z-50">
                      <button
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent w-full text-left"
                      >
                        <ImageIcon className="h-4 w-4 text-muted-foreground" /> Image
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-accent w-full text-left"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" /> Document
                      </button>
                    </div>
                  )}
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "image")}
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.md,.csv"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, "document")}
                  />
                </div>

                {/* Right: Voice + Send */}
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                    onClick={() => toast.info("Voice input coming soon!")}
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <button
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center transition-colors",
                      hasInput
                        ? "bg-foreground text-background"
                        : "bg-muted-foreground/20 text-muted-foreground cursor-not-allowed"
                    )}
                    onClick={() => sendMessage(input)}
                    disabled={loading || !hasInput}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resizable divider */}
      <div
        onMouseDown={handleMouseDown}
        className="shrink-0 w-1.5 cursor-col-resize bg-border hover:bg-primary/30 transition-colors relative group flex items-center justify-center"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Right: Blueprint Preview */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <BlueprintPanel blueprint={blueprint} />
      </div>
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
  <div className="h-full overflow-y-auto bg-card/30 px-5 py-6 space-y-5">
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
