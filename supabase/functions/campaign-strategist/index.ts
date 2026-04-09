import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STEPS = ["goal", "targets", "structure", "audience", "product", "style", "blueprint"] as const;

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
- Ask 2-4 focused questions per step. Not more.
- Challenge weak or vague inputs. If the user says something unrealistic, push back gently.
- Use the business context to ask smarter, more specific questions.
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
Ask:
1. How long should the campaign run? (2, 4, 6, 8 weeks)
2. How many posts per week? (1, 2, 3)
3. Post format preference: text only, image+text, carousel, or mix?

Calculate and confirm: total weeks, posts per week, total post count, format distribution.

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

    // Add user message if provided
    if (user_message) {
      messages.push({ role: "user", content: user_message });
    }

    // Build AI messages
    const systemPrompt = getStepSystemPrompt(currentStep, collectedData, profileRes.data, personasRes.data || []);
    const aiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

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

    let cleanContent = rawContent.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      // If AI didn't return valid JSON, wrap it
      parsed = { message: cleanContent, step_complete: false };
    }

    // Add AI response to messages
    messages.push({ role: "assistant", content: parsed.message || cleanContent });

    // Update collected data if extracted
    if (parsed.extracted_data) {
      collectedData[currentStep] = { ...(collectedData[currentStep] || {}), ...parsed.extracted_data };
    }

    // Store blueprint if generated
    if (parsed.blueprint) {
      collectedData.blueprint = parsed.blueprint;
    }

    // Advance step if complete
    let nextStep = currentStep;
    if (parsed.step_complete) {
      const currentIdx = STEPS.indexOf(currentStep as any);
      if (currentIdx < STEPS.length - 1) {
        nextStep = STEPS[currentIdx + 1];
      }
    }

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
      message: parsed.message || cleanContent,
      suggested_options: parsed.suggested_options || [],
      blueprint: parsed.blueprint || null,
      step_complete: parsed.step_complete || false,
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
