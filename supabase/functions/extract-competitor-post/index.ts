import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { screenshot_url, screenshot_urls } = await req.json();
    const allUrls: string[] = screenshot_urls?.length ? screenshot_urls : screenshot_url ? [screenshot_url] : [];
    if (allUrls.length === 0) throw new Error("Missing screenshot_url or screenshot_urls");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Use Gemini 2.5 Pro for vision extraction
    const prompt = `You are an expert LinkedIn post analyzer. Analyze this screenshot of a LinkedIn post and extract ALL visible information.

CRITICAL RULES:
- Only extract what is CLEARLY VISIBLE in the screenshot
- Do NOT guess or infer values that are not shown
- If a field is unclear or partially visible, set confidence to "low" or "missing"
- Never fabricate engagement numbers

Extract and return a JSON object with this EXACT structure:

{
  "post_text": {
    "value": "<full visible post text, preserving line breaks>",
    "confidence": "high|medium|low|missing"
  },
  "hook": {
    "value": "<first 1-2 lines of the post - the hook>",
    "confidence": "high|medium|low|missing"
  },
  "cta": {
    "value": "<any call-to-action visible at the end of the post, or null>",
    "confidence": "high|medium|low|missing"
  },
  "hashtags": {
    "value": ["<visible hashtags>"],
    "confidence": "high|medium|low|missing"
  },
  "likes": {
    "value": <number or null>,
    "confidence": "high|medium|low|missing"
  },
  "comments": {
    "value": <number or null>,
    "confidence": "high|medium|low|missing"
  },
  "reposts": {
    "value": <number or null>,
    "confidence": "high|medium|low|missing"
  },
  "impressions": {
    "value": <number or null>,
    "confidence": "high|medium|low|missing"
  },
  "post_format": {
    "value": "<text_only|image_text|carousel|video_preview|infographic|product_screenshot|founder_image|meme_style|branded_graphic|unknown>",
    "confidence": "high|medium|low"
  },
  "visual_summary": {
    "value": "<short description of the visual style/content, e.g. 'text-heavy educational graphic with blue branding' or 'founder headshot with motivational quote overlay'>",
    "confidence": "high|medium|low"
  },
  "author_name": {
    "value": "<name of the post author if visible>",
    "confidence": "high|medium|low|missing"
  },
  "author_headline": {
    "value": "<headline/title of the author if visible>",
    "confidence": "high|medium|low|missing"
  },
  "post_url": {
    "value": "<LinkedIn post URL if visible in the browser address bar, post menu, or anywhere in the screenshot. Look for URLs like linkedin.com/feed/update/... or linkedin.com/posts/... — return null if not visible>",
    "confidence": "high|medium|low|missing"
  }
}

For engagement metrics:
- LinkedIn shows reactions as a total number (e.g. "1,234")
- Comments shown as "X comments"
- Reposts shown as "X reposts"  
- Impressions may show as "X impressions" or may not be visible at all
- If metrics are cut off or not in the screenshot, mark as "missing"

Return ONLY valid JSON. No markdown wrapping.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: `${prompt}\n\nYou are given ${allUrls.length} screenshot(s) of the SAME LinkedIn post. Analyze ALL images together to extract the complete picture — text from one, visuals/metrics from others. If an image contains a chart, infographic, or graphic, the post_format is NOT "text_only".` },
              ...allUrls.map(url => ({ type: "image_url" as const, image_url: { url } })),
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI extraction failed: ${resp.status}`);
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
    
    let extraction;
    try {
      extraction = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse extraction:", cleaned);
      throw new Error("Failed to parse AI extraction result");
    }

    return new Response(JSON.stringify({ success: true, extraction }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
