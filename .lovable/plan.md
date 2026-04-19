

Looking at this — the user is articulating a vision for transforming the app from a "smart interface" into an "intelligent operator" with 6 layered intelligence engines. This is huge. I need to assess what already exists vs. what's missing, then propose a focused, testable phased build.

Let me check what's already in the codebase across the 6 layers before planning.

Existing assets I can map:
- **Layer 1 (Context)**: `business_profiles`, `audience_personas`, `market_contexts`, `context_sources` ✅ exists
- **Layer 2 (Strategy)**: `campaign_blueprints`, `campaign_week_plans`, `campaign_post_plans`, `campaign-strategist` edge fn ✅ exists, but NO versioning
- **Layer 3 (Execution)**: `execution.ts`, `ExecutionDashboard`, `campaign_post_plans.status` ✅ partial
- **Layer 4 (Performance)**: `post_metrics`, `goal_evaluations`, `interpret-campaign-performance`, `RawToGoalInsight` ✅ partial
- **Layer 5 (Learning)**: `content_patterns` (with `confidence_level`), `post_signals`, `learn-patterns` ⚠️ exists but underused per-campaign
- **Layer 6 (Adaptation)**: `campaign_adaptations`, `campaign-adapt` edge fn ⚠️ exists but doesn't revise the plan
- **Advisor / proactive questions**: ❌ does not exist

The user explicitly said: "Do not build the final intelligence system at once. Build it in testable phases." and "MVP intelligence features that matter most" = 5 things:
1. Campaign memory
2. Goal-aware planning
3. Next best action
4. Top performer + why it worked
5. Strategy adaptation

Items 2 and 4 are already partially built. The biggest gaps with highest user value:
- **Campaign Intelligence Memory object** (single source of truth per campaign — currently fragmented)
- **Strategy versioning** (v1 → v2 → v3)
- **Adaptation that actually revises the plan** (today it only writes "adjustments" rows but never edits `campaign_post_plans`)
- **Confidence-aware insights** (must say "insufficient evidence")
- **Proactive Advisor** (asks for missing info)

I should propose Phase 1 + a slice of Phase 6 + Advisor as the first build — the smallest cut that proves intelligence. Then later phases.

Keep plan concise. No emojis. No questions — the user gave a clear direction.

