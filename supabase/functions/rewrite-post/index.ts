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

    const { post_id, action, context, language, market_context_id } = await req.json();
    if (!post_id || !action) {
      return new Response(JSON.stringify({ error: "post_id and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validActions = [
      "regenerate_hook", "regenerate_cta",
      "rewrite_shorter", "rewrite_human", "rewrite_bold", "rewrite_product",
      "rewrite_story", "rewrite_educational", "rewrite_hybrid",
      "hook_curiosity", "hook_contrarian", "hook_pain", "hook_data",
      "regenerate_from_suggestions", "regenerate_from_prediction",
      "apply_quick_fix",
    ];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("*")
      .eq("id", post_id)
      .eq("user_id", user.id)
      .single();

    if (postError || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const currentPost = `Hook: ${post.hook}\n\nBody: ${post.body}\n\nCTA: ${post.cta}`;
    const jsonInstruction = `\n\nRespond with VALID JSON (no markdown fences): {"hook": "...", "body": "...", "cta": "..."}`;

    const prompts: Record<string, string> = {
      regenerate_hook: `Rewrite ONLY the hook (first line) of this LinkedIn post. Keep body and CTA exactly the same. Make the new hook more attention-grabbing.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new hook text", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      regenerate_cta: `Rewrite ONLY the CTA of this LinkedIn post. Keep hook and body exactly the same. Make the new CTA more compelling.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "${post.hook.replace(/"/g, '\\"')}", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "new cta text"}`,
      rewrite_shorter: `Rewrite this LinkedIn post to be significantly shorter and more concise. Cut the fluff.\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_human: `Rewrite this LinkedIn post to sound more human, conversational, and authentic. Remove any AI-sounding language.\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_bold: `Rewrite this LinkedIn post to be more bold, provocative, and attention-grabbing. Take a stronger stance.\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_product: `Rewrite this LinkedIn post to be more product-focused. Highlight specific features, benefits, and real use cases.\n\nContext: ${context || "B2B SaaS customer support platform"}\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_story: `Rewrite this LinkedIn post as a STORY using this structure:
1. Situation — set the scene (relatable context the reader lives in)
2. Tension — the problem or friction they face
3. Realization — the aha moment or turning point
4. Lesson — the takeaway insight
5. Soft CTA — invite engagement naturally
Make it feel like a real founder or customer telling their story. No corporate speak.\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_educational: `Rewrite this LinkedIn post as an EDUCATIONAL framework or breakdown:
- Teach ONE specific, actionable insight
- Use a structured format (numbered steps, before/after, or myth-busting)
- Show "how things actually work" — no generic tips or shallow lists
- Make the reader feel smarter after reading\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      rewrite_hybrid: `Rewrite this LinkedIn post as a HYBRID (story + insight):
- Open with a short, relatable narrative (2-3 lines)
- Transition into a framework or structured insight
- Close with a takeaway + CTA
The transition between story and insight must feel seamless.\n\nCurrent post:\n${currentPost}${jsonInstruction}`,
      hook_curiosity: `Rewrite ONLY the hook of this LinkedIn post using a CURIOSITY style. Examples: "Most SaaS founders don't realize...", "What nobody tells you about...", "I was wrong about X for 3 years." Keep body and CTA exactly the same.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new curiosity hook", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      hook_contrarian: `Rewrite ONLY the hook of this LinkedIn post using a CONTRARIAN style. Examples: "Stop doing X. Here's why.", "Unpopular opinion: ...", "Everyone says X. They're wrong." Keep body and CTA exactly the same.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new contrarian hook", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      hook_pain: `Rewrite ONLY the hook of this LinkedIn post using a PAIN-DRIVEN style. Examples: "You're losing X customers because...", "That feeling when your support queue hits 200...", "Your team is drowning and you know it." Keep body and CTA exactly the same.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new pain hook", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      hook_data: `Rewrite ONLY the hook of this LinkedIn post using a DATA/BOLD STATEMENT style. Examples: "We reduced churn by 40% in 3 weeks.", "87% of support tickets are unnecessary.", "One change. 3x faster response time." Keep body and CTA exactly the same.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new data hook", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      regenerate_from_suggestions: `You are improving a LinkedIn post based on specific AI-generated suggestions. Your job is to rewrite the ENTIRE post (hook, body, CTA) addressing ALL the suggestions below.

SUGGESTIONS TO ADDRESS:
${context?.suggestions?.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n") || "No suggestions provided."}

${context?.failure_reasons?.length ? `FAILURE REASONS TO FIX:\n${context.failure_reasons.map((r: string, i: number) => `- ${r}`).join("\n")}` : ""}
${context?.weakest_element ? `WEAKEST ELEMENT: ${context.weakest_element}` : ""}
${context?.strongest_element ? `STRONGEST ELEMENT (keep this): ${context.strongest_element}` : ""}

${context?.improved_hooks?.length ? `SUGGESTED BETTER HOOKS:\n${context.improved_hooks.map((h: string) => `- ${h}`).join("\n")}` : ""}
${context?.improved_ctas?.length ? `SUGGESTED BETTER CTAs:\n${context.improved_ctas.map((c: string) => `- ${c}`).join("\n")}` : ""}

CURRENT POST:
${currentPost}

Rewrite the post to fix ALL weaknesses while preserving the strongest elements. Apply LinkedIn formatting best practices (short paragraphs, visual breaks, emphasis).${jsonInstruction}`,
      regenerate_from_prediction: `You are improving a LinkedIn post based on a detailed prediction analysis. Your job is to rewrite the ENTIRE post (hook, body, CTA) to significantly improve the predicted score.

PREDICTION ANALYSIS:
- Overall Score: ${context?.predicted_score || "N/A"}/100
- Publish Recommendation: ${context?.publish_recommendation || "N/A"}
- Risk Level: ${context?.risk_level || "N/A"}

DIMENSION SCORES (out of 100):
- Hook Strength: ${context?.hook_strength || "N/A"}
- Persona Relevance: ${context?.persona_relevance || "N/A"}
- Clarity: ${context?.clarity || "N/A"}
- Goal Alignment: ${context?.goal_alignment || "N/A"}
- CTA Alignment: ${context?.cta_alignment || "N/A"}
- Context Relevance: ${context?.context_relevance || "N/A"}

${context?.weak_stage ? `WEAK FUNNEL STAGE: ${context.weak_stage}` : ""}
${context?.weakest_element ? `WEAKEST ELEMENT: ${context.weakest_element}` : ""}
${context?.strongest_element ? `STRONGEST ELEMENT (preserve this): ${context.strongest_element}` : ""}
${context?.failure_reasons?.length ? `FAILURE REASONS:\n${context.failure_reasons.map((r: string) => `- ${r}`).join("\n")}` : ""}
${context?.suggestions?.length ? `SUGGESTIONS:\n${context.suggestions.map((s: string) => `- ${s}`).join("\n")}` : ""}

${context?.improved_hooks?.length ? `BETTER HOOK OPTIONS:\n${context.improved_hooks.map((h: string) => `- ${h}`).join("\n")}` : ""}
${context?.improved_ctas?.length ? `BETTER CTA OPTIONS:\n${context.improved_ctas.map((c: string) => `- ${c}`).join("\n")}` : ""}

CURRENT POST:
${currentPost}

Focus on improving the LOWEST scoring dimensions. Preserve what works (strongest element). Apply LinkedIn formatting best practices.${jsonInstruction}`,
      apply_quick_fix: `You are applying a specific quick fix to a LinkedIn post. Apply ONLY this fix while keeping the rest of the post as close to the original as possible.

QUICK FIX TO APPLY:
${context?.fix || "No fix specified"}

${context?.strongest_element ? `STRONGEST ELEMENT (do NOT change this): ${context.strongest_element}` : ""}

CURRENT POST:
${currentPost}

Apply the fix precisely. Do NOT rewrite the entire post — make the minimum changes needed to implement the fix.${jsonInstruction}`,
    };

    // Detect language: explicit param, or auto-detect from post content (Bangla Unicode range)
    const isBanglaContent = /[\u0980-\u09FF]/.test(post.hook + post.body);
    const effectiveLanguage = language || (isBanglaContent ? "bangla" : "english");

    // Fetch market context if provided
    let marketSystemAddition = "";
    if (market_context_id) {
      const { data: mc } = await supabase.from("market_contexts").select("*").eq("id", market_context_id).single();
      if (mc) {
        const phrases = mc.localized_phrases as any || {};
        const ctaExamples = Array.isArray(phrases.cta_examples) ? phrases.cta_examples.join(", ") : "";
        marketSystemAddition = ` You are writing for the ${mc.region_name} market (${mc.audience_type}). Tone: ${mc.tone_preference}. Buyer maturity: ${mc.buyer_maturity}. Use scenarios and references native to ${mc.region_name}. CTA style: ${mc.preferred_cta_style}. Example CTAs: ${ctaExamples}. Content must feel native to this market — not generic or transplanted from another region.`;
      }
    }

    const banglaSystemAddition = effectiveLanguage === "bangla"
      ? " You MUST write ALL output (hook, body, cta) in native conversational Bangla. Do NOT translate from English. Think in Bangla. Use business-friendly, conversational Bangla tone. Keep English product terms (AI Agent, WhatsApp, etc.) in English. CTAs must feel natural in Bangla."
      : "";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a LinkedIn post rewriter for B2B SaaS. Respond with ONLY valid JSON, no markdown fences, no explanation." + marketSystemAddition + banglaSystemAddition },
          { role: "user", content: prompts[action] },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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

    const { data: updated, error: updateError } = await supabase
      .from("posts")
      .update({ hook: parsed.hook, body: parsed.body, cta: parsed.cta })
      .eq("id", post_id)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ post: updated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rewrite-post error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
