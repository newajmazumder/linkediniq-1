import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEPS = ["goal", "targets", "structure", "audience", "product", "style", "blueprint"] as const;
type StepName = typeof STEPS[number];

const STEP_REQUIREMENTS: Record<Exclude<StepName, "blueprint">, string[]> = {
  goal: ["objective", "business_outcome"],
  targets: ["target_metric", "target_quantity", "target_timeframe"],
  structure: ["duration_weeks", "posts_per_week", "post_formats"],
  audience: ["audience_description", "key_pain_points"],
  product: ["product_angle", "campaign_theme"],
  style: ["content_style", "cta_strength"],
};

const STEP_ALIASES: Record<StepName, string[]> = {
  goal: ["goal", "business goal", "objective"],
  targets: ["targets", "measurable targets", "metrics"],
  structure: ["structure", "campaign structure"],
  audience: ["audience", "audience & pain", "audience and pain", "pain"],
  product: ["product", "offer", "product & offer", "message"],
  style: ["style", "campaign style", "tone"],
  blueprint: ["blueprint", "plan"],
};

const RESPONSE_KEYS = ["message", "suggested_options", "extracted_data", "blueprint", "step_complete", "questions", "plan_calculation", "context_check"];

function stripCodeFences(text: string): string {
  return text.startsWith("```")
    ? text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
    : text;
}

function repairJson(text: string): string {
  let repaired = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
  let braces = 0;
  let brackets = 0;

  for (const char of repaired) {
    if (char === "{") braces++;
    if (char === "}") braces--;
    if (char === "[") brackets++;
    if (char === "]") brackets--;
  }

  while (brackets > 0) {
    repaired += "]";
    brackets--;
  }

  while (braces > 0) {
    repaired += "}";
    braces--;
  }

  return repaired;
}

function tryParseJson(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(repairJson(text));
    } catch {
      return null;
    }
  }
}

