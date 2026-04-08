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

function buildBusinessContextBlock(profile: any, chunks: any[]): string {
  const parts: string[] = [];
  
  if (profile) {
    parts.push("BUSINESS CONTEXT (from structured knowledge):");
    if (profile.company_summary) parts.push(`Company: ${profile.company_summary}`);
    if (profile.product_summary) parts.push(`Product: ${profile.product_summary}`);
    if (profile.target_audience) parts.push(`Target Audience: ${profile.target_audience}`);
    
    const arr = (v: any) => Array.isArray(v) && v.length > 0 ? v.join(", ") : null;
    const diff = arr(profile.differentiators);
    if (diff) parts.push(`Key Differentiators: ${diff}`);
    const probs = arr(profile.customer_problems);
    if (probs) parts.push(`Customer Problems: ${probs}`);
    const feats = arr(profile.product_features);
    if (feats) parts.push(`Product Features: ${feats}`);
    const bens = arr(profile.customer_benefits);
    if (bens) parts.push(`Customer Benefits: ${bens}`);
    if (profile.brand_tone) parts.push(`Brand Tone: ${profile.brand_tone}`);
    const priorities = arr(profile.current_priorities);
    if (priorities) parts.push(`Current Priorities: ${priorities}`);
    const pillars = arr(profile.messaging_pillars);
    if (pillars) parts.push(`Messaging Pillars: ${pillars}`);
    const restricted = arr(profile.restricted_claims);
    if (restricted) parts.push(`RESTRICTED CLAIMS (do NOT use): ${restricted}`);
    const validCtas = arr(profile.valid_ctas);
    if (validCtas) parts.push(`Approved CTAs: ${validCtas}`);
    const proofs = arr(profile.proof_points);
    if (proofs) parts.push(`Proof Points: ${proofs}`);
  }
  
  if (chunks.length > 0) {
    parts.push("\nRELEVANT SOURCE EXCERPTS:");
    for (const chunk of chunks.slice(0, 8)) {
      parts.push(`[${chunk.metadata?.source_category || "general"}: ${chunk.metadata?.source_title || "source"}]\n${chunk.chunk_text.slice(0, 500)}`);
    }
  }
  
  if (parts.length === 0) return "";
  
  return "\n\n" + parts.join("\n") + `

IMPORTANT BUSINESS CONTEXT RULES:
- Use company-specific language and positioning from the business context above.
- Do NOT make claims that are not supported by the business context.
- Prioritize the strongest differentiators and messaging angles found above.
- Reflect the brand tone and voice described.
- Each post must include a "context_rationale" explaining which business angle was used.`;
}

function buildSystemPrompt(hasPersona: boolean, hasCampaign: boolean): string {
  return `You are a B2B SaaS content strategist — a context-aware content intelligence engine.

Your job: Turn product instructions into structured LinkedIn content that is DEEPLY personalized for the target persona and aligned with the marketing campaign strategy.

RULES:
- Sound human. Never generic AI tone.
- Never say "we are excited to announce" or similar clichés.
- Focus on real business value for the specific persona's industry and context.
- Every post must feel like a real founder/marketer wrote it FOR this specific person.
- Use short, punchy lines. No walls of text.
- Match the persona's language style exactly.
- Adjust complexity and vocabulary to their awareness level.

CONTENT ENGINES — use these frameworks when generating variations:

STORY ENGINE (for founder_story and customer_story styles):
Structure every story post as:
1. Situation — set the scene (relatable context)
2. Tension — the problem or friction
3. Realization — the aha moment or turning point
4. Lesson — the takeaway insight
5. Soft CTA — invite engagement, not a hard sell
Generate founder-style stories, customer-like scenarios, and real-life relatable narratives.

EDUCATION ENGINE (for educational and framework styles):
- Build frameworks, mental models, and structured breakdowns
- Show "how things actually work" behind the scenes
- Never write generic tips or shallow lists
- Each educational post must teach ONE specific, actionable insight
- Use numbered steps, before/after, or myth-busting structures

HYBRID CONTENT (for hybrid styles):
- story + insight: open with a narrative, close with a framework
- insight + product: lead with education, weave in product naturally
- pain + education: agitate a specific pain, then teach the solution
Always make the transition feel seamless, not forced.

HOOK INTELLIGENCE — each of the 4 posts MUST use a DIFFERENT hook type:
1. Curiosity hook: "Most SaaS founders don't realize..." / "What nobody tells you about..."
2. Contrarian hook: "Stop doing X. Here's why." / "Unpopular opinion: ..."
3. Pain-driven hook: "You're losing X customers because..." / "That feeling when..."
4. Data/bold hook: "We reduced churn by 40% in 3 weeks." / "X% of support tickets are unnecessary."

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
    "persona_fit": "string (2-3 sentences explaining WHY this content fits the selected persona)",
    "emotional_trigger": "string (the primary emotional lever)",
    "resonance_reason": "string (2-3 sentences on WHY this will resonate)"
  },
  "posts": [
    {
      "variation_number": 1,
      "hook": "string (use one of the 4 hook types — curiosity, contrarian, pain-driven, or data/bold)",
      "hook_type": "curiosity | contrarian | pain_driven | data_bold",
      "body": "string (use the appropriate content engine — story structure, educational framework, or hybrid)",
      "cta": "string (must match campaign CTA type)",
      "first_comment": "string (suggested first comment to boost engagement)",
      "post_style": "founder_story | customer_story | educational | framework | pain_solution | product_insight | hybrid_story_insight | hybrid_pain_education | soft_promotion",
      "tone": "string (must align with persona's preferred communication style)",
      "content_intent": "Awareness | Education | Trust | Product | Lead",
      "context_rationale": "string (1-2 sentences: which business angle, differentiator, or product feature was used and why)"
    }
    // ... 4 total variations
  ]
}

Each of the 4 posts MUST:
- Use a DIFFERENT hook_type (one of each: curiosity, contrarian, pain_driven, data_bold)
- Use a DIFFERENT post_style from the expanded list above
- Use a different angle/perspective
- Have a content_intent tag
- Speak DIRECTLY to the persona using their language style
- Match the persona's awareness level
- Follow the correct content engine structure for its post_style

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

    // Fetch business context
    const [profileRes, chunksRes] = await Promise.all([
      supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("context_chunks")
        .select("chunk_text, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Filter chunks by active sources
    let relevantChunks = chunksRes.data || [];
    if (relevantChunks.length > 0) {
      const { data: activeSources } = await supabase
        .from("context_sources")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true);
      const activeIds = new Set((activeSources || []).map((s: any) => s.id));
      // chunks don't have source_id in select, but we fetched from active user — keep all for now
    }

    const businessContextBlock = buildBusinessContextBlock(profileRes.data, relevantChunks as any[]);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(true, true);
    const userInstruction = instruction?.trim() || `Generate content for persona "${personaData.name}" aligned with campaign "${campaignData.name}"`;
    const userMessage = userInstruction + knowledgeBlock + personaBlock + campaignBlock + businessContextBlock;

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
      hook_type: p.hook_type || null,
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
