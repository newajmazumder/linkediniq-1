

# Business Context Intelligence Layer — Implementation Plan

## Summary

Add a Business Context module that lets you upload documents (text, markdown, PDF, website links), extracts structured business knowledge from them, and injects that knowledge into content generation, performance analysis, and recommendations. This turns the app from a generic writing tool into a context-aware content strategist.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────┐
│                  UI Layer                        │
│  BusinessContextPage (new route /context)        │
│  ├── Source Library (upload/manage sources)       │
│  ├── Business Profile (structured knowledge)     │
│  └── Context Health dashboard                    │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│             Database (Supabase)                   │
│  context_sources → context_chunks                 │
│  business_profiles (1 per user)                   │
│  context_settings                                 │
└──────────────┬──────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────┐
│          Edge Functions                           │
│  ingest-context  → parse + chunk + extract        │
│  generate-content → enhanced with business context│
│  analyze-post    → enhanced with business context │
│  analyze-performance → enhanced                   │
└─────────────────────────────────────────────────┘
```

---

## Phase 1: Data Model + Source Library

### New database tables

**context_sources** — each uploaded file, link, or text block
- id, user_id, title, source_type (text/markdown/pdf/website/doc), source_category (company_overview, product_overview, feature_docs, founder_voice, positioning, pain_points, audience_notes, campaign_brief, case_study, release_notes, cta_guidance, restrictions), raw_content (text), file_url (for uploaded files), source_url (for websites), ingestion_status (pending/processing/done/error), is_active, tags (jsonb), created_at, updated_at

**context_chunks** — chunked content from each source for retrieval
- id, user_id, source_id (FK → context_sources), chunk_text, chunk_index, metadata (jsonb), created_at

**business_profiles** — one per user, structured knowledge
- id, user_id (unique), company_summary, founder_story, product_summary, target_audience, industries_served (jsonb), customer_problems (jsonb), product_features (jsonb), customer_benefits (jsonb), differentiators (jsonb), proof_points (jsonb), offers_campaigns (jsonb), objections (jsonb), brand_tone, desired_perception, current_priorities (jsonb), messaging_pillars (jsonb), valid_ctas (jsonb), restricted_claims (jsonb), keywords (jsonb), updated_at, created_at

**context_settings** — per-user preferences
- id, user_id (unique), default_active_categories (jsonb), founder_tone_weight (int default 50), product_docs_weight (int default 50), auto_extract_on_ingest (bool default true), created_at, updated_at

RLS: all tables scoped to `auth.uid() = user_id`.

### Storage bucket
- Create `context-files` bucket for uploaded PDFs/docs.

### New edge function: `ingest-context`
- Accepts source_id
- Based on source_type:
  - **text/markdown**: store raw_content directly, chunk into ~500-token segments
  - **pdf**: use the raw text extraction (parse on client or lightweight server-side), chunk
  - **website**: fetch URL content (using fetch + HTML-to-text), chunk
- After chunking: call AI (Gemini Flash) to extract structured knowledge fields
- Merge extracted fields into the user's `business_profiles` row (additive, not overwrite)
- Update `ingestion_status` to done/error

### UI: BusinessContextPage (`/context`)
- Add to sidebar navigation (icon: Brain or BookOpen)
- Three tabs: **Sources**, **Business Profile**, **Context Health**

**Sources tab:**
- List of all context_sources with title, type badge, category, status, active toggle
- "Add Source" button opens a dialog with options: paste text, upload file, add URL
- Each source card: edit title/tags, reprocess, delete, activate/deactivate

**Business Profile tab:**
- Editable form showing all `business_profiles` fields
- Grouped sections: Identity, Product, Audience, Messaging, Strategy, Restrictions
- Auto-populated from extraction, user can edit any field

**Context Health tab:**
- Coverage checklist: which categories have active sources
- Warnings for missing/outdated areas
- Source count, last updated dates

---

## Phase 2: Context-Aware Generation

### Enhance `generate-content` edge function
- When generating, fetch the user's `business_profiles` row
- Fetch relevant `context_chunks` filtered by:
  - Active sources only
  - Category matching (e.g., for product posts → product_overview, feature_docs; for storytelling → founder_voice, company_overview)
  - Limit to top ~10 most relevant chunks (by category match + recency)
- Inject business context block into the system prompt:
  - Company summary, product summary, differentiators, current priorities, brand tone, restricted claims
  - Relevant chunk excerpts
- Add to output schema: `context_rationale` field per post explaining which business angles were used

### Update CreatePage UI
- Show "Context: Active" indicator when business profile exists
- After generation, show context_rationale per post in PostCard
- Remove the manual KnowledgeInput component (replaced by the persistent business context)

---

## Phase 3: Context-Aware Analysis & Recommendations

### Enhance `analyze-post` edge function
- Include business_profiles data in the analysis prompt
- Evaluate: did the post use strongest differentiators? Align with priorities? Match brand voice?
- Add context-aware fields to output: `context_alignment_score`, `missed_angles`, `brand_voice_match`

### Enhance `analyze-performance` edge function
- Include business context in the performance analysis prompt
- Generate insights like "posts using real product pain points outperform generic AI commentary"

### Update PostDetailPage and PerformancePage
- Show context-alignment insights alongside existing analysis

---

## Phase 4: Context Health Dashboard

- Simple coverage meter on the Business Profile tab
- Missing category warnings
- "Outdated source" indicator (sources not updated in 30+ days)
- Quick-add prompts for weak areas

---

## Technical Notes

- **File parsing**: PDFs uploaded to storage bucket, text extracted client-side using pdf.js or server-side in the edge function. For MVP, focus on text/markdown/URL; PDF support can use a simple text extraction approach.
- **Website scraping**: The `ingest-context` edge function will fetch URLs and extract readable text. If Firecrawl connector is available, use it for better quality; otherwise, basic fetch + HTML stripping.
- **AI extraction**: Use Gemini 2.5 Flash via Lovable AI gateway for structured knowledge extraction from chunks. Prompt returns JSON matching business_profiles fields.
- **Context selection logic**: Category-based filtering (not vector search for MVP). Each source has a category; the generation engine picks chunks from relevant categories based on the post's goal/style.
- **No vector DB needed for Phase 1**: Simple category + recency filtering is sufficient. Vector search can be added later if needed.

---

## Implementation Order

1. Database migration (4 tables + storage bucket)
2. `ingest-context` edge function
3. BusinessContextPage UI (sources + profile + health)
4. Sidebar navigation update
5. Enhance `generate-content` with business context
6. Update CreatePage to show context usage
7. Enhance analysis edge functions
8. Update analysis UIs

---

## What stays the same

- Existing persona/campaign system (complemented, not replaced)
- Current design language, layout, card styles
- All existing pages and functionality
- Auth flow, RLS patterns

