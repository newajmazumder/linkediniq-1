import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instruction, knowledge, persona_id, campaign_id } = await req.json();
    if (!instruction || typeof instruction !== "string" || instruction.trim().length === 0) {
      return new Response(JSON.stringify({ error: "instruction is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Fetch persona if selected
    let personaBlock = "";
    let personaData = null;
    if (persona_id && persona_id !== "none") {
      const { data } = await supabase.from("audience_personas").select("*").eq("id", persona_id).single();
      if (data) {
        personaData = data;
        const painPoints = Array.isArray(data.pain_points) ? data.pain_points : [];
        const goals = Array.isArray(data.goals) ? data.goals : [];
        const objections = Array.isArray(data.objections) ? data.objections : [];
        personaBlock = `\n\nTARGET PERSONA:
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

IMPORTANT: Write content that speaks directly to this persona's awareness level, pain points, and preferred content style.`;
      }
    }

    // Fetch campaign if selected
    let campaignBlock = "";
    if (campaign_id && campaign_id !== "none") {
      const { data } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
      if (data) {
        campaignBlock = `\n\nCAMPAIGN STRATEGY:
- Campaign: ${data.name}
- Goal: ${data.goal || "awareness"}
- Core Message: ${data.core_message || "Not specified"}
- Offer: ${data.offer || "None"}
- CTA Type: ${data.cta_type || "soft"} ${data.cta_type === "soft" ? "(follow, comment)" : data.cta_type === "medium" ? "(DM, engage)" : "(book demo, signup)"}
- Tone: ${data.tone || "friendly"}
- Content Style Mix: Storytelling ${data.style_storytelling}%, Educational ${data.style_educational}%, Product-Led ${data.style_product_led}%, Authority ${data.style_authority}%

IMPORTANT: Align all posts with this campaign's goal, tone, CTA type, and style mix. Weight the 4 variations according to the style mix percentages.`;
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build content brief instruction
    const briefInstruction = personaBlock || campaignBlock
      ? `\n\nBefore generating posts, create a CONTENT BRIEF with:
- Target persona & awareness level
- Key pain point to address
- Desired outcome for the reader
- Core message
- Emotional angle
- Content type tag (one of: Awareness, Education, Trust, Product, Lead)
- CTA strategy

Include this brief in the "idea" section of your response.`
      : "";

    const systemPrompt = `You are a B2B SaaS content strategist for Chattrn — an AI-powered customer support platform.

Your job: Turn product instructions into structured LinkedIn content.

RULES:
- Sound human. Never generic AI tone.
- Never say "we are excited to announce" or similar clichés.
- Focus on real business value for SaaS + customer support domain.
- Every post must feel like a real founder/marketer wrote it.
- Use short, punchy lines. No walls of text.
${briefInstruction}

Given a user instruction, respond with VALID JSON (no markdown, no code fences) in this exact structure:

{
  "idea": {
    "idea_title": "string",
    "target_audience": "string",
    "objective": "awareness | promotion | education | leads",
    "core_message": "string",
    "suggested_cta": "string"
  },
  "posts": [
    {
      "variation_number": 1,
      "hook": "string (attention-grabbing first line)",
      "body": "string (short readable lines, use \\n for line breaks)",
      "cta": "string",
      "first_comment": "string (suggested first comment to boost engagement)",
      "post_style": "product_insight | pain_solution | founder_tone | educational | soft_promotion",
      "tone": "string (e.g. conversational, authoritative, provocative, empathetic)",
      "content_intent": "Awareness | Education | Trust | Product | Lead"
    },
    // ... 4 total variations, each with different hook, angle, tone, and style
  ]
}

Each of the 4 posts MUST use:
- A different hook style
- A different angle/perspective
- A different tone
- A different post_style from the supported list
- A content_intent tag

Make posts LinkedIn-ready: professional but human, value-driven, concise.`;

    const userMessage = instruction + knowledgeBlock + personaBlock + campaignBlock;

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
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Save idea
    const { data: idea, error: ideaError } = await supabase
      .from("ideas")
      .insert({
        user_id: user.id,
        instruction: instruction.trim(),
        idea_title: parsed.idea.idea_title,
        target_audience: parsed.idea.target_audience,
        objective: parsed.idea.objective,
        core_message: parsed.idea.core_message,
        suggested_cta: parsed.idea.suggested_cta,
      })
      .select()
      .single();

    if (ideaError) throw ideaError;

    // Save posts with content_intent, persona_id, campaign_id
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
      persona_id: persona_id && persona_id !== "none" ? persona_id : null,
      campaign_id: campaign_id && campaign_id !== "none" ? campaign_id : null,
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
