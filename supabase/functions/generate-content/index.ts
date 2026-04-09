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
- Primary Objective: ${data.primary_objective || data.goal || "awareness"}
- Target Metric: ${data.target_metric || "N/A"}
- Target Quantity: ${data.target_quantity || "N/A"}
- Target Timeframe: ${data.target_timeframe || "monthly"}
- Core Message: ${data.core_message || "Not specified"}
- Offer: ${data.offer || "None"}
- CTA Type: ${data.cta_type || "soft"} ${data.cta_type === "soft" ? "(follow, comment)" : data.cta_type === "medium" ? "(DM, engage)" : "(book demo, signup)"}
- Tone: ${data.tone || "friendly"}
- Content Style Mix: Storytelling ${data.style_storytelling}%, Educational ${data.style_educational}%, Product-Led ${data.style_product_led}%, Authority ${data.style_authority}%

IMPORTANT: Align all posts with this campaign's goal, tone, CTA type, and style mix. Weight the 4 variations according to the style mix percentages.`;
}

function buildOutcomeStrategyBlock(objective: string): string {
  const strategies: Record<string, string> = {
    followers: `OUTCOME STRATEGY — FOLLOWER GROWTH:
Optimize for: relatability, identity alignment, shareability, memorability, lighter CTA, high top-of-funnel appeal.
Preferred: relatable hooks, category insights, thought-provoking statements, "follow for more" or no-pressure CTA.
Avoid: hard sell, demo-heavy CTA, feature overload. The goal is to make people WANT to see more from you.
Expected funnel: impressions → engagement → profile visits → follows`,

    dms: `OUTCOME STRATEGY — DIRECT MESSAGES:
Optimize for: curiosity gaps, direct response triggers, incomplete but compelling information, high intrigue, personalized CTA.
Preferred: tension in hook, tactical insight WITHOUT fully resolving, "comment/DM me for...", high-interest problem framing.
Avoid: explaining everything (kills DM motivation), weak CTA, passive educational tone.
Expected funnel: impressions → curiosity → engagement → direct response / DM`,

    leads: `OUTCOME STRATEGY — LEAD GENERATION:
Optimize for: pain → consequence → solution → proof, strong business value proposition, lower friction CTA, trust and relevance.
Preferred: urgent problem framing, value clarity, proof/mechanism/differentiation, direct CTA.
Avoid: generic awareness content, emotional storytelling without action, vague offers.
Expected funnel: impressions → relevance → trust → click/reply/intent → conversion`,

    demo_bookings: `OUTCOME STRATEGY — DEMO BOOKINGS:
Optimize for: pain → consequence → solution → proof, strong business value proposition, clear CTA with low friction.
Preferred: urgent problem framing, specific ROI/results data, proof points before CTA, direct booking CTA.
Avoid: generic awareness content, soft CTAs, content without clear next step.
Expected funnel: impressions → relevance → trust → click/reply/intent → demo booking`,

    signups: `OUTCOME STRATEGY — SIGNUPS:
Optimize for: clear value proposition, low-friction offer, urgency, proof of results.
Preferred: problem → solution → proof → easy signup CTA, free trial/freemium angle, specific results.
Avoid: vague messaging, complex signup processes, content without action pathway.
Expected funnel: impressions → relevance → trust → signup intent → conversion`,

    awareness: `OUTCOME STRATEGY — AWARENESS / REACH:
Optimize for: broad relevance, reach-friendly hook, emotional or surprising opening, easy readability, discussion or share potential.
Preferred: strong first line, fast clarity, high resonance, low-friction CTA.
Avoid: over-specific conversion CTA too early, product pitch in first lines.
Expected funnel: impressions → attention → engagement → recall / profile interest`,

    engagement: `OUTCOME STRATEGY — ENGAGEMENT:
Optimize for: discussion triggers, opinion-driven content, relatable scenarios, question-based CTAs.
Preferred: contrarian takes, "what do you think?" hooks, debate-worthy topics, personal experiences.
Avoid: one-directional content, passive reading experience, complex jargon.
Expected funnel: impressions → attention → emotional response → comment/react/share`,

    education: `OUTCOME STRATEGY — EDUCATION:
Optimize for: clarity, usefulness, credibility, save/share potential, strong knowledge delivery.
Preferred: frameworks, step-by-step insights, examples, stat-backed learning.
Avoid: shallow generalities, overly promotional language.
Expected funnel: impressions → read depth → perceived value → saves / comments / reshares`,

    profile_visits: `OUTCOME STRATEGY — PROFILE VISITS:
Optimize for: intrigue about the author, credibility signals, curiosity about expertise.
Preferred: personal stories, expertise hints, "I help X do Y" positioning, bio-worthy hooks.
Avoid: fully self-contained content (no reason to visit profile), generic advice.
Expected funnel: impressions → engagement → curiosity about author → profile visit`,
  };

  const strategy = strategies[objective] || strategies["awareness"];
  return `\n\n${strategy}\n\nCRITICAL: Every content decision (hook type, body structure, CTA) must serve this specific outcome. Do NOT generate generic content — optimize for the stated objective.`;
}

