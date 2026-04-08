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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Auto-create content_tags from posts that have performance data but no tags
    const { data: draftsWithPerf } = await supabase
      .from("post_performance")
      .select("draft_id")
      .eq("user_id", user.id);

    const draftIds = (draftsWithPerf || []).map((d: any) => d.draft_id);

    if (draftIds.length > 0) {
      // Get drafts with their linked posts
      const { data: drafts } = await supabase
        .from("drafts")
        .select("id, selected_post_id")
        .in("id", draftIds);

      const postIds = (drafts || []).filter((d: any) => d.selected_post_id).map((d: any) => d.selected_post_id);

      if (postIds.length > 0) {
        const { data: postsData } = await supabase
          .from("posts")
          .select("id, hook_type, tone, post_style, content_intent, persona_id, campaign_id, idea_id")
          .in("id", postIds);

        // Check existing tags
        const { data: existingTags } = await supabase
          .from("content_tags")
          .select("post_id")
          .eq("user_id", user.id);

        const taggedPostIds = new Set((existingTags || []).map((t: any) => t.post_id));

        // Create missing tags
        const newTags = (postsData || [])
          .filter((p: any) => !taggedPostIds.has(p.id))
          .map((p: any) => {
            const draft = (drafts || []).find((d: any) => d.selected_post_id === p.id);
            return {
              user_id: user.id,
              post_id: p.id,
              draft_id: draft?.id || null,
              hook_type: p.hook_type || null,
              tone: p.tone || null,
              content_type: null,
              post_style: p.post_style || null,
              content_intent: p.content_intent || null,
              persona_id: p.persona_id || null,
              campaign_id: p.campaign_id || null,
              topic: null,
              cta_type: null,
              goal: null,
            };
          });

        if (newTags.length > 0) {
          await supabase.from("content_tags").insert(newTags);
        }
      }
    }

    // Step 2: Aggregate patterns
    const { data: tags } = await supabase
      .from("content_tags")
      .select("*, drafts:draft_id(id), post_performance:draft_id(impressions, likes, comments)")
      .eq("user_id", user.id);

    // Build enriched records (tags with performance)
    const enriched = (tags || [])
      .filter((t: any) => t.post_performance && t.post_performance.impressions !== undefined)
      .map((t: any) => ({
        ...t,
        perf: t.post_performance,
        engagement_rate: t.post_performance.impressions > 0
          ? ((t.post_performance.likes + t.post_performance.comments) / t.post_performance.impressions) * 100
          : 0,
      }));

    if (enriched.length === 0) {
      return new Response(JSON.stringify({ message: "No performance data to learn from yet", patterns: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate by dimensions
    const dimensions = ["hook_type", "tone", "post_style", "content_intent", "cta_type"];
    const patterns: any[] = [];

    for (const dim of dimensions) {
      const groups: Record<string, any[]> = {};
      for (const item of enriched) {
        const val = item[dim];
        if (!val) continue;
        if (!groups[val]) groups[val] = [];
        groups[val].push(item);
      }

      for (const [value, items] of Object.entries(groups)) {
        const count = items.length;
        const avgImpressions = items.reduce((s: number, i: any) => s + i.perf.impressions, 0) / count;
        const avgLikes = items.reduce((s: number, i: any) => s + i.perf.likes, 0) / count;
        const avgComments = items.reduce((s: number, i: any) => s + i.perf.comments, 0) / count;
        const avgEngagement = items.reduce((s: number, i: any) => s + i.engagement_rate, 0) / count;

        patterns.push({
          user_id: user.id,
          dimension: dim,
          dimension_value: value,
          sample_count: count,
          avg_impressions: Math.round(avgImpressions),
          avg_engagement_rate: Math.round(avgEngagement * 100) / 100,
          avg_likes: Math.round(avgLikes * 10) / 10,
          avg_comments: Math.round(avgComments * 10) / 10,
          best_combination: {},
          insight: null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // Step 3: Generate AI insights for patterns
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY && patterns.length > 0) {
      try {
        const patternSummary = patterns.map(p =>
          `${p.dimension}="${p.dimension_value}": ${p.sample_count} posts, avg ${p.avg_engagement_rate}% engagement, ${p.avg_impressions} impressions`
        ).join("\n");

        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `You generate one-line performance insights for LinkedIn content patterns. For each pattern, write a brief insight. Return VALID JSON only: {"insights": {"dimension|value": "insight text", ...}}`
              },
              { role: "user", content: patternSummary },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          let raw = aiData.choices?.[0]?.message?.content?.trim() || "";
          if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
          try {
            const parsed = JSON.parse(raw);
            for (const p of patterns) {
              const key = `${p.dimension}|${p.dimension_value}`;
              if (parsed.insights?.[key]) {
                p.insight = parsed.insights[key];
              }
            }
          } catch { /* ignore parse errors */ }
        }
      } catch { /* AI is optional */ }
    }

    // Step 4: Upsert patterns
    // Delete old patterns for this user and re-insert
    await supabase.from("content_patterns").delete().eq("user_id", user.id);
    if (patterns.length > 0) {
      await supabase.from("content_patterns").insert(patterns);
    }

    return new Response(JSON.stringify({ success: true, patterns_count: patterns.length, patterns }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("learn-patterns error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
