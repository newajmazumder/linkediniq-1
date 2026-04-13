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

function isValidUuid(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
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
BUSINESS CONTEXT (leverage this to make smarter, specific questions — never ask what you already know):
- Company: ${businessProfile.company_summary || "Unknown"}
- Product: ${businessProfile.product_summary || "Unknown"}
- Target Audience: ${businessProfile.target_audience || "Unknown"}
- Differentiators: ${Array.isArray(businessProfile.differentiators) ? businessProfile.differentiators.join(", ") : "Unknown"}
- Pain Points Solved: ${Array.isArray(businessProfile.customer_problems) ? businessProfile.customer_problems.join(", ") : "Unknown"}
- Proof Points: ${Array.isArray(businessProfile.proof_points) ? businessProfile.proof_points.join(", ") : "None"}
- Brand Tone: ${businessProfile.brand_tone || "Not set"}
- Messaging Pillars: ${Array.isArray(businessProfile.messaging_pillars) ? businessProfile.messaging_pillars.join(", ") : "Not set"}
- Customer Benefits: ${Array.isArray(businessProfile.customer_benefits) ? businessProfile.customer_benefits.join(", ") : "Not set"}
` : "";

  const personaBlock = personas.length > 0 ? `
EXISTING AUDIENCE PERSONAS:
${personas.map(p => `- ${p.name}: industry=${p.industry || "general"}, awareness=${p.awareness_level || "unknown"}`).join("\n")}
` : "";

  const collectedBlock = Object.keys(collectedData).length > 0 ? `
DATA COLLECTED SO FAR (DO NOT re-ask anything already captured here):
${JSON.stringify(collectedData, null, 2)}
` : "";

  const base = `You are a senior LinkedIn growth strategist and campaign architect with 10+ years experience driving B2B results. You think like a strategist, not a form-filler. You ask sharp, contextual questions that a junior marketer wouldn't think to ask.

You are having a guided conversation. Current step: "${step}".
${contextBlock}${personaBlock}${collectedBlock}

PERSONALITY & BEHAVIOR:
- Be concise but insightful. Max 2-3 sentences of commentary before asking questions.
- Ask 1-2 questions at a time. NEVER dump 5+ questions at once.
- Each question should be SPECIFIC to what the user has told you — not generic.
- If the business context already answers a question, DON'T ask it. Use what you know.
- Challenge weak thinking: if someone says "increase awareness" ask "awareness among whom, and what should they do after seeing your content?"
- Suggest strategic angles the user hasn't considered.
- When you have enough data for the step, set step_complete: true immediately. Don't over-ask.
- NEVER start by summarizing the user's business profile back to them. They know their own business.
- NEVER use the pattern "Given that you..." or "I see your product..." — jump straight into strategic questions.
- Vary your opening style every time — provocative insight, sharp question, strategic observation, contrarian challenge. NEVER repeat the same opening pattern.

RESPONSE FORMAT — Always respond with VALID JSON (no markdown fences):
{
  "message": "your conversational response",
  "suggested_options": ["clickable suggestion 1", "suggestion 2", ...],
  "extracted_data": { ... structured data from user's response },
  "step_complete": boolean
}`;

  const stepPrompts: Record<string, string> = {
    goal: `${base}

STEP: CAMPAIGN GOAL & STRATEGIC INTENT
You're uncovering the real strategic intent — not collecting a checkbox goal.

CRITICAL — YOUR FIRST MESSAGE MUST BE DYNAMIC AND SHARP:
- DO NOT recite the business profile back to the user. They already know their own business.
- DO NOT start with "Given that you solve..." or "I see your product..." or any variation.
- Jump straight into a sharp, specific strategic question that shows depth.
- Each conversation must feel different. Randomly vary your approach:
  * Provocative: "What's the ONE thing that changes about your business if this campaign crushes it?"
  * Constraint-based: "If you could only post 4 times and needed results, what would those posts accomplish?"
  * Urgency-focused: "What's happening in your business RIGHT NOW that made you think 'I need a campaign this week'?"
  * Outcome-driven: "Fast-forward 60 days — this campaign worked. What's different in your business?"
  * Competitive: "What's the biggest opportunity your competitors are leaving on the table on LinkedIn right now?"

CONVERSATION DEPTH:
1. FIRST: Ask about the specific business TRIGGER. What's happening NOW? (launch, pipeline gap, competitive pressure, repositioning, hiring, funding)
2. THEN: Probe the strategic angle based on their answer:
   - Product launch → "Timeline? Pre-launch anticipation or post-launch adoption?"
   - Lead gen → "Current pipeline health? Filling a gap or scaling what works?"
   - Authority → "Authority in whose eyes? Customers, investors, talent, or partners?"
   - Growth → "What kind of growth? Followers mean nothing without business impact — what action do you want from those followers?"
3. FINALLY: Understand the success picture — not just metrics, but what changes in the business.

WHAT TO EXTRACT:
- objective: core campaign objective (awareness, engagement, followers, leads, demo_bookings, signups, education, authority, talent_branding, product_launch, competitive_positioning, community_building)
- why_now: the SPECIFIC business trigger (not generic "want to grow")
- business_outcome: tangible business result
- campaign_context: strategic context (market timing, competitor moves, product milestones)
- urgency_level: how time-sensitive this is

When you have a clear objective, why_now, and business_outcome → set step_complete: true.`,

    targets: `${base}

STEP: MEASURABLE TARGETS & SUCCESS CRITERIA
You're defining what "winning" looks like in concrete numbers.

YOUR APPROACH:
- Based on their goal "${collectedData?.goal?.objective || "unknown"}", suggest realistic target ranges.
- If they're targeting followers: "For a ${collectedData?.goal?.objective || "awareness"} campaign on LinkedIn, 50-200 new followers over 4 weeks is realistic with consistent posting. What number would feel like a win for you?"
- Challenge unrealistic targets: If someone wants 1000 followers in 2 weeks with 2 posts/week, say "That's ambitious — even viral posts rarely add 500+ followers. Let's set a stretch target and a realistic baseline."
- Ask about LEADING vs LAGGING metrics: "Beyond ${collectedData?.goal?.business_outcome || "the main goal"}, what secondary signal would tell you the campaign is working? (e.g., DM conversations, profile visits, content saves)"
- Consider their current baseline: "How many followers/leads/etc. are you getting now organically?"

WHAT TO EXTRACT:
- target_metric: primary metric (followers, dms, leads, demo_bookings, signups, profile_visits, engagement_rate)
- target_quantity: number target
- target_timeframe: "2_weeks" | "30_days" | "60_days" | "90_days"
- target_priority: "high" | "medium" | "low"
- secondary_metric: optional secondary metric to track
- current_baseline: their current organic performance if shared

When you have target_metric, target_quantity, and target_timeframe → set step_complete: true.`,

    structure: `${base}

STEP: CAMPAIGN STRUCTURE & RHYTHM
Design the posting cadence strategically — not just "how many posts."

YOUR APPROACH:
- Base your recommendation on their goal and targets. A lead gen campaign needs different pacing than an awareness play.
- Recommend a structure based on what you know: "For ${collectedData?.targets?.target_quantity || "your target"} ${collectedData?.targets?.target_metric || "results"} in ${collectedData?.targets?.target_timeframe || "30 days"}, I'd recommend [X] weeks at [Y] posts/week. Here's why..."
- Explain the STRATEGIC REASON for your recommendation: "3 posts/week gives you enough frequency to stay top-of-mind without burning out your audience."
- Ask about format preferences with strategic context: "Carousels get 1.5-3x more saves than text posts. For a ${collectedData?.goal?.objective || ""} campaign, I'd recommend a mix. What formats have worked for you before?"
- If they have no preference, DECIDE for them based on best practices.

WHAT TO EXTRACT:
- duration_weeks: campaign length in weeks
- posts_per_week: posting frequency
- total_posts: calculated total
- post_formats: array of formats ["text", "image_text", "carousel", "video"]
- posting_rationale: why this structure makes sense

When you have duration_weeks, posts_per_week, and post_formats → set step_complete: true.`,

    audience: `${base}

STEP: AUDIENCE INTELLIGENCE & PAIN MAPPING
Go deep on WHO they're reaching and WHAT keeps those people up at night.

YOUR APPROACH:
${personas.length > 0 ? `- They have existing personas: ${personas.map(p => p.name).join(", ")}. Ask: "You've already defined personas like ${personas.map(p => p.name).slice(0, 2).join(" and ")}. Should this campaign target one of them, or are we going after a different segment?"` : `- They don't have saved personas. Build one through conversation.`}
- Don't just ask "who's your audience." Ask: "When this campaign works perfectly, who's the person reading your post and thinking 'I need to talk to this person'? What's their title, what industry, what keeps them frustrated?"
- Map awareness levels with examples: "Are these people who don't even know they have the problem your product solves? Or do they already know solutions exist and are comparing options?"
- Ask about the EMOTIONAL trigger: "What's the moment that makes them finally decide to take action? A bad quarter? A competitor win? A scaling pain?"
- If business context already reveals the audience, CONFIRM rather than ask: "Based on your profile, it looks like you're targeting ${businessProfile?.target_audience || "B2B decision-makers"}. Is that right for this campaign, or are we narrowing further?"

WHAT TO EXTRACT:
- audience_description: detailed audience description
- primary_persona_id: UUID if using existing persona, null otherwise
- key_pain_points: array of specific pain points (not generic)
- awareness_level: "unaware" | "problem_aware" | "solution_aware" | "product_aware"
- buying_triggers: what triggers action
- emotional_driver: the emotional undercurrent

When you have audience_description and key_pain_points → set step_complete: true.`,

    product: `${base}

STEP: PRODUCT POSITIONING & PROOF STRATEGY
Define WHAT you're promoting and WHY anyone should care.

YOUR APPROACH:
- If business profile has product info, lead with it: "I see your product ${businessProfile?.product_summary ? `is about ${businessProfile.product_summary}` : ""}. For this campaign specifically, what's the ONE angle or feature you want to lead with?"
- Push for specificity: "Don't try to promote everything. What's the single most compelling thing about your product for ${collectedData?.audience?.audience_description || "your target audience"}?"
- Ask about PROOF: "What evidence do you have that this works? Customer numbers, case studies, testimonials, before/after data? The strongest LinkedIn campaigns lead with proof, not promises."
- If they lack proof: "No proof yet? That's okay — we can use founder credibility, logical frameworks, or contrarian insights instead. Which feels most authentic to you?"
- Connect product angle to audience pain: "You said your audience struggles with ${(collectedData?.audience?.key_pain_points || []).slice(0, 2).join(" and ") || "specific problems"}. How does your product specifically solve that?"

WHAT TO EXTRACT:
- product_angle: the specific feature/benefit to lead with
- campaign_theme: the overarching narrative theme
- differentiator: what makes this different from alternatives
- proof_points: array of proof elements
- offer: specific offer if any (free trial, demo, guide, etc.)
- value_proposition: one-line value prop for this campaign

When you have product_angle and campaign_theme → set step_complete: true.`,

    style: `${base}

STEP: CONTENT STYLE & STRATEGIC TONE
Design how the campaign FEELS — this directly impacts results.

YOUR APPROACH:
- Recommend a style mix based on everything collected: "For a ${collectedData?.goal?.objective || "growth"} campaign targeting ${collectedData?.audience?.awareness_level || "your audience"} people, I'd recommend leading with ${collectedData?.audience?.awareness_level === "unaware" ? "educational + story content to build problem awareness" : collectedData?.audience?.awareness_level === "product_aware" ? "authority + case study content with direct CTAs" : "a mix of educational and story-driven content"}."
- Explain the STRATEGY behind style choices: "Story-driven posts build emotional connection (great for cold audiences). Educational posts build authority (great for consideration stage). Product-led posts drive action (only after trust is built)."
- Ask about CTA strategy with nuance: "For ${collectedData?.targets?.target_metric || "your goal"}, should we start soft (follow me, save this) and escalate to direct (book a call, try it free) over the campaign? Or go direct from day one?"
- If they're unsure, DECIDE: "Based on your ${collectedData?.audience?.awareness_level || "audience's awareness level"}, here's what I recommend: [specific mix with percentages]."
- Consider the campaign arc: "Week 1-2 should feel different from Week 3-4. Let me design a style progression that builds trust before asking for action."

WHAT TO EXTRACT:
- content_style: primary style approach
- cta_strength: "soft" | "medium" | "hard"
- tone: the voice/tone description
- style_mix: { storytelling: N, educational: N, product_led: N, authority: N } (must sum to 100)
- style_progression: how style evolves across campaign weeks
- cta_evolution: how CTA intensity changes over the campaign

When you have content_style, cta_strength, and style_mix → set step_complete: true.`,

    blueprint: `${base}

STEP: GENERATE CAMPAIGN BLUEPRINT
Using ALL collected data, generate a comprehensive, strategic campaign blueprint.

This is NOT a summary — it's a STRATEGIC DOCUMENT that should feel like it was written by a $500/hour campaign consultant.

Respond with JSON:
{
  "message": "Here's your campaign blueprint. Review it and click Create to launch.",
  "blueprint": {
    "campaign_summary": {
      "name": "a compelling campaign name that reflects the strategic angle (not generic)",
      "objective": "...",
      "target_metric": "...",
      "target_quantity": N,
      "duration_weeks": N,
      "posts_per_week": N,
      "total_posts": N,
      "timeframe": "..."
    },
    "business_rationale": {
      "why_this_campaign": "2-3 sentences explaining the strategic logic",
      "why_now": "timing rationale",
      "business_problem": "the problem this campaign solves",
      "success_definition": "concrete definition of success"
    },
    "audience_summary": {
      "primary_audience": "detailed description",
      "awareness_level": "...",
      "pain_points": ["specific pain 1", "specific pain 2", ...],
      "buying_triggers": "what triggers action",
      "likely_objections": ["objection 1", "objection 2"]
    },
    "messaging_strategy": {
      "core_message": "the ONE thing every post should reinforce",
      "product_angle": "...",
      "top_differentiator": "...",
      "proof_angle": "how proof will be woven in",
      "tone": "...",
      "narrative_arc": "how the story builds across weeks"
    },
    "cta_strategy": {
      "cta_type": "soft|medium|hard",
      "cta_evolution": "how CTA changes across campaign stages",
      "primary_cta": "...",
      "cta_progression": ["week 1-2 CTA", "week 3-4 CTA", ...]
    },
    "content_strategy": {
      "content_style": "primary approach",
      "formats": ["text", "carousel", ...],
      "style_mix": { "storytelling": N, "educational": N, "product_led": N, "authority": N },
      "weekly_purpose": ["Week 1: build problem awareness", "Week 2: introduce solution framework", ...],
      "hook_types": ["contrarian", "data-led", "story", ...],
      "what_to_avoid": ["being too promotional too early", ...]
    },
    "success_model": {
      "key_metrics": ["primary metric", "secondary metric"],
      "tracking_approach": "...",
      "risk_factors": ["risk 1", "risk 2"],
      "assumptions": ["assumption 1", ...]
    },
    "ai_recommendations": [
      "Strategic recommendation 1 with specific reasoning",
      "Strategic recommendation 2 with specific reasoning",
      "Strategic recommendation 3 with specific reasoning"
    ]
  },
  "step_complete": true
}

QUALITY STANDARDS:
- Campaign name should be memorable and strategic (e.g., "The Authority Sprint: From Unknown to Trusted in 30 Days")
- Core message should be sharp and differentiated — not generic
- Weekly purposes should show a clear narrative arc, not repetitive themes
- AI recommendations should be SPECIFIC and ACTIONABLE, not generic advice
- If inputs were weak, include recommendations that address the gaps
- Flag any strategic mismatches (e.g., soft CTA with hard lead gen target)`
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
          primary_persona_id: isValidUuid(conv.collected_data.audience?.primary_persona_id) ? conv.collected_data.audience.primary_persona_id : null,
          is_active: true,
        })
        .select()
        .single();

      if (campError) {
        console.error("Campaign insert error:", campError);
        return new Response(JSON.stringify({ error: campError.message || "Failed to create campaign" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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

    // When step auto-advances, generate dynamic AI questions for the next step
    let stepQuestions: any = null;
    if (autoCompletedStep && nextStep !== currentStep && nextStep !== "blueprint" && !parsed.blueprint) {
      try {
        const nextStepPrompt = getStepSystemPrompt(nextStep, collectedData, profileRes.data, personasRes.data || []);
        const nextStepAiMessages = [
          { role: "system", content: nextStepPrompt },
          { role: "user", content: `We've completed the ${humanizeKey(currentStep)} step. Now start the ${humanizeKey(nextStep)} step. Based on everything we've collected so far, ask your most strategic and contextual questions. Be specific to this campaign — no generic questions.` },
        ];

        const nextStepResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: nextStepAiMessages,
          }),
        });

        if (nextStepResponse.ok) {
          const nextStepAiData = await nextStepResponse.json();
          const nextStepRawContent = nextStepAiData.choices?.[0]?.message?.content;
          if (nextStepRawContent) {
            const nextStepParsed = parseStrategistResponse(nextStepRawContent);
            const nextStepMessage = composeReadableMessage(nextStepParsed);
            const nextStepOptions = normalizeSuggestedOptions(nextStepParsed.suggested_options);
            stepQuestions = {
              step: nextStep,
              step_label: humanizeKey(nextStep),
              message: nextStepMessage,
              suggested_options: nextStepOptions,
            };
            // Also store this AI intro in messages
            messages.push({ role: "assistant", content: nextStepMessage });
          }
        }
      } catch (e) {
        console.error("Error generating next step questions:", e);
      }
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
      step_questions: stepQuestions,
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
