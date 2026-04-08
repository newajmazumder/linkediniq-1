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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 1: Auto-create content_tags from drafts pipeline =====
    const { data: draftsWithPerf } = await supabase
      .from("post_performance")
      .select("draft_id")
      .eq("user_id", user.id);

    const draftIds = (draftsWithPerf || []).map((d: any) => d.draft_id);

    if (draftIds.length > 0) {
      const { data: drafts } = await supabase
        .from("drafts")
        .select("id, selected_post_id")
        .in("id", draftIds);

      const postIds = (drafts || []).filter((d: any) => d.selected_post_id).map((d: any) => d.selected_post_id);

      if (postIds.length > 0) {
        const { data: postsData } = await supabase
          .from("posts")
          .select("id, hook, body, cta, hook_type, tone, post_style, content_intent, persona_id, campaign_id")
          .in("id", postIds);

        const { data: existingTags } = await supabase
          .from("content_tags")
          .select("post_id")
          .eq("user_id", user.id);

        const taggedPostIds = new Set((existingTags || []).map((t: any) => t.post_id));

        const newTags = (postsData || [])
          .filter((p: any) => !taggedPostIds.has(p.id))
          .map((p: any) => {
            const draft = (drafts || []).find((d: any) => d.selected_post_id === p.id);
            const fullContent = `${p.hook || ""}\n${p.body || ""}\n${p.cta || ""}`;
            const wordCount = fullContent.trim().split(/\s+/).length;
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
              word_count: wordCount,
              publish_hour: null,
            };
          });

        if (newTags.length > 0) {
          await supabase.from("content_tags").insert(newTags);
        }
      }
    }

    // ===== STEP 1b: Auto-tag linkedin_posts that have metrics but no tags =====
    const { data: linkedinPostsWithMetrics } = await supabase
      .from("post_metrics")
      .select("linkedin_post_id")
      .eq("user_id", user.id);

    const linkedinPostIds = (linkedinPostsWithMetrics || []).map((m: any) => m.linkedin_post_id);

    if (linkedinPostIds.length > 0) {
      const { data: existingLinkedinTags } = await supabase
        .from("content_tags")
        .select("linkedin_post_id")
        .eq("user_id", user.id)
        .not("linkedin_post_id", "is", null);

      const taggedLinkedinIds = new Set((existingLinkedinTags || []).map((t: any) => t.linkedin_post_id));
      const untaggedIds = linkedinPostIds.filter((id: string) => !taggedLinkedinIds.has(id));

      if (untaggedIds.length > 0 && LOVABLE_API_KEY) {
        const { data: untaggedPosts } = await supabase
          .from("linkedin_posts")
          .select("id, content, publish_date")
          .in("id", untaggedIds)
          .limit(10);

        // Also check post_context for any pre-tagged context
        const { data: existingContexts } = await supabase
          .from("post_context")
          .select("linkedin_post_id, hook_type, tone, cta_type, goal, persona_id, campaign_id, strategy_type")
          .in("linkedin_post_id", untaggedIds);

        const contextMap: Record<string, any> = {};
        for (const ctx of (existingContexts || [])) {
          contextMap[ctx.linkedin_post_id] = ctx;
        }

        for (const lp of (untaggedPosts || [])) {
          const ctx = contextMap[lp.id];
          const wordCount = (lp.content || "").trim().split(/\s+/).length;
          const publishHour = lp.publish_date ? new Date(lp.publish_date).getHours() : null;

          if (ctx && ctx.hook_type) {
            // Use existing context data — no AI needed
            await supabase.from("content_tags").insert({
              user_id: user.id,
              linkedin_post_id: lp.id,
              hook_type: ctx.hook_type || null,
              tone: ctx.tone || null,
              cta_type: ctx.cta_type || null,
              goal: ctx.goal || null,
              persona_id: ctx.persona_id || null,
              campaign_id: ctx.campaign_id || null,
              post_style: ctx.strategy_type || null,
              word_count: wordCount,
              publish_hour: publishHour,
            });
          } else {
            // AI-classify the post content
            try {
              const classifyResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                      content: `Classify this LinkedIn post. Return VALID JSON only:
{"hook_type": "curiosity|contrarian|pain_driven|data_bold|question|story_opening",
"tone": "friendly|professional|empathetic|authoritative|bold|conversational",
"post_style": "founder_story|customer_story|educational|framework|pain_solution|product_insight|hybrid_story_insight|soft_promotion",
"cta_type": "soft|hard|question|dm_prompt|comment_prompt|link|none",
"content_intent": "Awareness|Education|Trust|Product|Lead",
"topic": "brief 2-3 word topic"}`
                    },
                    { role: "user", content: lp.content.slice(0, 1500) },
                  ],
                }),
              });

              if (classifyResp.ok) {
                const classifyData = await classifyResp.json();
                let raw = classifyData.choices?.[0]?.message?.content?.trim() || "";
                if (raw.startsWith("```")) raw = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
                try {
                  const tags = JSON.parse(raw);
                  await supabase.from("content_tags").insert({
                    user_id: user.id,
                    linkedin_post_id: lp.id,
                    hook_type: tags.hook_type || null,
                    tone: tags.tone || null,
                    post_style: tags.post_style || null,
                    cta_type: tags.cta_type || null,
                    content_intent: tags.content_intent || null,
                    topic: tags.topic || null,
                    goal: ctx?.goal || null,
                    persona_id: ctx?.persona_id || null,
                    campaign_id: ctx?.campaign_id || null,
                    word_count: wordCount,
                    publish_hour: publishHour,
                  });
                } catch { /* skip if parse fails */ }
              }
            } catch { /* skip individual classification errors */ }
          }
        }
      }
    }

    // ===== STEP 2: Aggregate patterns from BOTH pipelines =====
    // Get tags linked to draft performance
    const { data: draftTags } = await supabase
      .from("content_tags")
      .select("*, post_performance:draft_id(impressions, likes, comments)")
      .eq("user_id", user.id)
      .not("draft_id", "is", null);

    // Get tags linked to linkedin post metrics
    const { data: linkedinTags } = await supabase
      .from("content_tags")
      .select("*, post_metrics:linkedin_post_id(impressions, reactions, comments, reposts)")
      .eq("user_id", user.id)
      .not("linkedin_post_id", "is", null);

    // Normalize into unified enriched records
    const enriched: any[] = [];

    for (const t of (draftTags || [])) {
      if (t.post_performance && t.post_performance.impressions !== undefined && t.post_performance.impressions > 0) {
        enriched.push({
          ...t,
          impressions: t.post_performance.impressions,
          likes: t.post_performance.likes,
          comments: t.post_performance.comments,
          engagement_rate: ((t.post_performance.likes + t.post_performance.comments) / t.post_performance.impressions) * 100,
        });
      }
    }

    for (const t of (linkedinTags || [])) {
      if (t.post_metrics && t.post_metrics.impressions !== undefined && t.post_metrics.impressions > 0) {
        enriched.push({
          ...t,
          impressions: t.post_metrics.impressions,
          likes: t.post_metrics.reactions || 0,
          comments: t.post_metrics.comments || 0,
          engagement_rate: ((t.post_metrics.reactions + t.post_metrics.comments + (t.post_metrics.reposts || 0)) / t.post_metrics.impressions) * 100,
        });
      }
    }

    if (enriched.length === 0) {
      return new Response(JSON.stringify({ message: "No performance data to learn from yet", patterns: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aggregate by dimensions (including distribution dimensions)
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
        const avgImpressions = items.reduce((s: number, i: any) => s + i.impressions, 0) / count;
        const avgLikes = items.reduce((s: number, i: any) => s + i.likes, 0) / count;
        const avgComments = items.reduce((s: number, i: any) => s + i.comments, 0) / count;
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

    // ===== Distribution Intelligence: post_length buckets =====
    const withWordCount = enriched.filter((e: any) => e.word_count && e.word_count > 0);
    if (withWordCount.length > 0) {
      const lengthBuckets: Record<string, any[]> = { "short (<100 words)": [], "medium (100-200)": [], "long (200+)": [] };
      for (const item of withWordCount) {
        if (item.word_count < 100) lengthBuckets["short (<100 words)"].push(item);
        else if (item.word_count <= 200) lengthBuckets["medium (100-200)"].push(item);
        else lengthBuckets["long (200+)"].push(item);
      }

      for (const [bucket, items] of Object.entries(lengthBuckets)) {
        if (items.length === 0) continue;
        const count = items.length;
        patterns.push({
          user_id: user.id,
          dimension: "post_length",
          dimension_value: bucket,
          sample_count: count,
          avg_impressions: Math.round(items.reduce((s: number, i: any) => s + i.impressions, 0) / count),
          avg_engagement_rate: Math.round(items.reduce((s: number, i: any) => s + i.engagement_rate, 0) / count * 100) / 100,
          avg_likes: Math.round(items.reduce((s: number, i: any) => s + i.likes, 0) / count * 10) / 10,
          avg_comments: Math.round(items.reduce((s: number, i: any) => s + i.comments, 0) / count * 10) / 10,
          best_combination: {},
          insight: null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ===== Distribution Intelligence: publish_hour buckets =====
    const withPublishHour = enriched.filter((e: any) => e.publish_hour !== null && e.publish_hour !== undefined);
    if (withPublishHour.length > 0) {
      const timeBuckets: Record<string, any[]> = {
        "morning (6-9)": [], "mid-morning (9-12)": [], "afternoon (12-17)": [], "evening (17-21)": [], "night (21-6)": [],
      };
      for (const item of withPublishHour) {
        const h = item.publish_hour;
        if (h >= 6 && h < 9) timeBuckets["morning (6-9)"].push(item);
        else if (h >= 9 && h < 12) timeBuckets["mid-morning (9-12)"].push(item);
        else if (h >= 12 && h < 17) timeBuckets["afternoon (12-17)"].push(item);
        else if (h >= 17 && h < 21) timeBuckets["evening (17-21)"].push(item);
        else timeBuckets["night (21-6)"].push(item);
      }

      for (const [bucket, items] of Object.entries(timeBuckets)) {
        if (items.length === 0) continue;
        const count = items.length;
        patterns.push({
          user_id: user.id,
          dimension: "publish_time",
          dimension_value: bucket,
          sample_count: count,
          avg_impressions: Math.round(items.reduce((s: number, i: any) => s + i.impressions, 0) / count),
          avg_engagement_rate: Math.round(items.reduce((s: number, i: any) => s + i.engagement_rate, 0) / count * 100) / 100,
          avg_likes: Math.round(items.reduce((s: number, i: any) => s + i.likes, 0) / count * 10) / 10,
          avg_comments: Math.round(items.reduce((s: number, i: any) => s + i.comments, 0) / count * 10) / 10,
          best_combination: {},
          insight: null,
          updated_at: new Date().toISOString(),
        });
      }
    }

    // ===== STEP 3: Generate AI insights =====
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
                content: `You generate one-line performance insights for LinkedIn content patterns. For each pattern, write a brief actionable insight. Return VALID JSON only: {"insights": {"dimension|value": "insight text", ...}}`
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

    // ===== STEP 4: Upsert patterns =====
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
