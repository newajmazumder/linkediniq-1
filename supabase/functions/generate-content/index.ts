import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPersonaBlock(data: any): string {
  const painPoints = Array.isArray(data.pain_points) ? data.pain_points : [];
  const goals = Array.isArray(data.goals) ? data.goals : [];
  const objections = Array.isArray(data.objections) ? data.objections : [];
  return `\n\nTARGET PERSONA:
- Name: ${data.name}
- Industry: ${data.industry || "General"}
- Business Size: ${data.business_size || "Any"}
- Geography: ${data.geography || "Global"}
- Language Style: ${data.language_style || "english"}
- Awareness Level: ${data.awareness_level || "unaware"}
- Pain Points: ${painPoints.join(", ") || "Not specified"}
- Goals: ${goals.join(", ") || "Not specified"}
- Objections: ${objections.join(", ") || "Not specified"}
- Buying Triggers: ${data.buying_triggers || "Not specified"}
- Content Preference: ${data.content_preference || "educational"}

AWARENESS-LEVEL STRATEGY:
${getAwarenessStrategy(data.awareness_level || "unaware")}

IMPORTANT: Write content that speaks directly to this persona. Use their language style (${data.language_style || "english"}). Every sentence must feel like it was written FOR this person.`;
}

function getAwarenessStrategy(level: string): string {
  const strategies: Record<string, string> = {
    "unaware": `- The reader does NOT know they have a problem yet.
- Lead with a relatable scenario or story that surfaces the hidden pain.
- Do NOT mention the product. Focus purely on the situation.
- Tone: empathetic, curious, thought-provoking.
- CTA: soft (follow for more, what do you think?).`,
    "problem-aware": `- The reader KNOWS the problem but doesn't know solutions exist.
- Focus heavily on the pain. Agitate it. Make them feel understood.
- Educate about the problem's cost (time, money, stress).
- Do NOT pitch the product yet. Hint at a better way.
- Tone: empathetic, educational, relatable.
- CTA: soft to medium (DM me, comment if you relate).`,
    "solution-aware": `- The reader knows solutions exist but hasn't picked one.
- Compare approaches. Show why common solutions fall short.
- Position your approach (not product) as the smarter path.
- Use social proof, frameworks, or case-study angles.
- Tone: authoritative, educational, confident.
- CTA: medium (learn more, check the link).`,
    "product-aware": `- The reader knows YOUR product. They're evaluating.
- Lead with differentiation, features, and results.
- Address objections head-on. Show proof and specifics.
- Use bold claims backed by evidence.
- Tone: confident, direct, proof-driven.
- CTA: hard (book a demo, try free, sign up).`,
  };
  return strategies[level] || strategies["unaware"];
}

function buildCampaignBlock(data: any): string {
  return `\n\nCAMPAIGN STRATEGY:
- Campaign: ${data.name}
- Goal: ${data.goal || "awareness"}
- Core Message: ${data.core_message || "Not specified"}
- Offer: ${data.offer || "None"}
- CTA Type: ${data.cta_type || "soft"} ${data.cta_type === "soft" ? "(follow, comment)" : data.cta_type === "medium" ? "(DM, engage)" : "(book demo, signup)"}
- Tone: ${data.tone || "friendly"}
- Content Style Mix: Storytelling ${data.style_storytelling}%, Educational ${data.style_educational}%, Product-Led ${data.style_product_led}%, Authority ${data.style_authority}%

IMPORTANT: Align all posts with this campaign's goal, tone, CTA type, and style mix. Weight the 4 variations according to the style mix percentages.`;
}

