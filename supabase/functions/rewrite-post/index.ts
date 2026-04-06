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

    const { post_id, action, context } = await req.json();
    if (!post_id || !action) {
      return new Response(JSON.stringify({ error: "post_id and action are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validActions = ["regenerate_hook", "regenerate_cta", "rewrite_shorter", "rewrite_human", "rewrite_bold", "rewrite_product"];
    if (!validActions.includes(action)) {
      return new Response(JSON.stringify({ error: `Invalid action. Must be one of: ${validActions.join(", ")}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch existing post
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

    const prompts: Record<string, string> = {
      regenerate_hook: `Rewrite ONLY the hook (first line) of this LinkedIn post. Keep body and CTA exactly the same. Make the new hook more attention-grabbing and different from the original.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "new hook text", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "${post.cta.replace(/"/g, '\\"')}"}`,
      regenerate_cta: `Rewrite ONLY the CTA (call to action) of this LinkedIn post. Keep hook and body exactly the same. Make the new CTA more compelling.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "${post.hook.replace(/"/g, '\\"')}", "body": "${post.body.replace(/"/g, '\\"')}", "cta": "new cta text"}`,
      rewrite_shorter: `Rewrite this LinkedIn post to be significantly shorter and more concise. Cut the fluff. Keep the same message but in fewer words.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "...", "body": "...", "cta": "..."}`,
      rewrite_human: `Rewrite this LinkedIn post to sound more human, conversational, and authentic. Remove any corporate or AI-sounding language.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "...", "body": "...", "cta": "..."}`,
      rewrite_bold: `Rewrite this LinkedIn post to be more bold, provocative, and attention-grabbing. Take a stronger stance. Be opinionated.\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "...", "body": "...", "cta": "..."}`,
      rewrite_product: `Rewrite this LinkedIn post to be more product-focused. Highlight specific features, benefits, and real use cases of the product.\n\nContext: ${context || "B2B SaaS customer support platform"}\n\nCurrent post:\n${currentPost}\n\nRespond with VALID JSON (no markdown fences): {"hook": "...", "body": "...", "cta": "..."}`,
    };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a LinkedIn post rewriter for B2B SaaS. Respond with ONLY valid JSON, no markdown fences, no explanation." },
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

    // Update post in DB
    const { data: updated, error: updateError } = await supabase
      .from("posts")
      .update({
        hook: parsed.hook,
        body: parsed.body,
        cta: parsed.cta,
      })
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
