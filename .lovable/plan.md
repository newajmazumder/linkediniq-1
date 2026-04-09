

# Multi-Language Content Generation (English + Bangla)

## Overview
Add native multi-language support to the post generation system, starting with English and Bangla. Bangla content will be generated natively (not translated), with culturally relevant tone, expressions, and formatting.

## Changes

### 1. Database: Add `language` column to `campaigns` table
- Migration: `ALTER TABLE campaigns ADD COLUMN language text DEFAULT 'english';`
- This lets each campaign set a default language that posts inherit.

### 2. Frontend: Language Selector in CreatePage
**File: `src/pages/CreatePage.tsx`**
- Add a `language` state variable (default: `"english"`, options: `"english"`, `"bangla"`)
- Auto-populate from campaign's `language` when a campaign is selected
- Render a language selector (two-button toggle, similar to post type selector) between Post Type and Knowledge Input sections
- Pass `language` in the `generate-content` function invocation body

### 3. Frontend: Language Setting in Campaign Creation
**File: `src/pages/StrategyPage.tsx`**
- Add `language` field to the campaign creation/edit form (dropdown: English / Bangla)
- Save to the `campaigns` table

### 4. Edge Function: Native Language Generation
**File: `supabase/functions/generate-content/index.ts`**
- Accept `language` parameter from request body (default `"english"`)
- Create `buildLanguageBlock(language: string)` function that returns language-specific prompt instructions:
  - For `"bangla"`: detailed rules covering conversational tone, Bangla-first sentence structure, smart English mixing for product terms, Bangladesh-specific cultural context (Friday rush, WhatsApp orders, "Price koto?" behavior), CTA localization ("কমেন্ট করুন", "আপনার অভিজ্ঞতা কী?"), formatting in Bangla, and a self-validation check
  - For `"english"`: existing behavior (no extra block needed)
- Inject the language block into `buildSystemPrompt()` so the AI generates natively in the selected language
- Add a language directive at the top of the system prompt when Bangla: "You MUST generate ALL content (hook, body, CTA, first_comment) directly in Bangla. Do NOT generate in English then translate."

### 5. Edge Function: Rewrite Support
**File: `supabase/functions/rewrite-post/index.ts`**
- Detect language from the existing post content or accept a `language` parameter
- Apply same Bangla generation rules when rewriting/regenerating posts

## Technical Details

### Language selector UI (CreatePage)
- Two-option toggle using Globe icon: `🇺🇸 English` / `🇧🇩 Bangla`
- When campaign is selected, auto-set language from `campaignData.language`
- User can override per-post

### Bangla prompt block (key content)
The prompt instructs the AI to:
- Think and write in Bangla natively
- Use conversational, business-friendly Bangla (not literary/formal)
- Keep English terms for products (AI Agent, WhatsApp, conversion)
- Reference BD-specific scenarios (Messenger orders, Friday night rush)
- Format CTAs naturally ("কমেন্ট করুন 'SCALE'", "এই সমস্যাটা কি আপনারও হচ্ছে?")
- Apply same formatting rules (line breaks, bullets, CTA isolation) in Bangla
- Self-validate: "If this reads like translated English, regenerate"

### Files Modified
1. `src/pages/CreatePage.tsx` — language selector + pass to API
2. `src/pages/StrategyPage.tsx` — language field in campaign form
3. `supabase/functions/generate-content/index.ts` — language-aware prompting
4. `supabase/functions/rewrite-post/index.ts` — language-aware rewriting
5. Migration: add `language` column to `campaigns` table

