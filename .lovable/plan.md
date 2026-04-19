

## Investigation

Looking at the current code:
- `CampaignPostCard.tsx` routes "View" and "Edit" buttons to `/drafts` (which is the drafts list, not a specific draft).
- The screenshot shows the user clicked View/Edit and got a 404 — likely because somewhere it routes to `/posts/:id` or similar that doesn't exist.
- Looking at `App.tsx` summary: routes include `/create`, `/posts`, `/performance/:postId`. There's no `/drafts/:id` or `/posts/:id` route for drafts.
- `DraftsPage.tsx` exists at `/posts` route (it's the drafts list page).
- `CreatePage.tsx` accepts query params (`idea`, `post_plan_id`, `campaign_id`) for prefilling — but no `draft_id` for editing existing drafts.

The core gap: **there is no way to load an existing draft into the Create page for view/edit**. The `CreatePage` only generates new posts — it doesn't hydrate from an existing draft record.

## Plan

### 1. Extend `CreatePage` to support draft view/edit modes
Add support for new query params:
- `?draft_id=<uuid>` — load an existing draft into the page
- `?mode=view` or `?mode=edit` — control whether fields are editable

When `draft_id` is present:
- Fetch the draft from `drafts` table (with linked campaign/post-plan context)
- Hydrate the form: persona, campaign, language, post type, instruction, knowledge
- Render the generated post as a `PostCard` in the right panel using draft content
- Show context header banner: `Campaign: X · Week N · Post N · Status: Draft · Last updated: ...`
- In **view mode**: disable inputs, hide "Generate" button, show "Edit Draft" + "Back to Campaign" CTAs, disable PostCard rewrite/regenerate actions
- In **edit mode**: enable inputs, change "Save" button to "Update Draft" (updates existing row instead of inserting)

### 2. Update `PostCard` save logic
Currently `saveDraft` always inserts a new row. Add support for updating an existing draft when `draftId` is provided as a prop, so edits to a linked draft don't create duplicates.

### 3. Fix routing in `CampaignPostCard`
Replace the broken `/drafts` links for View/Edit with:
- **View** → `/create?draft_id=<linked_draft_id>&mode=view&campaign_id=<id>&post_plan_id=<id>`
- **Edit** → `/create?draft_id=<linked_draft_id>&mode=edit&campaign_id=<id>&post_plan_id=<id>`

### 4. Recoverable error handling
In `CreatePage`, if `draft_id` is provided but the draft row is not found:
- Don't 404
- Show an inline recoverable error card: *"This draft could not be found."* with two CTAs: **Recreate Draft** (clears `draft_id`, keeps `post_plan_id` so the user can regenerate) and **Back to Campaign**.

### 5. State-based action UI in `CampaignPostCard` (already mostly correct)
Confirm the action set per state matches spec:
- **Planned** → `Create Now` only
- **Drafted** → `View`, `Edit`, `Mark Posted`, `Duplicate` (no Create Now) ✓ already hides Create Now
- **Scheduled** → `View`, `Edit`, `Mark Posted`, `Duplicate` ✓
- **Posted** → `View Post`, `View Metrics`, `Duplicate` ✓
- **Missed** → `Recover` ✓

Add "last updated" time below the status badge in the drafted/scheduled states (using draft's `updated_at`).

### 6. Drafts list page — make rows clickable
On `DraftsPage` (`/posts`), each draft card should also link to `/create?draft_id=<id>&mode=view` so users can reach the same view/edit experience from the drafts list (consistency).

## Files to edit

- `src/pages/CreatePage.tsx` — add `draft_id`/`mode` handling, hydration, view/edit UI states, recoverable error
- `src/components/create/PostCard.tsx` — support updating existing draft when `draftId` prop set; respect read-only mode
- `src/components/campaign/CampaignPostCard.tsx` — fix View/Edit routes to `/create?draft_id=...&mode=...`; add last-updated timestamp
- `src/pages/DraftsPage.tsx` — wire row click/View/Edit to `/create?draft_id=...&mode=...`

## Out of scope (deferred)

- New dedicated `/posts/:postId/view` or `/posts/:postId/edit` routes — using `/create?draft_id=...&mode=...` per spec's "Same page, different mode" Option A is faster and reuses all existing form/preview UI.
- Draft regeneration controls in view mode — hidden per spec.

