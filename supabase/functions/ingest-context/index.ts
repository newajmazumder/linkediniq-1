import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function chunkText(text: string, maxChars = 2000): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? "\n\n" : "") + para;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text.slice(0, maxChars)];
}

function stripHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractJsonFromResponse(raw: string): any {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  cleaned = cleaned.replace(/,\s*([\]}])/g, "$1");
  try {
    return JSON.parse(cleaned);
  } catch {
    let opens = 0;
    for (const ch of cleaned) {
      if (ch === "{" || ch === "[") opens++;
      if (ch === "}" || ch === "]") opens--;
    }
    for (let i = 0; i < opens; i++) cleaned += "}";
    return JSON.parse(cleaned);
  }
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

    const { source_id } = await req.json();
    if (!source_id) {
      return new Response(JSON.stringify({ error: "source_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the source
    const { data: source, error: srcErr } = await supabase
      .from("context_sources")
      .select("*")
      .eq("id", source_id)
      .eq("user_id", user.id)
      .single();

    if (srcErr || !source) {
      return new Response(JSON.stringify({ error: "Source not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await supabase.from("context_sources").update({ ingestion_status: "processing" }).eq("id", source_id);

    let rawText = "";

    // Get text based on source type
    if (source.source_type === "text" || source.source_type === "markdown") {
      rawText = source.raw_content || "";
    } else if (source.source_type === "website" && source.source_url) {
      try {
        const resp = await fetch(source.source_url, {
          headers: { "User-Agent": "LinkedinIQ/1.0 (Business Context Ingestion)" },
        });
        if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status}`);
        const html = await resp.text();
        rawText = stripHtml(html);
        // Store the extracted text back
        await supabase.from("context_sources").update({ raw_content: rawText.slice(0, 100000) }).eq("id", source_id);
      } catch (e) {
        await supabase.from("context_sources").update({ ingestion_status: "error" }).eq("id", source_id);
        return new Response(JSON.stringify({ error: `Website fetch failed: ${e instanceof Error ? e.message : "unknown"}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (source.source_type === "pdf") {
      // For PDF, raw_content should be set by client-side extraction before calling ingest
      rawText = source.raw_content || "";
    }

    if (!rawText || rawText.length < 10) {
      await supabase.from("context_sources").update({ ingestion_status: "error" }).eq("id", source_id);
      return new Response(JSON.stringify({ error: "No text content to process" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete old chunks for this source
    await supabase.from("context_chunks").delete().eq("source_id", source_id);

    // Chunk the content
    const chunks = chunkText(rawText);
    const chunksToInsert = chunks.map((text, i) => ({
      user_id: user.id,
      source_id: source_id,
      chunk_text: text,
      chunk_index: i,
      metadata: { source_category: source.source_category, source_title: source.title },
    }));

    await supabase.from("context_chunks").insert(chunksToInsert);

    // Extract structured knowledge using AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      await supabase.from("context_sources").update({ ingestion_status: "done" }).eq("id", source_id);
      return new Response(JSON.stringify({ success: true, chunks: chunks.length, extracted: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Take first ~8000 chars for extraction
    const extractionText = rawText.slice(0, 8000);

    const extractionPrompt = `Analyze this business document and extract structured business knowledge. Only extract information that is clearly stated or strongly implied. Return empty strings/arrays for fields with no relevant information.

DOCUMENT (Category: ${source.source_category}):
${extractionText}

Return ONLY valid JSON with these fields (use empty string "" for text fields with no info, empty array [] for array fields):
{
  "company_summary": "string",
  "founder_story": "string",
  "product_summary": "string",
  "target_audience": "string",
  "industries_served": ["string"],
  "customer_problems": ["string"],
  "product_features": ["string"],
  "customer_benefits": ["string"],
  "differentiators": ["string"],
  "proof_points": ["string"],
  "offers_campaigns": ["string"],
  "objections": ["string"],
  "brand_tone": "string",
  "desired_perception": "string",
  "current_priorities": ["string"],
  "messaging_pillars": ["string"],
  "valid_ctas": ["string"],
  "restricted_claims": ["string"],
  "keywords": ["string"]
}`;

    try {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a business intelligence extractor. Extract structured knowledge from documents. Be precise and factual." },
            { role: "user", content: extractionPrompt },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        const raw = aiData.choices?.[0]?.message?.content || "{}";
        const extracted = extractJsonFromResponse(raw);

        // Merge into business profile (additive)
        const { data: existing } = await supabase
          .from("business_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        const mergeText = (existing: string | null, newVal: string): string => {
          if (!newVal) return existing || "";
          if (!existing) return newVal;
          if (existing.includes(newVal)) return existing;
          return existing + "\n\n" + newVal;
        };

        const mergeArray = (existing: any, newArr: any[]): any[] => {
          const existArr = Array.isArray(existing) ? existing : [];
          const combined = [...existArr];
          for (const item of newArr) {
            if (item && !combined.includes(item)) combined.push(item);
          }
          return combined;
        };

        const profileData = {
          user_id: user.id,
          company_summary: mergeText(existing?.company_summary, extracted.company_summary || ""),
          founder_story: mergeText(existing?.founder_story, extracted.founder_story || ""),
          product_summary: mergeText(existing?.product_summary, extracted.product_summary || ""),
          target_audience: mergeText(existing?.target_audience, extracted.target_audience || ""),
          industries_served: mergeArray(existing?.industries_served, extracted.industries_served || []),
          customer_problems: mergeArray(existing?.customer_problems, extracted.customer_problems || []),
          product_features: mergeArray(existing?.product_features, extracted.product_features || []),
          customer_benefits: mergeArray(existing?.customer_benefits, extracted.customer_benefits || []),
          differentiators: mergeArray(existing?.differentiators, extracted.differentiators || []),
          proof_points: mergeArray(existing?.proof_points, extracted.proof_points || []),
          offers_campaigns: mergeArray(existing?.offers_campaigns, extracted.offers_campaigns || []),
          objections: mergeArray(existing?.objections, extracted.objections || []),
          brand_tone: mergeText(existing?.brand_tone, extracted.brand_tone || ""),
          desired_perception: mergeText(existing?.desired_perception, extracted.desired_perception || ""),
          current_priorities: mergeArray(existing?.current_priorities, extracted.current_priorities || []),
          messaging_pillars: mergeArray(existing?.messaging_pillars, extracted.messaging_pillars || []),
          valid_ctas: mergeArray(existing?.valid_ctas, extracted.valid_ctas || []),
          restricted_claims: mergeArray(existing?.restricted_claims, extracted.restricted_claims || []),
          keywords: mergeArray(existing?.keywords, extracted.keywords || []),
        };

        if (existing) {
          await supabase.from("business_profiles").update(profileData).eq("user_id", user.id);
        } else {
          await supabase.from("business_profiles").insert(profileData);
        }
      }
    } catch (e) {
      console.error("AI extraction error (non-fatal):", e);
    }

    // Mark as done
    await supabase.from("context_sources").update({ ingestion_status: "done" }).eq("id", source_id);

    return new Response(JSON.stringify({ success: true, chunks: chunks.length, extracted: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ingest-context error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