function extractLeadingJsonBlock(text: string): { jsonBlock: string; remainder: string } | null {
  const trimmed = text.trimStart();
  const firstChar = trimmed[0];

  if (firstChar !== "{" && firstChar !== "[") return null;

  const stack: string[] = [];
  const pairs: Record<string, string> = { "{": "}", "[": "]" };
  let inString = false;
  let escaped = false;

  for (let index = 0; index < trimmed.length; index++) {
    const char = trimmed[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (pairs[char]) {
      stack.push(pairs[char]);
      continue;
    }

    if (char === stack[stack.length - 1]) {
      stack.pop();
      if (stack.length === 0) {
        return {
          jsonBlock: trimmed.slice(0, index + 1),
          remainder: trimmed.slice(index + 1).trim(),
        };
      }
    }
  }

  return null;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function safeStr(val: any): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.map(safeStr).filter(Boolean).join(", ");
  if (typeof val === "object") {
    for (const key of ["text", "question", "label", "title", "name", "value"]) {
      if (key in val) {
        const resolved = safeStr(val[key]);
        if (resolved) return resolved;
      }
    }

    return Object.entries(val)
      .map(([key, value]) => `${humanizeKey(key)}: ${safeStr(value)}`)
      .filter(Boolean)
      .join(", ");
  }

  return String(val);
}

function valueToMarkdown(value: any, depth = 0): string {
  const indent = "  ".repeat(depth);

  if (value === null || value === undefined || value === "") return "";

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return `${indent}${safeStr(value)}`;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item === null || item === undefined || item === "") return null;

        if (typeof item === "object") {
          const nested = valueToMarkdown(item, depth + 1);
          return nested ? `${indent}-\n${nested}` : null;
        }

        return `${indent}- ${safeStr(item)}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  return Object.entries(value)
    .map(([key, item]) => {
      if (item === null || item === undefined || item === "") return null;
      if (Array.isArray(item) && item.length === 0) return null;

      if (typeof item === "object") {
        const nested = valueToMarkdown(item, depth + 1);
        return nested ? `${indent}- **${humanizeKey(key)}:**\n${nested}` : `${indent}- **${humanizeKey(key)}:**`;
      }

      return `${indent}- **${humanizeKey(key)}:** ${safeStr(item)}`;
    })
    .filter(Boolean)
    .join("\n");
}

function formatSection(title: string, value: any): string {
  const body = valueToMarkdown(value).trim();
  return body ? `**${title}**\n${body}` : "";
}

function hasMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === "object") return Object.values(value).some(hasMeaningfulValue);
  return false;
}

function normalizeStepData(step: StepName, data: any): any {
  const normalized = { ...(data || {}) };

  if (step === "structure") {
    const durationWeeks = Number(normalized.duration_weeks);
    const postsPerWeek = Number(normalized.posts_per_week);

    if (Number.isFinite(durationWeeks) && durationWeeks > 0) normalized.duration_weeks = durationWeeks;
    if (Number.isFinite(postsPerWeek) && postsPerWeek > 0) normalized.posts_per_week = postsPerWeek;

    if (!hasMeaningfulValue(normalized.total_posts) && normalized.duration_weeks && normalized.posts_per_week) {
      normalized.total_posts = normalized.duration_weeks * normalized.posts_per_week;
    }

    if (typeof normalized.post_formats === "string") {
      normalized.post_formats = normalized.post_formats
        .split(",")
        .map((item: string) => item.trim())
        .filter(Boolean);
    }
  }

  return normalized;
}

function isStepDataComplete(step: StepName, data: any): boolean {
  if (step === "blueprint") return hasMeaningfulValue(data);

  const normalized = normalizeStepData(step, data);
  const requiredKeys = STEP_REQUIREMENTS[step];

  if (!requiredKeys.every((key) => hasMeaningfulValue(normalized?.[key]))) {
    return false;
  }

  if (step === "structure") {
    return Number(normalized.duration_weeks) > 0
      && Number(normalized.posts_per_week) > 0
      && Number(normalized.total_posts) > 0
      && Array.isArray(normalized.post_formats)
      && normalized.post_formats.length > 0;
  }

  if (step === "audience") {
    return hasMeaningfulValue(normalized.audience_description)
      && Array.isArray(normalized.key_pain_points)
      && normalized.key_pain_points.length > 0;
  }

  if (step === "style") {
    return hasMeaningfulValue(normalized.style_mix) || hasMeaningfulValue(normalized.tone);
  }

  return true;
}

function getNextStep(step: StepName): StepName | null {
  const currentIdx = STEPS.indexOf(step);
  return currentIdx >= 0 && currentIdx < STEPS.length - 1 ? STEPS[currentIdx + 1] : null;
}

function detectRequestedStep(message: string | null | undefined): StepName | null {
  const normalizedMessage = message?.toLowerCase().trim();
  if (!normalizedMessage) return null;

  for (const step of STEPS) {
    if (STEP_ALIASES[step].some((alias) => normalizedMessage.includes(alias))) {
      return step;
    }
  }

  return null;
}

function isAdvanceIntent(message: string | null | undefined): boolean {
  const normalizedMessage = message?.toLowerCase().trim();
  if (!normalizedMessage) return false;

  return [
    "move to next",
    "next section",
    "next step",
    "continue",
    "move on",
    "go next",
    "proceed",
  ].some((phrase) => normalizedMessage.includes(phrase));
}

function getStepIntroMessage(step: StepName, personas: any[]): string {
  switch (step) {
    case "targets":
      return "**Next: Measurable Targets**\n1. What result would make this campaign a clear win?\n2. What number are you targeting, and over what timeframe?";
    case "structure":
      return "**Next: Campaign Structure**\n1. How many weeks should this run?\n2. How many posts per week do you want?\n3. Which formats should we use: text, image + text, carousel, or a mix?";
    case "audience": {
      const personaNames = personas.map((persona: any) => persona.name).filter(Boolean);
      const personaLine = personaNames.length > 0
        ? `You already have personas like ${personaNames.slice(0, 3).join(", ")}. Want to use one of them or define a new audience?`
        : "1. Who exactly are you trying to reach?";
      return `**Next: Audience & Pain**\n${personaLine}\n2. What pain are they dealing with right now?\n3. What would make them take action?`;
    }
    case "product":
      return "**Next: Product & Offer**\n1. Which product, feature, or offer is this campaign about?\n2. What makes it valuable, and what proof do you have?";
    case "style":
      return "**Next: Campaign Style**\n1. Should this feel educational, story-driven, authority-led, or promotional?\n2. Should the CTA stay soft, medium, or direct?";
    case "blueprint":
      return "**Next: Blueprint**\nI have enough to generate the campaign blueprint.";
    default:
      return "";
  }
}

function getStepSuggestedOptions(step: StepName, personas: any[]): string[] {
  switch (step) {
    case "targets":
      return ["100 leads in 30 days", "500 signups this month", "200 demo bookings this quarter"];
    case "structure":
      return ["4 weeks / 3 posts per week / mixed formats", "6 weeks / 2 posts per week / carousel-heavy", "8 weeks / 1 post per week / text-only"];
    case "audience": {
      const personaOptions = personas.map((persona: any) => persona.name).filter(Boolean).slice(0, 3);
      return personaOptions.length > 0
        ? [...personaOptions, "Define a new audience"]
        : ["Ecommerce founders", "Marketing managers", "Support team leads"];
    }
    case "product":
      return ["Highlight one flagship feature", "Promote a free trial", "Focus on proof and differentiators"];
    case "style":
      return ["Educational + soft CTA", "Authority-led + medium CTA", "Story-driven + direct CTA"];
    default:
      return [];
  }
}

function parseStrategistResponse(rawContent: string): any {
  const cleaned = stripCodeFences(rawContent.trim()).trim();
  const directParse = tryParseJson(cleaned);

  if (directParse !== null) return directParse;

  const leadingJson = extractLeadingJsonBlock(cleaned);
  if (!leadingJson) return { message: cleaned, step_complete: false };

  const parsedBlock = tryParseJson(leadingJson.jsonBlock);
  if (parsedBlock === null) return { message: cleaned, step_complete: false };

  const isResponseEnvelope = typeof parsedBlock === "object" && parsedBlock !== null && RESPONSE_KEYS.some((key) => key in parsedBlock);

  if (isResponseEnvelope) {
    const mergedMessage = [safeStr(parsedBlock.message), leadingJson.remainder].filter(Boolean).join("\n\n").trim();
    return {
      ...parsedBlock,
      message: mergedMessage || "I captured the important details and organized them below.",
    };
  }

  return {
    message: leadingJson.remainder || "I organized the details below.",
    inline_structured_data: parsedBlock,
    step_complete: false,
  };
}

function normalizeSuggestedOptions(options: any): string[] {
  if (!Array.isArray(options)) return [];

  return options
    .map((option) => safeStr(option))
    .filter(Boolean);
}

function composeReadableMessage(payload: any): string {
  if (!payload) return "I'm processing your request...";
  if (typeof payload === "string") return payload;

  const parts: string[] = [];
  let inlineStructuredData = payload.inline_structured_data ?? null;
  let primaryMessage = safeStr(payload.message);

  const leadingJsonInMessage = typeof primaryMessage === "string" ? extractLeadingJsonBlock(primaryMessage) : null;
  if (leadingJsonInMessage) {
    const parsedLeadingBlock = tryParseJson(leadingJsonInMessage.jsonBlock);
    if (parsedLeadingBlock !== null) {
      inlineStructuredData = inlineStructuredData ?? parsedLeadingBlock;
      primaryMessage = leadingJsonInMessage.remainder || "";
    }
  }

  if (primaryMessage) parts.push(primaryMessage);
  if (payload.context_check) parts.push(`> **Strategic note:** ${safeStr(payload.context_check)}`);
  if (inlineStructuredData && typeof inlineStructuredData === "object") parts.push(formatSection("Captured details", inlineStructuredData));
  if (payload.plan_calculation && typeof payload.plan_calculation === "object") parts.push(formatSection("Plan snapshot", payload.plan_calculation));
  if (payload.extracted_data && typeof payload.extracted_data === "object") parts.push(formatSection("What I captured", payload.extracted_data));

  if (Array.isArray(payload.questions) && payload.questions.length > 0) {
    const formattedQuestions = payload.questions
      .map((question: any, index: number) => `${index + 1}. ${safeStr(question)}`)
      .join("\n");
    parts.push(`**Next questions**\n${formattedQuestions}`);
  }

  if (Array.isArray(payload.recommendations) && payload.recommendations.length > 0) {
    const formattedRecommendations = payload.recommendations
      .map((recommendation: any) => `- ${safeStr(recommendation)}`)
      .join("\n");
    parts.push(`**Recommendations**\n${formattedRecommendations}`);
  }

  const readable = parts.filter(Boolean).join("\n\n").trim();
  return readable || "I'm ready to continue. What would you like to share next?";
}

function getStepSystemPrompt(step: string, collectedData: any, businessProfile: any, personas: any[]): string {
  const contextBlock = businessProfile ? `
BUSINESS CONTEXT (use to ask smarter questions):
- Company: ${businessProfile.company_summary || "Not set"}
- Product: ${businessProfile.product_summary || "Not set"}
- Target Audience: ${businessProfile.target_audience || "Not set"}
- Differentiators: ${Array.isArray(businessProfile.differentiators) ? businessProfile.differentiators.join(", ") : "Not set"}
- Pain Points Solved: ${Array.isArray(businessProfile.customer_problems) ? businessProfile.customer_problems.join(", ") : "Not set"}
` : "";

  const personaBlock = personas.length > 0 ? `
EXISTING PERSONAS: ${personas.map(p => `${p.name} (${p.industry || "general"}, ${p.awareness_level || "unaware"})`).join("; ")}
` : "";

  const collectedBlock = Object.keys(collectedData).length > 0 ? `
ALREADY COLLECTED FROM USER:
${JSON.stringify(collectedData, null, 2)}
` : "";

  const base = `You are a senior LinkedIn campaign strategist helping a user build a structured, outcome-driven campaign.

You are having a guided conversation. You are on step: "${step}".
${contextBlock}${personaBlock}${collectedBlock}

CRITICAL RULES:
- Ask 1-2 focused questions per step. Never ask more than 2.
- Challenge weak or vague inputs. If the user says something unrealistic, push back gently.
- Use the business context to ask smarter, more specific questions.
- If enough information is already available for the current step, do NOT ask more questions. Set step_complete to true.
- Always respond with VALID JSON (no markdown fences).`;

  const stepPrompts: Record<string, string> = {
    goal: `${base}

STEP: UNDERSTAND THE BUSINESS GOAL
Ask the user:
1. What they're trying to achieve with this campaign
2. Why they're running it now
3. What business outcome matters most

Normalize their answer into objective types: awareness, engagement, followers, profile_visits, dms, leads, demo_bookings, signups, education, authority.

Respond with JSON:
{
  "message": "your conversational response with questions",
  "suggested_options": ["option1", "option2", ...],
  "extracted_data": { ... any structured data you can extract from user's message },
  "step_complete": false
}

When the user has answered sufficiently, set step_complete to true and include extracted_data with: { "objective": "...", "why_now": "...", "business_outcome": "..." }`,

    targets: `${base}

STEP: DEFINE MEASURABLE TARGETS
Ask:
1. What result would make this campaign successful?
2. How many (followers/DMs/leads/bookings) are they targeting?
3. Over what time period?

If targets seem unrealistic (e.g. 1000 followers in 1 week with 2 posts), challenge them politely.

Respond with JSON:
{
  "message": "your response",
  "suggested_options": [...],
  "extracted_data": { ... },
  "step_complete": false
}

When complete, extracted_data should have: { "target_metric": "...", "target_quantity": N, "target_timeframe": "weekly|monthly|campaign_duration", "target_priority": "high|medium|low" }`,

    structure: `${base}

STEP: DEFINE CAMPAIGN STRUCTURE
Only capture structure in this step. Do NOT ask about audience, pain points, messaging, product, offer, or CTA here.

Ask only for the missing structure inputs:
1. How long should the campaign run? (2, 4, 6, 8 weeks)
2. How many posts per week? (1, 2, 3)
3. Post format preference: text only, image+text, carousel, or mix?

Calculate and confirm: total weeks, posts per week, total post count, format distribution.

If duration_weeks, posts_per_week, and at least one post_format are known, calculate total_posts and set step_complete to true immediately.

When complete, extracted_data: { "duration_weeks": N, "posts_per_week": N, "total_posts": N, "post_formats": ["text", "image_text", "carousel"] }`,

    audience: `${base}

STEP: UNDERSTAND AUDIENCE AND PAIN
If existing personas are available, ask if they want to use one of those.
Otherwise ask:
1. Who are you trying to reach?
2. What do they care about most?
3. What problem are they facing right now?
4. What would make them take action?

Map to: primary persona, pain points, buying triggers, awareness level.

When complete, extracted_data: { "primary_persona_id": "uuid or null", "audience_description": "...", "key_pain_points": [...], "awareness_level": "unaware|problem-aware|solution-aware|product-aware", "buying_triggers": "..." }`,

    product: `${base}

STEP: UNDERSTAND PRODUCT / OFFER / MESSAGE
Use the business context to pre-fill what you already know. Ask:
1. What specific product/feature/offer is this campaign about?
2. What makes it valuable? What's the strongest outcome?
3. What proof or differentiator do you have?
4. Is there a specific offer (free trial, discount, etc.)?

When complete, extracted_data: { "product_angle": "...", "campaign_theme": "...", "differentiator": "...", "proof_points": [...], "offer": "...", "cta_possibilities": [...] }`,

    style: `${base}

STEP: CLARIFY CAMPAIGN STYLE
Ask:
1. Should this campaign feel educational, story-driven, promotional, contrarian, or authority-led?
2. Should the CTA be soft (follow, comment) or direct (DM, book demo)?
3. Do you want broad awareness or direct response?

If the user is unclear, recommend a good mix based on their objective.

When complete, extracted_data: { "content_style": "...", "cta_strength": "soft|medium|hard", "tone": "...", "style_mix": { "storytelling": N, "educational": N, "product_led": N, "authority": N } }`,

    blueprint: `${base}

STEP: GENERATE CAMPAIGN BLUEPRINT
Using ALL collected data, generate a comprehensive campaign blueprint.

Respond with JSON:
{
  "message": "Here's your campaign blueprint. Review it and click Create to launch.",
  "blueprint": {
    "campaign_summary": {
      "name": "auto-generated campaign name",
      "objective": "...",
      "target_metric": "...",
      "target_quantity": N,
      "duration_weeks": N,
      "posts_per_week": N,
      "total_posts": N,
      "timeframe": "..."
    },
    "business_rationale": {
      "why_this_campaign": "...",
      "why_now": "...",
      "business_problem": "...",
      "success_definition": "..."
    },
    "audience_summary": {
      "primary_persona": "...",
      "awareness_level": "...",
      "pain_points": [...],
      "buying_triggers": "...",
      "likely_objections": [...]
    },
    "messaging_strategy": {
      "core_message": "...",
      "product_angle": "...",
      "top_differentiator": "...",
      "proof_angle": "...",
      "tone": "..."
    },
    "cta_strategy": {
      "cta_type": "soft|medium|hard",
      "cta_evolution": "how CTA changes across campaign stages",
      "primary_cta": "..."
    },
    "content_strategy": {
      "weekly_purpose": [...],
      "post_styles": [...],
      "hook_types": [...],
      "what_to_avoid": [...]
    },
    "success_model": {
      "key_metrics": [...],
      "tracking_approach": "...",
      "risk_factors": [...],
      "assumptions": [...]
    },
    "ai_recommendations": [
      "recommendation 1",
      "recommendation 2"
    ]
  },
  "step_complete": true
}

IMPORTANT: If user inputs are weak, include specific recommendations to improve the plan. For example:
- If goal is awareness but CTA is sales-heavy → suggest softer CTAs
- If audience pain is vague → suggest sharper pain framing
- If duration and target mismatch → flag it
- If product angle is too feature-led for cold audience → suggest pain-first content`
  };

  return stepPrompts[step] || stepPrompts["goal"];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversation_id, user_message, action } = await req.json();

    // Action: create_campaign from blueprint
    if (action === "create_campaign") {
      const { blueprint_data, conversation_id: convId } = await req.json().catch(() => ({ blueprint_data: null, conversation_id: null }));
      // Re-parse since we already consumed the body
      const body = { conversation_id, user_message, action };
      
      if (!conversation_id) {
        return new Response(JSON.stringify({ error: "conversation_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch conversation
      const { data: conv } = await supabase
        .from("campaign_conversations")
        .select("*")
        .eq("id", conversation_id)
        .single();

      if (!conv || !conv.collected_data?.blueprint) {
        return new Response(JSON.stringify({ error: "No blueprint found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bp = conv.collected_data.blueprint;
      const summary = bp.campaign_summary || {};
      const messaging = bp.messaging_strategy || {};
      const ctaStrat = bp.cta_strategy || {};
      const style = conv.collected_data.style || {};
      const styleMix = style.style_mix || { storytelling: 25, educational: 25, product_led: 25, authority: 25 };

      // Create campaign
      const { data: campaign, error: campError } = await supabase
        .from("campaigns")
        .insert({
          user_id: user.id,
          name: summary.name || "AI Campaign",
          goal: summary.objective || "awareness",
          primary_objective: summary.objective || "awareness",
          target_metric: summary.target_metric || null,
          target_quantity: summary.target_quantity || null,
          target_timeframe: summary.timeframe || "monthly",
          target_priority: conv.collected_data.targets?.target_priority || "medium",
          core_message: messaging.core_message || null,
          offer: conv.collected_data.product?.offer || null,
          cta_type: ctaStrat.cta_type || "soft",
          tone: messaging.tone || "friendly",
          style_storytelling: styleMix.storytelling || 25,
          style_educational: styleMix.educational || 25,
          style_product_led: styleMix.product_led || 25,
          style_authority: styleMix.authority || 25,
          primary_persona_id: conv.collected_data.audience?.primary_persona_id || null,
          is_active: true,
        })
        .select()
        .single();

      if (campError) throw campError;

      // Create blueprint record
      const { data: blueprintRecord } = await supabase
        .from("campaign_blueprints")
        .insert({
          user_id: user.id,
          campaign_id: campaign.id,
          conversation_id: conversation_id,
          campaign_summary: bp.campaign_summary || {},
          business_rationale: bp.business_rationale || {},
          audience_summary: bp.audience_summary || {},
          messaging_strategy: bp.messaging_strategy || {},
          cta_strategy: bp.cta_strategy || {},
          content_strategy: bp.content_strategy || {},
          success_model: bp.success_model || {},
          ai_recommendations: bp.ai_recommendations || [],
          status: "active",
        })
        .select()
        .single();

      // Update conversation
      await supabase
        .from("campaign_conversations")
        .update({ status: "completed" })
        .eq("id", conversation_id);

      return new Response(JSON.stringify({ campaign, blueprint: blueprintRecord }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Start new conversation or continue existing one
    let conversation: any;
    let messages: any[] = [];
    let currentStep = "goal";
    let collectedData: any = {};

    if (conversation_id) {
      const { data } = await supabase
        .from("campaign_conversations")
        .select("*")
        .eq("id", conversation_id)
        .single();
      if (data) {
        conversation = data;
        messages = Array.isArray(data.messages) ? data.messages : [];
        currentStep = data.current_step || "goal";
        collectedData = data.collected_data || {};
      }
    }

    if (!conversation) {
      const { data, error } = await supabase
        .from("campaign_conversations")
        .insert({
          user_id: user.id,
          messages: [],
          current_step: "goal",
          collected_data: {},
          status: "active",
        })
        .select()
        .single();
      if (error) throw error;
      conversation = data;
    }

    // Fetch business profile and personas for context
    const [profileRes, personasRes] = await Promise.all([
      supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("audience_personas").select("id, name, industry, awareness_level").eq("user_id", user.id),
    ]);

    let redirectedStep = false;
    let aiUserMessage = user_message;

    // Add user message if provided
    if (user_message) {
      messages.push({ role: "user", content: user_message });

      const currentStepName = currentStep as StepName;
      const nextStepName = getNextStep(currentStepName);
      const requestedStep = detectRequestedStep(user_message);
      const currentStepData = normalizeStepData(currentStepName, collectedData[currentStepName] || {});

      if (
        nextStepName
        && isStepDataComplete(currentStepName, currentStepData)
        && (requestedStep === nextStepName || (requestedStep === null && isAdvanceIntent(user_message)))
      ) {
        currentStep = nextStepName;
        redirectedStep = true;
        aiUserMessage = `Let's continue to the ${humanizeKey(nextStepName)} step. Ask only the essential questions needed for this step.`;
      }
    }

    // Build AI messages
    const systemPrompt = getStepSystemPrompt(currentStep, collectedData, profileRes.data, personasRes.data || []);
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    if (redirectedStep && aiMessages.length > 1) {
      aiMessages[aiMessages.length - 1] = { role: "user", content: aiUserMessage };
    }

    // If no user message yet (first load), add a starter
    if (!user_message && messages.length === 0) {
      aiMessages.push({ role: "user", content: "I want to create a new LinkedIn campaign. Help me plan it." });
      messages.push({ role: "user", content: "I want to create a new LinkedIn campaign. Help me plan it." });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: aiMessages,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No AI response");

    const parsed = parseStrategistResponse(rawContent);

    // Update collected data if extracted
    if (parsed.extracted_data) {
      collectedData[currentStep] = normalizeStepData(currentStep as StepName, {
        ...(collectedData[currentStep] || {}),
        ...parsed.extracted_data,
      });
    } else if (collectedData[currentStep]) {
      collectedData[currentStep] = normalizeStepData(currentStep as StepName, collectedData[currentStep]);
    }

    // Store blueprint if generated
    if (parsed.blueprint) {
      collectedData.blueprint = parsed.blueprint;
    }

    // Advance step if complete
    let nextStep = currentStep;
    let effectiveStepComplete = Boolean(parsed.step_complete);
    let autoCompletedStep = false;

    if (!effectiveStepComplete && currentStep !== "blueprint" && isStepDataComplete(currentStep as StepName, collectedData[currentStep])) {
      effectiveStepComplete = true;
      autoCompletedStep = true;
    }

    if (effectiveStepComplete) {
      const currentIdx = STEPS.indexOf(currentStep as any);
      if (currentIdx < STEPS.length - 1) {
        nextStep = STEPS[currentIdx + 1];
      }
    }

    const completionNote = autoCompletedStep && nextStep !== currentStep
      ? `Great — I have enough to lock the ${humanizeKey(currentStep)} and move to ${humanizeKey(nextStep)}.`
      : "";

    const readablePayload = completionNote
      ? {
          ...parsed,
          message: [safeStr(parsed.message), completionNote].filter(Boolean).join("\n\n"),
          questions: [],
          suggested_options: [],
        }
      : parsed;

    let readableMessage = composeReadableMessage(readablePayload);
    let normalizedSuggestedOptions = normalizeSuggestedOptions(readablePayload.suggested_options);

    if (autoCompletedStep && nextStep !== currentStep && !parsed.blueprint) {
      readableMessage = [readableMessage, getStepIntroMessage(nextStep as StepName, personasRes.data || [])]
        .filter(Boolean)
        .join("\n\n");
      normalizedSuggestedOptions = getStepSuggestedOptions(nextStep as StepName, personasRes.data || []);
    }

    // Add AI response to messages
    messages.push({ role: "assistant", content: readableMessage });

    // Save conversation state
    await supabase
      .from("campaign_conversations")
      .update({
        messages,
        current_step: nextStep,
        collected_data: collectedData,
        status: nextStep === "blueprint" && parsed.step_complete ? "ready" : "active",
      })
      .eq("id", conversation.id);

    return new Response(JSON.stringify({
      conversation_id: conversation.id,
      current_step: nextStep,
      message: readableMessage,
      suggested_options: normalizedSuggestedOptions,
      blueprint: parsed.blueprint || null,
        step_complete: effectiveStepComplete,
      collected_data: collectedData,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("campaign-strategist error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