function buildSystemPrompt(hasPersona: boolean, hasCampaign: boolean): string {
  return `You are a B2B SaaS content strategist for Chattrn — an AI-powered customer support platform.

Your job: Turn product instructions into structured LinkedIn content that is DEEPLY personalized for the target persona and aligned with the marketing campaign strategy.

RULES:
- Sound human. Never generic AI tone.
- Never say "we are excited to announce" or similar clichés.
- Focus on real business value for the specific persona's industry and context.
- Every post must feel like a real founder/marketer wrote it FOR this specific person.
- Use short, punchy lines. No walls of text.
- Match the persona's language style exactly.
- Adjust complexity and vocabulary to their awareness level.

MANDATORY CONTENT BRIEF:
Before generating posts, you MUST create a content brief that includes:
- Target persona & awareness level analysis
- Key pain point to address (pick the most relevant one)
- Desired outcome for the reader
- Core message aligned with campaign
- Emotional angle / trigger (fear of missing out, frustration, aspiration, relief, curiosity)
- Content type tag (Awareness, Education, Trust, Product, or Lead)
- CTA strategy (must match campaign CTA type)
- Persona fit explanation (WHY this content will work for this specific persona)
- Resonance reason (what makes this relatable to them)

Given a user instruction, respond with VALID JSON (no markdown, no code fences) in this exact structure:

{
  "idea": {
    "idea_title": "string",
    "target_audience": "string",
    "objective": "awareness | promotion | education | leads",
    "core_message": "string",
    "suggested_cta": "string",
    "persona_fit": "string (2-3 sentences explaining WHY this content fits the selected persona — reference their awareness level, industry, and pain points)",
    "emotional_trigger": "string (the primary emotional lever: e.g. frustration with status quo, fear of falling behind, aspiration for growth, relief from pain)",
    "resonance_reason": "string (2-3 sentences on WHY this will resonate — what shared experience or insight makes them stop scrolling)"
  },
  "posts": [
    {
      "variation_number": 1,
      "hook": "string (attention-grabbing first line written in the persona's language style)",
      "body": "string (short readable lines, use \\n for line breaks, speak DIRECTLY to the persona)",
      "cta": "string (must match campaign CTA type)",
      "first_comment": "string (suggested first comment to boost engagement)",
      "post_style": "product_insight | pain_solution | founder_tone | educational | soft_promotion",
      "tone": "string (must align with persona's preferred communication style)",
      "content_intent": "Awareness | Education | Trust | Product | Lead"
    }
    // ... 4 total variations
  ]
}

Each of the 4 posts MUST:
- Use a different hook style
- Use a different angle/perspective
- Use a different tone variation (but all within the persona's comfort zone)
- Use a different post_style from the supported list
- Have a content_intent tag
- Speak DIRECTLY to the persona (use "you" language that reflects their world)
- Match the persona's awareness level (don't pitch to unaware, don't educate product-aware)
- Use vocabulary and references familiar to their industry

Make posts LinkedIn-ready: professional but human, value-driven, concise.`;
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

    const { instruction, knowledge, persona_id, campaign_id } = await req.json();

    // Persona and campaign are now required
    if (!persona_id || persona_id === "none") {
      return new Response(JSON.stringify({ error: "Please select a target persona" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!campaign_id || campaign_id === "none") {
      return new Response(JSON.stringify({ error: "Please select a campaign" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build knowledge context
    let knowledgeBlock = "";
    if (knowledge) {
      const parts: string[] = [];
      if (knowledge.productDescription) parts.push(`Product: ${knowledge.productDescription}`);
      if (knowledge.features) parts.push(`Key features: ${knowledge.features}`);
      if (knowledge.targetAudience) parts.push(`Target audience: ${knowledge.targetAudience}`);
      if (parts.length > 0) {
        knowledgeBlock = `\n\nPRODUCT CONTEXT:\n${parts.join("\n")}`;
      }
    }

    // Fetch persona
    const { data: personaData } = await supabase.from("audience_personas").select("*").eq("id", persona_id).single();
    if (!personaData) {
      return new Response(JSON.stringify({ error: "Selected persona not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const personaBlock = buildPersonaBlock(personaData);

    // Fetch campaign
    const { data: campaignData } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaignData) {
      return new Response(JSON.stringify({ error: "Selected campaign not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const campaignBlock = buildCampaignBlock(campaignData);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(true, true);
    const userInstruction = instruction?.trim() || `Generate content for persona "${personaData.name}" aligned with campaign "${campaignData.name}"`;
    const userMessage = userInstruction + knowledgeBlock + personaBlock + campaignBlock;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No content from AI");

    let cleanContent = rawContent.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleanContent);

    // Save idea with new persona-aware fields
    const { data: idea, error: ideaError } = await supabase
      .from("ideas")
      .insert({
        user_id: user.id,
        instruction: userInstruction,
        idea_title: parsed.idea.idea_title,
        target_audience: parsed.idea.target_audience,
        objective: parsed.idea.objective,
        core_message: parsed.idea.core_message,
        suggested_cta: parsed.idea.suggested_cta,
        persona_fit: parsed.idea.persona_fit || null,
        emotional_trigger: parsed.idea.emotional_trigger || null,
        resonance_reason: parsed.idea.resonance_reason || null,
      })
      .select()
      .single();

    if (ideaError) throw ideaError;

    // Save posts
    const postsToInsert = parsed.posts.map((p: any) => ({
      user_id: user.id,
      idea_id: idea.id,
      variation_number: p.variation_number,
      hook: p.hook,
      body: p.body,
      cta: p.cta,
      first_comment: p.first_comment,
      post_style: p.post_style,
      tone: p.tone,
      content_intent: p.content_intent || null,
      persona_id: persona_id,
      campaign_id: campaign_id,
    }));

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .insert(postsToInsert)
      .select();

    if (postsError) throw postsError;

    return new Response(JSON.stringify({ idea, posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