const GOAL_CATEGORY_PRIORITIES: Record<string, string[]> = {
  awareness: ["pain_points", "audience_notes", "founder_voice", "company_overview"],
  engagement: ["founder_voice", "company_overview", "case_study", "audience_notes"],
  conversion: ["product_overview", "feature_docs", "case_study", "cta_guidance", "proof_points"],
  authority: ["positioning", "proof_points", "release_notes", "case_study", "company_overview"],
  lead_generation: ["product_overview", "case_study", "proof_points", "cta_guidance", "feature_docs"],
  education: ["product_overview", "feature_docs", "positioning", "company_overview"],
};

function buildBusinessContextBlock(profile: any, chunks: any[], campaignGoal?: string): string {
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
    let sortedChunks = chunks;
    if (campaignGoal) {
      const priorities = GOAL_CATEGORY_PRIORITIES[campaignGoal] || [];
      sortedChunks = [...chunks].sort((a, b) => {
        const catA = a.metadata?.source_category || "";
        const catB = b.metadata?.source_category || "";
        const idxA = priorities.indexOf(catA);
        const idxB = priorities.indexOf(catB);
        const scoreA = idxA >= 0 ? idxA : 100;
        const scoreB = idxB >= 0 ? idxB : 100;
        return scoreA - scoreB;
      });
    }

    parts.push("\nRELEVANT SOURCE EXCERPTS:");
    for (const chunk of sortedChunks.slice(0, 8)) {
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

function buildPerformanceIntelligenceBlock(patterns: any[]): string {
  if (!patterns || patterns.length === 0) return "";

  const parts: string[] = ["\n\nPERFORMANCE INTELLIGENCE (from past content analysis):"];
  parts.push("The following patterns are learned from the user's ACTUAL published content performance. Use these to make smarter decisions.\n");

  const byDim: Record<string, any[]> = {};
  for (const p of patterns) {
    if (!byDim[p.dimension]) byDim[p.dimension] = [];
    byDim[p.dimension].push(p);
  }

  for (const [dim, items] of Object.entries(byDim)) {
    const sorted = items.sort((a: any, b: any) => (b.avg_engagement_rate || 0) - (a.avg_engagement_rate || 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    
    const dimLabel = dim.replace(/_/g, " ").toUpperCase();
    parts.push(`${dimLabel}:`);
    for (const p of sorted) {
      parts.push(`  - "${p.dimension_value}": ${p.avg_engagement_rate}% avg engagement, ${p.avg_impressions} avg impressions (${p.sample_count} posts)`);
    }
    if (sorted.length > 1) {
      parts.push(`  → BEST: "${best.dimension_value}" | WORST: "${worst.dimension_value}"`);
    }
    if (best.insight) parts.push(`  → Insight: ${best.insight}`);
    parts.push("");
  }

  const allSorted = [...patterns].sort((a, b) => (b.avg_engagement_rate || 0) - (a.avg_engagement_rate || 0));
  const topPatterns = allSorted.slice(0, 3);
  const bottomPatterns = allSorted.filter(p => p.sample_count >= 2).slice(-3);

  if (topPatterns.length > 0) {
    parts.push("WHAT WORKS (prioritize these):");
    for (const p of topPatterns) {
      parts.push(`  ✓ ${p.dimension.replace(/_/g, " ")}="${p.dimension_value}" — ${p.avg_engagement_rate}% engagement`);
    }
  }

  if (bottomPatterns.length > 0) {
    parts.push("WHAT TO AVOID (these underperform):");
    for (const p of bottomPatterns) {
      parts.push(`  ✗ ${p.dimension.replace(/_/g, " ")}="${p.dimension_value}" — only ${p.avg_engagement_rate}% engagement`);
    }
  }

  parts.push("\nCRITICAL: Use these learnings to inform your content decisions. Favor high-performing hook types, tones, and styles. Avoid patterns that consistently underperform UNLESS the user's instruction specifically requests them.");

  return parts.join("\n");
}

function getPostTypeInstructions(postType: string): string {
  if (postType === "image_text") {
    return `

POST TYPE: IMAGE + TEXT
This is a LinkedIn image+text post. Generate both text content AND an image brief for each variation.

For each post, include an "image_briefs" array with exactly 1 image brief object:
{
  "slide_number": 1,
  "visual_description": "Detailed description of what the image should show (layout, colors, elements, text overlays)",
  "text_overlay": "Any text that should appear ON the image (headline, key stat, quote)",
  "design_notes": "Style guidance (minimal, bold, infographic, photo-based, illustration)"
}

IMAGE RULES:
- The image should COMPLEMENT the text, not repeat it
- Use the image to show data, frameworks, comparisons, or emotional visuals
- Text overlay should be punchy (max 10-15 words)
- The text post should reference or lead into the image
- Keep the text post slightly shorter since the image carries part of the message`;
  }
  
  if (postType === "carousel") {
    return `

POST TYPE: CAROUSEL (5-10 SLIDES)
This is a LinkedIn carousel post. Generate text content (the post caption) AND carousel slide briefs.

For each post, include an "image_briefs" array with 5-10 slide brief objects:
{
  "slide_number": 1-10,
  "visual_description": "What this slide should look like visually",
  "text_overlay": "The main text/headline on this slide",
  "design_notes": "Color scheme, layout style, visual hierarchy"
}

CAROUSEL RULES:
- Slide 1: Hook slide — bold headline that makes people swipe
- Slides 2-8: Content slides — one key point per slide, progressive narrative
- Last slide: CTA slide — clear action + branding
- Each slide should have a single focused message
- Text overlay per slide: max 30-40 words
- The text caption (hook + body + cta) should tease the carousel content and encourage swiping
- Keep caption shorter (2-4 lines) — the carousel IS the content
- Use frameworks, step-by-step, myths vs reality, before/after, or numbered lists as carousel structures`;
  }
  
  return `

POST TYPE: TEXT ONLY
This is a standard text-only LinkedIn post. No images or carousels.
Do NOT include "image_briefs" in the output (or set it to an empty array []).`;
}

function buildSystemPrompt(hasPersona: boolean, hasCampaign: boolean, postType: string = "text"): string {
  const postTypeInstructions = getPostTypeInstructions(postType);
  
  const imageBriefsSchema = postType === "text" ? "" : `
      "image_briefs": [
        {
          "slide_number": 1,
          "visual_description": "string",
          "text_overlay": "string",
          "design_notes": "string"
        }
      ],`;

  return `You are a B2B SaaS content strategist — a context-aware content intelligence engine.

Your job: Turn product instructions into structured LinkedIn content that is DEEPLY personalized for the target persona and aligned with the marketing campaign strategy.
${postTypeInstructions}

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
      "context_rationale": "string (1-2 sentences: which business angle, differentiator, or product feature was used and why)",${imageBriefsSchema}
      "generation_influences": {
        "what_repeated": "string (what proven pattern was intentionally used based on performance data)",
        "what_avoided": "string (what underperforming pattern was intentionally avoided)",
        "what_tested": "string (what new angle or combination is being tested, if any)"
      }
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

    const { instruction, knowledge, persona_id, campaign_id, post_type = "text" } = await req.json();

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

    // Fetch persona and campaign
    const { data: personaData } = await supabase.from("audience_personas").select("*").eq("id", persona_id).single();
    if (!personaData) {
      return new Response(JSON.stringify({ error: "Selected persona not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const personaBlock = buildPersonaBlock(personaData);

    const { data: campaignData } = await supabase.from("campaigns").select("*").eq("id", campaign_id).single();
    if (!campaignData) {
      return new Response(JSON.stringify({ error: "Selected campaign not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const campaignBlock = buildCampaignBlock(campaignData);
    const campaignGoal = campaignData.goal || "awareness";
    const primaryObjective = campaignData.primary_objective || campaignGoal;
    const outcomeStrategyBlock = buildOutcomeStrategyBlock(primaryObjective);

    // Fetch business context, chunks, AND learned patterns in parallel
    const [profileRes, chunksRes, patternsRes] = await Promise.all([
      supabase.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("context_chunks")
        .select("chunk_text, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("content_patterns")
        .select("dimension, dimension_value, sample_count, avg_impressions, avg_engagement_rate, avg_likes, avg_comments, insight")
        .eq("user_id", user.id)
        .order("avg_engagement_rate", { ascending: false }),
    ]);

    const relevantChunks = chunksRes.data || [];
    const businessContextBlock = buildBusinessContextBlock(profileRes.data, relevantChunks as any[], campaignGoal);

    // Build performance intelligence block from learned patterns (CLOSED LOOP)
    const performanceBlock = buildPerformanceIntelligenceBlock(patternsRes.data || []);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(true, true, post_type);
    const userInstruction = instruction?.trim() || `Generate content for persona "${personaData.name}" aligned with campaign "${campaignData.name}"`;
    const userMessage = userInstruction + knowledgeBlock + personaBlock + campaignBlock + outcomeStrategyBlock + businessContextBlock + performanceBlock;

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
      post_type: post_type,
      image_briefs: p.image_briefs || [],
    }));

    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .insert(postsToInsert)
      .select();

    if (postsError) throw postsError;

    // Merge generation_influences and context_rationale from parsed data onto returned posts
    const enrichedPosts = (posts || []).map((dbPost: any, idx: number) => ({
      ...dbPost,
      context_rationale: parsed.posts[idx]?.context_rationale || null,
      generation_influences: parsed.posts[idx]?.generation_influences || null,
    }));

    return new Response(JSON.stringify({ idea, posts: enrichedPosts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
