UPDATE public.campaign_post_plans p
SET
  status = 'posted',
  posted_at = COALESCE(p.posted_at, lp.publish_date, lp.imported_at, now()),
  updated_at = now()
FROM public.linkedin_posts lp
WHERE lp.linked_draft_id = p.linked_draft_id
  AND p.linked_draft_id IS NOT NULL
  AND p.status IS DISTINCT FROM 'posted';