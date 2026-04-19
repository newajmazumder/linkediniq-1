
-- Reset all campaigns except "The Revenue Recovery Blitz: The AI Agent Launch" to state 0
-- Keep campaign context, wipe all plans/posts/signals/progress

DO $$
DECLARE
  keep_id uuid := '25355617-415f-4920-bc1d-544aec8ad6be';
  target_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO target_ids FROM public.campaigns WHERE id <> keep_id;

  -- Wipe dependent records
  DELETE FROM public.campaign_post_plans WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_week_plans WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_progress   WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_reports    WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_adaptations WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_advisor_questions WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.campaign_strategy_versions WHERE campaign_id = ANY(target_ids);
  DELETE FROM public.post_signals WHERE campaign_id = ANY(target_ids);

  -- Reset campaign state to "setup" (no dates, no started, planned status)
  UPDATE public.campaigns
  SET
    started_at = NULL,
    completed_at = NULL,
    target_start_date = NULL,
    target_end_date = NULL,
    execution_status = 'planned',
    execution_score = 0,
    goal_progress_percent = 0,
    goal_status = 'not_started',
    current_goal_value = 0,
    unattributed_goal_value = 0,
    goal_value_updated_at = NULL,
    last_evaluated_at = NULL,
    conversion_signal_count = 0,
    strategy_strength_score = 0,
    velocity_score = 0,
    intelligence_snapshot = '{}'::jsonb,
    intelligence_updated_at = NULL
  WHERE id = ANY(target_ids);
END $$;
