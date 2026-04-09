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

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch campaign + blueprint
    const [campaignRes, blueprintRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("id", campaign_id).single(),
      supabase.from("campaign_blueprints").select("*").eq("campaign_id", campaign_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const campaign = campaignRes.data;
    if (!campaign) {
      return new Response(JSON.stringify({ error: "Campaign not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blueprint = blueprintRes.data;
    const summary = blueprint?.campaign_summary || {};
    const durationWeeks = summary.duration_weeks || 4;
    const postsPerWeek = summary.posts_per_week || 2;
    const totalPosts = summary.total_posts || durationWeeks * postsPerWeek;

    const systemPrompt = `You are a LinkedIn campaign planner. Generate a detailed week-by-week campaign plan with specific post slots.

CAMPAIGN DETAILS:
- Name: ${campaign.name}
- Objective: ${campaign.primary_objective || campaign.goal || "awareness"}
- Target Metric: ${campaign.target_metric || "engagement"}
- Target Quantity: ${campaign.target_quantity || "N/A"}
- Duration: ${durationWeeks} weeks
- Posts per week: ${postsPerWeek}
- Total posts: ${totalPosts}
- Core Message: ${campaign.core_message || "Not set"}
- CTA Type: ${campaign.cta_type || "soft"}
- Tone: ${campaign.tone || "friendly"}

${blueprint ? `BLUEPRINT CONTEXT:
- Business Rationale: ${JSON.stringify(blueprint.business_rationale || {})}
- Audience: ${JSON.stringify(blueprint.audience_summary || {})}
- Messaging: ${JSON.stringify(blueprint.messaging_strategy || {})}
- Content Strategy: ${JSON.stringify(blueprint.content_strategy || {})}
- CTA Strategy: ${JSON.stringify(blueprint.cta_strategy || {})}` : ""}

Generate a plan that adapts weekly phases based on the objective:
- Awareness campaigns: problem awareness → pain amplification → solution introduction → authority/trust
- DM campaigns: curiosity building → value teasing → direct response escalation → urgency
- Lead campaigns: problem identification → solution framing → trust building → conversion
- Follower campaigns: relatability → identity → consistency → community

Respond with VALID JSON (no markdown):
{
  "weeks": [
    {
      "week_number": 1,
      "weekly_goal": "...",
      "primary_message": "...",
      "audience_lens": "...",
      "recommended_post_count": N,
      "recommended_formats": ["text", "image_text"],
      "hook_styles": ["curiosity", "pain_driven"],
      "cta_strategy": "...",
      "week_purpose": "...",
      "posts": [
        {
          "post_number": 1,
          "post_objective": "...",
          "content_angle": "...",
          "recommended_format": "text",
          "suggested_hook_type": "curiosity",
          "suggested_tone": "friendly",
          "suggested_cta_type": "soft",
          "strategic_rationale": "Why this post exists at this point in the campaign"
        }
      ]
    }
  ]
}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
          { role: "user", content: `Generate the ${durationWeeks}-week campaign plan with ${totalPosts} total posts.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("No AI response");

    let clean = rawContent.trim();
    if (clean.startsWith("```")) clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(clean);

    // Delete existing plans for this campaign
    await supabase.from("campaign_post_plans").delete().eq("campaign_id", campaign_id);
    await supabase.from("campaign_week_plans").delete().eq("campaign_id", campaign_id);

    // Insert week plans and post plans
    let globalPostNumber = 0;
    for (const week of parsed.weeks) {
      const { data: weekPlan, error: weekErr } = await supabase
        .from("campaign_week_plans")
        .insert({
          user_id: user.id,
          campaign_id,
          blueprint_id: blueprint?.id || null,
          week_number: week.week_number,
          weekly_goal: week.weekly_goal,
          primary_message: week.primary_message,
          audience_lens: week.audience_lens,
          recommended_post_count: week.recommended_post_count || week.posts?.length || 2,
          recommended_formats: week.recommended_formats || [],
          hook_styles: week.hook_styles || [],
          cta_strategy: week.cta_strategy,
          week_purpose: week.week_purpose,
          status: "planned",
        })
        .select()
        .single();

      if (weekErr) throw weekErr;

      if (week.posts && week.posts.length > 0) {
        const postPlans = week.posts.map((p: any) => {
          globalPostNumber++;
          return {
            user_id: user.id,
            campaign_id,
            week_plan_id: weekPlan.id,
            post_number: globalPostNumber,
            week_number: week.week_number,
            post_objective: p.post_objective,
            content_angle: p.content_angle,
            recommended_format: p.recommended_format || "text",
            suggested_hook_type: p.suggested_hook_type,
            suggested_tone: p.suggested_tone,
            suggested_cta_type: p.suggested_cta_type,
            strategic_rationale: p.strategic_rationale,
            status: "planned",
          };
        });

        const { error: postsErr } = await supabase.from("campaign_post_plans").insert(postPlans);
        if (postsErr) throw postsErr;
      }
    }

    // Fetch the created plans
    const { data: weekPlans } = await supabase
      .from("campaign_week_plans")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("week_number");

    const { data: postPlans } = await supabase
      .from("campaign_post_plans")
      .select("*")
      .eq("campaign_id", campaign_id)
      .order("post_number");

    return new Response(JSON.stringify({ week_plans: weekPlans, post_plans: postPlans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-campaign-plan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
