export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audience_personas: {
        Row: {
          awareness_level: string | null
          business_size: string | null
          buying_triggers: string | null
          content_preference: string | null
          created_at: string
          geography: string | null
          goals: Json | null
          id: string
          industry: string | null
          language_style: string | null
          name: string
          objections: Json | null
          pain_points: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          awareness_level?: string | null
          business_size?: string | null
          buying_triggers?: string | null
          content_preference?: string | null
          created_at?: string
          geography?: string | null
          goals?: Json | null
          id?: string
          industry?: string | null
          language_style?: string | null
          name: string
          objections?: Json | null
          pain_points?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          awareness_level?: string | null
          business_size?: string | null
          buying_triggers?: string | null
          content_preference?: string | null
          created_at?: string
          geography?: string | null
          goals?: Json | null
          id?: string
          industry?: string | null
          language_style?: string | null
          name?: string
          objections?: Json | null
          pain_points?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_profiles: {
        Row: {
          brand_tone: string | null
          company_summary: string | null
          created_at: string
          current_priorities: Json | null
          customer_benefits: Json | null
          customer_problems: Json | null
          desired_perception: string | null
          differentiators: Json | null
          founder_story: string | null
          id: string
          industries_served: Json | null
          keywords: Json | null
          messaging_pillars: Json | null
          objections: Json | null
          offers_campaigns: Json | null
          product_features: Json | null
          product_summary: string | null
          proof_points: Json | null
          restricted_claims: Json | null
          target_audience: string | null
          updated_at: string
          user_id: string
          valid_ctas: Json | null
        }
        Insert: {
          brand_tone?: string | null
          company_summary?: string | null
          created_at?: string
          current_priorities?: Json | null
          customer_benefits?: Json | null
          customer_problems?: Json | null
          desired_perception?: string | null
          differentiators?: Json | null
          founder_story?: string | null
          id?: string
          industries_served?: Json | null
          keywords?: Json | null
          messaging_pillars?: Json | null
          objections?: Json | null
          offers_campaigns?: Json | null
          product_features?: Json | null
          product_summary?: string | null
          proof_points?: Json | null
          restricted_claims?: Json | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
          valid_ctas?: Json | null
        }
        Update: {
          brand_tone?: string | null
          company_summary?: string | null
          created_at?: string
          current_priorities?: Json | null
          customer_benefits?: Json | null
          customer_problems?: Json | null
          desired_perception?: string | null
          differentiators?: Json | null
          founder_story?: string | null
          id?: string
          industries_served?: Json | null
          keywords?: Json | null
          messaging_pillars?: Json | null
          objections?: Json | null
          offers_campaigns?: Json | null
          product_features?: Json | null
          product_summary?: string | null
          proof_points?: Json | null
          restricted_claims?: Json | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
          valid_ctas?: Json | null
        }
        Relationships: []
      }
      campaign_adaptations: {
        Row: {
          adjustments: Json
          applied_at: string | null
          applied_changes: Json
          campaign_id: string
          created_at: string
          id: string
          patterns_observed: Json | null
          predicted_impact: string | null
          status: string
          trigger_reason: string | null
          updated_at: string
          user_id: string
          week_number: number | null
        }
        Insert: {
          adjustments?: Json
          applied_at?: string | null
          applied_changes?: Json
          campaign_id: string
          created_at?: string
          id?: string
          patterns_observed?: Json | null
          predicted_impact?: string | null
          status?: string
          trigger_reason?: string | null
          updated_at?: string
          user_id: string
          week_number?: number | null
        }
        Update: {
          adjustments?: Json
          applied_at?: string | null
          applied_changes?: Json
          campaign_id?: string
          created_at?: string
          id?: string
          patterns_observed?: Json | null
          predicted_impact?: string | null
          status?: string
          trigger_reason?: string | null
          updated_at?: string
          user_id?: string
          week_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_adaptations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_advisor_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          campaign_id: string
          created_at: string
          id: string
          question: string
          question_key: string
          severity: string
          status: string
          updated_at: string
          user_id: string
          why_it_matters: string | null
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          campaign_id: string
          created_at?: string
          id?: string
          question: string
          question_key: string
          severity?: string
          status?: string
          updated_at?: string
          user_id: string
          why_it_matters?: string | null
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          campaign_id?: string
          created_at?: string
          id?: string
          question?: string
          question_key?: string
          severity?: string
          status?: string
          updated_at?: string
          user_id?: string
          why_it_matters?: string | null
        }
        Relationships: []
      }
      campaign_blueprints: {
        Row: {
          ai_recommendations: Json | null
          audience_summary: Json | null
          business_rationale: Json | null
          campaign_id: string | null
          campaign_summary: Json | null
          content_strategy: Json | null
          conversation_id: string | null
          created_at: string | null
          cta_strategy: Json | null
          id: string
          messaging_strategy: Json | null
          status: string | null
          success_model: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_recommendations?: Json | null
          audience_summary?: Json | null
          business_rationale?: Json | null
          campaign_id?: string | null
          campaign_summary?: Json | null
          content_strategy?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          cta_strategy?: Json | null
          id?: string
          messaging_strategy?: Json | null
          status?: string | null
          success_model?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_recommendations?: Json | null
          audience_summary?: Json | null
          business_rationale?: Json | null
          campaign_id?: string | null
          campaign_summary?: Json | null
          content_strategy?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          cta_strategy?: Json | null
          id?: string
          messaging_strategy?: Json | null
          status?: string | null
          success_model?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_blueprints_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_blueprints_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "campaign_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_conversations: {
        Row: {
          blueprint_id: string | null
          collected_data: Json | null
          created_at: string | null
          current_step: string | null
          id: string
          messages: Json | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blueprint_id?: string | null
          collected_data?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          messages?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blueprint_id?: string | null
          collected_data?: Json | null
          created_at?: string | null
          current_step?: string | null
          id?: string
          messages?: Json | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversations_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "campaign_blueprints"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_post_plans: {
        Row: {
          campaign_id: string
          content_angle: string | null
          created_at: string | null
          expected_outcome: string | null
          id: string
          linked_draft_id: string | null
          linked_post_id: string | null
          missed_at: string | null
          phase: string | null
          planned_date: string | null
          post_number: number
          post_objective: string | null
          posted_at: string | null
          posted_url: string | null
          recommended_format: string | null
          status: string | null
          strategic_rationale: string | null
          suggested_cta_type: string | null
          suggested_hook_type: string | null
          suggested_tone: string | null
          updated_at: string | null
          user_id: string
          week_number: number
          week_plan_id: string | null
        }
        Insert: {
          campaign_id: string
          content_angle?: string | null
          created_at?: string | null
          expected_outcome?: string | null
          id?: string
          linked_draft_id?: string | null
          linked_post_id?: string | null
          missed_at?: string | null
          phase?: string | null
          planned_date?: string | null
          post_number: number
          post_objective?: string | null
          posted_at?: string | null
          posted_url?: string | null
          recommended_format?: string | null
          status?: string | null
          strategic_rationale?: string | null
          suggested_cta_type?: string | null
          suggested_hook_type?: string | null
          suggested_tone?: string | null
          updated_at?: string | null
          user_id: string
          week_number: number
          week_plan_id?: string | null
        }
        Update: {
          campaign_id?: string
          content_angle?: string | null
          created_at?: string | null
          expected_outcome?: string | null
          id?: string
          linked_draft_id?: string | null
          linked_post_id?: string | null
          missed_at?: string | null
          phase?: string | null
          planned_date?: string | null
          post_number?: number
          post_objective?: string | null
          posted_at?: string | null
          posted_url?: string | null
          recommended_format?: string | null
          status?: string | null
          strategic_rationale?: string | null
          suggested_cta_type?: string | null
          suggested_hook_type?: string | null
          suggested_tone?: string | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          week_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_post_plans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_post_plans_linked_draft_id_fkey"
            columns: ["linked_draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_post_plans_linked_post_id_fkey"
            columns: ["linked_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_post_plans_week_plan_id_fkey"
            columns: ["week_plan_id"]
            isOneToOne: false
            referencedRelation: "campaign_week_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_progress: {
        Row: {
          campaign_id: string
          contributing_post_ids: Json | null
          created_at: string
          current_value: number | null
          gap_analysis: string | null
          id: string
          metric_name: string
          period_end: string | null
          period_start: string | null
          target_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          contributing_post_ids?: Json | null
          created_at?: string
          current_value?: number | null
          gap_analysis?: string | null
          id?: string
          metric_name: string
          period_end?: string | null
          period_start?: string | null
          target_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          contributing_post_ids?: Json | null
          created_at?: string
          current_value?: number | null
          gap_analysis?: string | null
          id?: string
          metric_name?: string
          period_end?: string | null
          period_start?: string | null
          target_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_progress_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_reports: {
        Row: {
          campaign_id: string
          contribution_analysis: Json | null
          created_at: string | null
          cta_performance: Json | null
          generated_at: string | null
          health_status: string | null
          id: string
          outcome_progress: Json | null
          posting_progress: Json | null
          recommendations: Json | null
          report_type: string | null
          stage_performance: Json | null
          user_id: string
          weekly_trends: Json | null
        }
        Insert: {
          campaign_id: string
          contribution_analysis?: Json | null
          created_at?: string | null
          cta_performance?: Json | null
          generated_at?: string | null
          health_status?: string | null
          id?: string
          outcome_progress?: Json | null
          posting_progress?: Json | null
          recommendations?: Json | null
          report_type?: string | null
          stage_performance?: Json | null
          user_id: string
          weekly_trends?: Json | null
        }
        Update: {
          campaign_id?: string
          contribution_analysis?: Json | null
          created_at?: string | null
          cta_performance?: Json | null
          generated_at?: string | null
          health_status?: string | null
          id?: string
          outcome_progress?: Json | null
          posting_progress?: Json | null
          recommendations?: Json | null
          report_type?: string | null
          stage_performance?: Json | null
          user_id?: string
          weekly_trends?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_strategy_versions: {
        Row: {
          campaign_id: string
          created_at: string
          cta_progression: Json
          evidence_snapshot: Json
          hypotheses: Json
          id: string
          is_active: boolean
          phase_plan: Json
          reason_for_revision: string | null
          strategy_thesis: string | null
          updated_at: string
          user_id: string
          version_number: number
        }
        Insert: {
          campaign_id: string
          created_at?: string
          cta_progression?: Json
          evidence_snapshot?: Json
          hypotheses?: Json
          id?: string
          is_active?: boolean
          phase_plan?: Json
          reason_for_revision?: string | null
          strategy_thesis?: string | null
          updated_at?: string
          user_id: string
          version_number: number
        }
        Update: {
          campaign_id?: string
          created_at?: string
          cta_progression?: Json
          evidence_snapshot?: Json
          hypotheses?: Json
          id?: string
          is_active?: boolean
          phase_plan?: Json
          reason_for_revision?: string | null
          strategy_thesis?: string | null
          updated_at?: string
          user_id?: string
          version_number?: number
        }
        Relationships: []
      }
      campaign_week_plans: {
        Row: {
          audience_lens: string | null
          blueprint_id: string | null
          campaign_id: string
          created_at: string | null
          cta_strategy: string | null
          hook_styles: Json | null
          id: string
          primary_message: string | null
          recommended_formats: Json | null
          recommended_post_count: number | null
          status: string | null
          updated_at: string | null
          user_id: string
          week_number: number
          week_purpose: string | null
          weekly_goal: string | null
        }
        Insert: {
          audience_lens?: string | null
          blueprint_id?: string | null
          campaign_id: string
          created_at?: string | null
          cta_strategy?: string | null
          hook_styles?: Json | null
          id?: string
          primary_message?: string | null
          recommended_formats?: Json | null
          recommended_post_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          week_number: number
          week_purpose?: string | null
          weekly_goal?: string | null
        }
        Update: {
          audience_lens?: string | null
          blueprint_id?: string | null
          campaign_id?: string
          created_at?: string | null
          cta_strategy?: string | null
          hook_styles?: Json | null
          id?: string
          primary_message?: string | null
          recommended_formats?: Json | null
          recommended_post_count?: number | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          week_purpose?: string | null
          weekly_goal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_week_plans_blueprint_id_fkey"
            columns: ["blueprint_id"]
            isOneToOne: false
            referencedRelation: "campaign_blueprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_week_plans_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          conversion_signal_count: number | null
          core_message: string | null
          created_at: string
          cta_type: string | null
          current_goal_value: number | null
          execution_score: number | null
          execution_status: string
          goal: string | null
          goal_progress_percent: number | null
          goal_status: string | null
          goal_value_updated_at: string | null
          id: string
          intelligence_snapshot: Json
          intelligence_updated_at: string | null
          is_active: boolean | null
          language: string | null
          last_evaluated_at: string | null
          market_context_id: string | null
          name: string
          offer: string | null
          primary_objective: string | null
          primary_persona_id: string | null
          secondary_persona_id: string | null
          started_at: string | null
          strategy_strength_score: number | null
          style_authority: number | null
          style_educational: number | null
          style_product_led: number | null
          style_storytelling: number | null
          target_metric: string | null
          target_priority: string | null
          target_quantity: number | null
          target_start_date: string | null
          target_timeframe: string | null
          tone: string | null
          unattributed_goal_value: number | null
          updated_at: string
          user_id: string
          velocity_score: number | null
        }
        Insert: {
          completed_at?: string | null
          conversion_signal_count?: number | null
          core_message?: string | null
          created_at?: string
          cta_type?: string | null
          current_goal_value?: number | null
          execution_score?: number | null
          execution_status?: string
          goal?: string | null
          goal_progress_percent?: number | null
          goal_status?: string | null
          goal_value_updated_at?: string | null
          id?: string
          intelligence_snapshot?: Json
          intelligence_updated_at?: string | null
          is_active?: boolean | null
          language?: string | null
          last_evaluated_at?: string | null
          market_context_id?: string | null
          name: string
          offer?: string | null
          primary_objective?: string | null
          primary_persona_id?: string | null
          secondary_persona_id?: string | null
          started_at?: string | null
          strategy_strength_score?: number | null
          style_authority?: number | null
          style_educational?: number | null
          style_product_led?: number | null
          style_storytelling?: number | null
          target_metric?: string | null
          target_priority?: string | null
          target_quantity?: number | null
          target_start_date?: string | null
          target_timeframe?: string | null
          tone?: string | null
          unattributed_goal_value?: number | null
          updated_at?: string
          user_id: string
          velocity_score?: number | null
        }
        Update: {
          completed_at?: string | null
          conversion_signal_count?: number | null
          core_message?: string | null
          created_at?: string
          cta_type?: string | null
          current_goal_value?: number | null
          execution_score?: number | null
          execution_status?: string
          goal?: string | null
          goal_progress_percent?: number | null
          goal_status?: string | null
          goal_value_updated_at?: string | null
          id?: string
          intelligence_snapshot?: Json
          intelligence_updated_at?: string | null
          is_active?: boolean | null
          language?: string | null
          last_evaluated_at?: string | null
          market_context_id?: string | null
          name?: string
          offer?: string | null
          primary_objective?: string | null
          primary_persona_id?: string | null
          secondary_persona_id?: string | null
          started_at?: string | null
          strategy_strength_score?: number | null
          style_authority?: number | null
          style_educational?: number | null
          style_product_led?: number | null
          style_storytelling?: number | null
          target_metric?: string | null
          target_priority?: string | null
          target_quantity?: number | null
          target_start_date?: string | null
          target_timeframe?: string | null
          tone?: string | null
          unattributed_goal_value?: number | null
          updated_at?: string
          user_id?: string
          velocity_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_market_context_id_fkey"
            columns: ["market_context_id"]
            isOneToOne: false
            referencedRelation: "market_contexts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_primary_persona_id_fkey"
            columns: ["primary_persona_id"]
            isOneToOne: false
            referencedRelation: "audience_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_secondary_persona_id_fkey"
            columns: ["secondary_persona_id"]
            isOneToOne: false
            referencedRelation: "audience_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_insights: {
        Row: {
          actionable_recommendations: Json | null
          audience_strategy: Json | null
          campaign_blueprint: Json | null
          competitor_id: string | null
          confidence_layer: Json | null
          content_angles: Json | null
          content_gap_matrix: Json | null
          content_strategy_overview: Json | null
          created_at: string
          execution_plan: Json | null
          gaps: Json | null
          id: string
          market_context_id: string | null
          messaging_patterns: Json | null
          opportunity_scores: Json | null
          overused_themes: Json | null
          patterns: Json | null
          performance_insights: Json | null
          predicted_outcomes: Json | null
          strategic_opportunities: Json | null
          strengths_analysis: Json | null
          suggested_angles: Json | null
          user_id: string
          weaknesses_analysis: Json | null
          why_posts_work: Json | null
          win_strategy: Json | null
          winning_position: Json | null
        }
        Insert: {
          actionable_recommendations?: Json | null
          audience_strategy?: Json | null
          campaign_blueprint?: Json | null
          competitor_id?: string | null
          confidence_layer?: Json | null
          content_angles?: Json | null
          content_gap_matrix?: Json | null
          content_strategy_overview?: Json | null
          created_at?: string
          execution_plan?: Json | null
          gaps?: Json | null
          id?: string
          market_context_id?: string | null
          messaging_patterns?: Json | null
          opportunity_scores?: Json | null
          overused_themes?: Json | null
          patterns?: Json | null
          performance_insights?: Json | null
          predicted_outcomes?: Json | null
          strategic_opportunities?: Json | null
          strengths_analysis?: Json | null
          suggested_angles?: Json | null
          user_id: string
          weaknesses_analysis?: Json | null
          why_posts_work?: Json | null
          win_strategy?: Json | null
          winning_position?: Json | null
        }
        Update: {
          actionable_recommendations?: Json | null
          audience_strategy?: Json | null
          campaign_blueprint?: Json | null
          competitor_id?: string | null
          confidence_layer?: Json | null
          content_angles?: Json | null
          content_gap_matrix?: Json | null
          content_strategy_overview?: Json | null
          created_at?: string
          execution_plan?: Json | null
          gaps?: Json | null
          id?: string
          market_context_id?: string | null
          messaging_patterns?: Json | null
          opportunity_scores?: Json | null
          overused_themes?: Json | null
          patterns?: Json | null
          performance_insights?: Json | null
          predicted_outcomes?: Json | null
          strategic_opportunities?: Json | null
          strengths_analysis?: Json | null
          suggested_angles?: Json | null
          user_id?: string
          weaknesses_analysis?: Json | null
          why_posts_work?: Json | null
          win_strategy?: Json | null
          winning_position?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_insights_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_insights_market_context_id_fkey"
            columns: ["market_context_id"]
            isOneToOne: false
            referencedRelation: "market_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_posts: {
        Row: {
          comments: number | null
          competitor_id: string
          content: string
          created_at: string
          cta_type: string | null
          extraction_confidence: Json | null
          hook_style: string | null
          id: string
          impressions: number | null
          likes: number | null
          manual_corrections: Json | null
          original_extraction: Json | null
          post_analysis: Json | null
          post_format: string | null
          post_url: string | null
          reposts: number | null
          screenshot_url: string | null
          source_type: string
          tone: string | null
          topic: string | null
          user_id: string
          visual_summary: string | null
        }
        Insert: {
          comments?: number | null
          competitor_id: string
          content: string
          created_at?: string
          cta_type?: string | null
          extraction_confidence?: Json | null
          hook_style?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          manual_corrections?: Json | null
          original_extraction?: Json | null
          post_analysis?: Json | null
          post_format?: string | null
          post_url?: string | null
          reposts?: number | null
          screenshot_url?: string | null
          source_type?: string
          tone?: string | null
          topic?: string | null
          user_id: string
          visual_summary?: string | null
        }
        Update: {
          comments?: number | null
          competitor_id?: string
          content?: string
          created_at?: string
          cta_type?: string | null
          extraction_confidence?: Json | null
          hook_style?: string | null
          id?: string
          impressions?: number | null
          likes?: number | null
          manual_corrections?: Json | null
          original_extraction?: Json | null
          post_analysis?: Json | null
          post_format?: string | null
          post_url?: string | null
          reposts?: number | null
          screenshot_url?: string | null
          source_type?: string
          tone?: string | null
          topic?: string | null
          user_id?: string
          visual_summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_posts_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          created_at: string
          id: string
          linkedin_url: string | null
          name: string
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linkedin_url?: string | null
          name: string
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linkedin_url?: string | null
          name?: string
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_patterns: {
        Row: {
          avg_comments: number | null
          avg_engagement_rate: number | null
          avg_impressions: number | null
          avg_likes: number | null
          best_combination: Json | null
          comparative_insight: string | null
          confidence_level: string | null
          dimension: string
          dimension_value: string
          id: string
          insight: string | null
          outcome_type: string | null
          sample_count: number
          target_metric: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_comments?: number | null
          avg_engagement_rate?: number | null
          avg_impressions?: number | null
          avg_likes?: number | null
          best_combination?: Json | null
          comparative_insight?: string | null
          confidence_level?: string | null
          dimension: string
          dimension_value: string
          id?: string
          insight?: string | null
          outcome_type?: string | null
          sample_count?: number
          target_metric?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_comments?: number | null
          avg_engagement_rate?: number | null
          avg_impressions?: number | null
          avg_likes?: number | null
          best_combination?: Json | null
          comparative_insight?: string | null
          confidence_level?: string | null
          dimension?: string
          dimension_value?: string
          id?: string
          insight?: string | null
          outcome_type?: string | null
          sample_count?: number
          target_metric?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_tags: {
        Row: {
          campaign_id: string | null
          content_intent: string | null
          content_type: string | null
          created_at: string
          cta_type: string | null
          draft_id: string | null
          goal: string | null
          hook_type: string | null
          id: string
          linkedin_post_id: string | null
          persona_id: string | null
          post_id: string | null
          post_style: string | null
          publish_hour: number | null
          tone: string | null
          topic: string | null
          user_id: string
          word_count: number | null
        }
        Insert: {
          campaign_id?: string | null
          content_intent?: string | null
          content_type?: string | null
          created_at?: string
          cta_type?: string | null
          draft_id?: string | null
          goal?: string | null
          hook_type?: string | null
          id?: string
          linkedin_post_id?: string | null
          persona_id?: string | null
          post_id?: string | null
          post_style?: string | null
          publish_hour?: number | null
          tone?: string | null
          topic?: string | null
          user_id: string
          word_count?: number | null
        }
        Update: {
          campaign_id?: string | null
          content_intent?: string | null
          content_type?: string | null
          created_at?: string
          cta_type?: string | null
          draft_id?: string | null
          goal?: string | null
          hook_type?: string | null
          id?: string
          linkedin_post_id?: string | null
          persona_id?: string | null
          post_id?: string | null
          post_style?: string | null
          publish_hour?: number | null
          tone?: string | null
          topic?: string | null
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "content_tags_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: false
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "audience_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      context_chunks: {
        Row: {
          chunk_index: number
          chunk_text: string
          created_at: string
          id: string
          metadata: Json | null
          source_id: string
          user_id: string
        }
        Insert: {
          chunk_index?: number
          chunk_text: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "context_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      context_settings: {
        Row: {
          auto_extract_on_ingest: boolean
          created_at: string
          default_active_categories: Json | null
          founder_tone_weight: number
          id: string
          product_docs_weight: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_extract_on_ingest?: boolean
          created_at?: string
          default_active_categories?: Json | null
          founder_tone_weight?: number
          id?: string
          product_docs_weight?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_extract_on_ingest?: boolean
          created_at?: string
          default_active_categories?: Json | null
          founder_tone_weight?: number
          id?: string
          product_docs_weight?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      context_sources: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          ingestion_status: string
          is_active: boolean
          raw_content: string | null
          source_category: string
          source_type: string
          source_url: string | null
          tags: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          ingestion_status?: string
          is_active?: boolean
          raw_content?: string | null
          source_category?: string
          source_type?: string
          source_url?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          ingestion_status?: string
          is_active?: boolean
          raw_content?: string | null
          source_category?: string
          source_type?: string
          source_url?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      drafts: {
        Row: {
          created_at: string
          custom_content: string | null
          id: string
          idea_id: string
          scheduled_at: string | null
          selected_post_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_content?: string | null
          id?: string
          idea_id: string
          scheduled_at?: string | null
          selected_post_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_content?: string | null
          id?: string
          idea_id?: string
          scheduled_at?: string | null
          selected_post_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drafts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drafts_selected_post_id_fkey"
            columns: ["selected_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_evaluations: {
        Row: {
          created_at: string
          fulfillment_status: string | null
          full_analysis: Json | null
          goal_fulfillment_score: number | null
          id: string
          linkedin_post_id: string
          reason_summary: string | null
          strongest_factor: string | null
          updated_at: string
          user_id: string
          weakest_factor: string | null
        }
        Insert: {
          created_at?: string
          fulfillment_status?: string | null
          full_analysis?: Json | null
          goal_fulfillment_score?: number | null
          id?: string
          linkedin_post_id: string
          reason_summary?: string | null
          strongest_factor?: string | null
          updated_at?: string
          user_id: string
          weakest_factor?: string | null
        }
        Update: {
          created_at?: string
          fulfillment_status?: string | null
          full_analysis?: Json | null
          goal_fulfillment_score?: number | null
          id?: string
          linkedin_post_id?: string
          reason_summary?: string | null
          strongest_factor?: string | null
          updated_at?: string
          user_id?: string
          weakest_factor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_evaluations_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: true
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          core_message: string | null
          created_at: string
          emotional_trigger: string | null
          id: string
          idea_title: string | null
          instruction: string
          objective: string | null
          persona_fit: string | null
          resonance_reason: string | null
          suggested_cta: string | null
          target_audience: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          core_message?: string | null
          created_at?: string
          emotional_trigger?: string | null
          id?: string
          idea_title?: string | null
          instruction: string
          objective?: string | null
          persona_fit?: string | null
          resonance_reason?: string | null
          suggested_cta?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          core_message?: string | null
          created_at?: string
          emotional_trigger?: string | null
          id?: string
          idea_title?: string | null
          instruction?: string
          objective?: string | null
          persona_fit?: string | null
          resonance_reason?: string | null
          suggested_cta?: string | null
          target_audience?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_accounts: {
        Row: {
          access_token: string | null
          connection_status: string
          created_at: string
          display_name: string | null
          id: string
          last_synced_at: string | null
          linkedin_user_id: string | null
          profile_url: string | null
          refresh_token: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          linkedin_user_id?: string | null
          profile_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connection_status?: string
          created_at?: string
          display_name?: string | null
          id?: string
          last_synced_at?: string | null
          linkedin_user_id?: string | null
          profile_url?: string | null
          refresh_token?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_posts: {
        Row: {
          content: string
          created_at: string
          has_media: boolean | null
          id: string
          imported_at: string
          linked_draft_id: string | null
          linkedin_post_id: string | null
          post_url: string | null
          publish_date: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          has_media?: boolean | null
          id?: string
          imported_at?: string
          linked_draft_id?: string | null
          linkedin_post_id?: string | null
          post_url?: string | null
          publish_date?: string | null
          source_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          has_media?: boolean | null
          id?: string
          imported_at?: string
          linked_draft_id?: string | null
          linkedin_post_id?: string | null
          post_url?: string | null
          publish_date?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_posts_linked_draft_id_fkey"
            columns: ["linked_draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      market_contexts: {
        Row: {
          audience_type: string
          buyer_maturity: string
          common_customer_behaviors: Json
          common_pain_points: Json
          content_style_bias: string
          created_at: string
          id: string
          is_preset: boolean
          language_defaults: Json
          localized_examples: Json
          localized_phrases: Json
          platform_reality: Json
          preferred_cta_style: string
          primary_channels: Json
          region_code: string
          region_name: string
          sales_conversation_behavior: Json
          tone_preference: string
          trust_signals: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          audience_type?: string
          buyer_maturity?: string
          common_customer_behaviors?: Json
          common_pain_points?: Json
          content_style_bias?: string
          created_at?: string
          id?: string
          is_preset?: boolean
          language_defaults?: Json
          localized_examples?: Json
          localized_phrases?: Json
          platform_reality?: Json
          preferred_cta_style?: string
          primary_channels?: Json
          region_code: string
          region_name: string
          sales_conversation_behavior?: Json
          tone_preference?: string
          trust_signals?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          audience_type?: string
          buyer_maturity?: string
          common_customer_behaviors?: Json
          common_pain_points?: Json
          content_style_bias?: string
          created_at?: string
          id?: string
          is_preset?: boolean
          language_defaults?: Json
          localized_examples?: Json
          localized_phrases?: Json
          platform_reality?: Json
          preferred_cta_style?: string
          primary_channels?: Json
          region_code?: string
          region_name?: string
          sales_conversation_behavior?: Json
          tone_preference?: string
          trust_signals?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      post_context: {
        Row: {
          auto_mapped: boolean | null
          campaign_id: string | null
          created_at: string
          cta_type: string | null
          goal: string | null
          hook_type: string | null
          id: string
          linkedin_post_id: string
          persona_id: string | null
          strategy_type: string | null
          tone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_mapped?: boolean | null
          campaign_id?: string | null
          created_at?: string
          cta_type?: string | null
          goal?: string | null
          hook_type?: string | null
          id?: string
          linkedin_post_id: string
          persona_id?: string | null
          strategy_type?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_mapped?: boolean | null
          campaign_id?: string | null
          created_at?: string
          cta_type?: string | null
          goal?: string | null
          hook_type?: string | null
          id?: string
          linkedin_post_id?: string
          persona_id?: string | null
          strategy_type?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_context_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_context_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: true
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_context_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "audience_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      post_metrics: {
        Row: {
          attribution_note: string | null
          clicks: number | null
          comments: number | null
          created_at: string
          follower_gain: number | null
          goal_contribution: number | null
          goal_metric: string | null
          id: string
          impressions: number | null
          last_updated_at: string
          linkedin_post_id: string
          manual_notes: string | null
          profile_visits: number | null
          reactions: number | null
          reposts: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attribution_note?: string | null
          clicks?: number | null
          comments?: number | null
          created_at?: string
          follower_gain?: number | null
          goal_contribution?: number | null
          goal_metric?: string | null
          id?: string
          impressions?: number | null
          last_updated_at?: string
          linkedin_post_id: string
          manual_notes?: string | null
          profile_visits?: number | null
          reactions?: number | null
          reposts?: number | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attribution_note?: string | null
          clicks?: number | null
          comments?: number | null
          created_at?: string
          follower_gain?: number | null
          goal_contribution?: number | null
          goal_metric?: string | null
          id?: string
          impressions?: number | null
          last_updated_at?: string
          linkedin_post_id?: string
          manual_notes?: string | null
          profile_visits?: number | null
          reactions?: number | null
          reposts?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_metrics_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: true
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_performance: {
        Row: {
          comments: number
          created_at: string
          draft_id: string
          id: string
          impressions: number
          likes: number
          profile_visits: number
          saves: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comments?: number
          created_at?: string
          draft_id: string
          id?: string
          impressions?: number
          likes?: number
          profile_visits?: number
          saves?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comments?: number
          created_at?: string
          draft_id?: string
          id?: string
          impressions?: number
          likes?: number
          profile_visits?: number
          saves?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_performance_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: true
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_recommendations: {
        Row: {
          created_at: string
          id: string
          improved_angles: string[] | null
          improved_ctas: string[] | null
          improved_hooks: string[] | null
          linkedin_post_id: string
          strategy_suggestion: string | null
          updated_at: string
          user_id: string
          what_to_avoid: string[] | null
          what_to_repeat: string[] | null
        }
        Insert: {
          created_at?: string
          id?: string
          improved_angles?: string[] | null
          improved_ctas?: string[] | null
          improved_hooks?: string[] | null
          linkedin_post_id: string
          strategy_suggestion?: string | null
          updated_at?: string
          user_id: string
          what_to_avoid?: string[] | null
          what_to_repeat?: string[] | null
        }
        Update: {
          created_at?: string
          id?: string
          improved_angles?: string[] | null
          improved_ctas?: string[] | null
          improved_hooks?: string[] | null
          linkedin_post_id?: string
          strategy_suggestion?: string | null
          updated_at?: string
          user_id?: string
          what_to_avoid?: string[] | null
          what_to_repeat?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "post_recommendations_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: true
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_signals: {
        Row: {
          ai_evaluation: Json | null
          campaign_id: string | null
          clicks: number | null
          comment_quality: string | null
          conversion_intent: string | null
          conversion_signal_score: number | null
          created_at: string
          cta_type: string | null
          draft_id: string | null
          engagement: number | null
          format: string | null
          hook_type: string | null
          id: string
          impressions: number | null
          linkedin_post_id: string | null
          phase: string | null
          post_plan_id: string | null
          post_style: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_evaluation?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          comment_quality?: string | null
          conversion_intent?: string | null
          conversion_signal_score?: number | null
          created_at?: string
          cta_type?: string | null
          draft_id?: string | null
          engagement?: number | null
          format?: string | null
          hook_type?: string | null
          id?: string
          impressions?: number | null
          linkedin_post_id?: string | null
          phase?: string | null
          post_plan_id?: string | null
          post_style?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_evaluation?: Json | null
          campaign_id?: string | null
          clicks?: number | null
          comment_quality?: string | null
          conversion_intent?: string | null
          conversion_signal_score?: number | null
          created_at?: string
          cta_type?: string | null
          draft_id?: string | null
          engagement?: number | null
          format?: string | null
          hook_type?: string | null
          id?: string
          impressions?: number | null
          linkedin_post_id?: string | null
          phase?: string | null
          post_plan_id?: string | null
          post_style?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_signals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_signals_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_signals_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: false
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_signals_post_plan_id_fkey"
            columns: ["post_plan_id"]
            isOneToOne: false
            referencedRelation: "campaign_post_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          campaign_id: string | null
          content_intent: string | null
          created_at: string
          cta: string
          first_comment: string | null
          hook: string
          hook_type: string | null
          id: string
          idea_id: string
          image_briefs: Json | null
          market_context_id: string | null
          persona_id: string | null
          post_style: string
          post_type: string
          tone: string | null
          updated_at: string
          user_id: string
          variation_number: number
        }
        Insert: {
          body: string
          campaign_id?: string | null
          content_intent?: string | null
          created_at?: string
          cta: string
          first_comment?: string | null
          hook: string
          hook_type?: string | null
          id?: string
          idea_id: string
          image_briefs?: Json | null
          market_context_id?: string | null
          persona_id?: string | null
          post_style: string
          post_type?: string
          tone?: string | null
          updated_at?: string
          user_id: string
          variation_number: number
        }
        Update: {
          body?: string
          campaign_id?: string | null
          content_intent?: string | null
          created_at?: string
          cta?: string
          first_comment?: string | null
          hook?: string
          hook_type?: string | null
          id?: string
          idea_id?: string
          image_briefs?: Json | null
          market_context_id?: string | null
          persona_id?: string | null
          post_style?: string
          post_type?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
          variation_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "posts_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_market_context_id_fkey"
            columns: ["market_context_id"]
            isOneToOne: false
            referencedRelation: "market_contexts"
            referencedColumns: ["id"]
          },
        ]
      }
      prediction_scores: {
        Row: {
          action_potential: number | null
          attention_potential: number | null
          clarity: number | null
          context_relevance: number | null
          created_at: string
          cta_alignment: number | null
          draft_id: string | null
          engagement_potential: number | null
          failure_reasons: Json | null
          goal_alignment: number | null
          goal_fit_score: number | null
          historical_comparison: string | null
          hook_strength: number | null
          id: string
          improved_ctas: Json | null
          improved_hooks: Json | null
          outcome_potential: number | null
          outcome_probability: number | null
          persona_relevance: number | null
          predicted_score: number | null
          publish_recommendation: string | null
          risk_level: string | null
          stage_breakdown: Json | null
          strongest_element: string | null
          suggestions: Json | null
          target_metric: string | null
          target_quantity: number | null
          user_id: string
          weak_stage: string | null
          weakest_element: string | null
        }
        Insert: {
          action_potential?: number | null
          attention_potential?: number | null
          clarity?: number | null
          context_relevance?: number | null
          created_at?: string
          cta_alignment?: number | null
          draft_id?: string | null
          engagement_potential?: number | null
          failure_reasons?: Json | null
          goal_alignment?: number | null
          goal_fit_score?: number | null
          historical_comparison?: string | null
          hook_strength?: number | null
          id?: string
          improved_ctas?: Json | null
          improved_hooks?: Json | null
          outcome_potential?: number | null
          outcome_probability?: number | null
          persona_relevance?: number | null
          predicted_score?: number | null
          publish_recommendation?: string | null
          risk_level?: string | null
          stage_breakdown?: Json | null
          strongest_element?: string | null
          suggestions?: Json | null
          target_metric?: string | null
          target_quantity?: number | null
          user_id: string
          weak_stage?: string | null
          weakest_element?: string | null
        }
        Update: {
          action_potential?: number | null
          attention_potential?: number | null
          clarity?: number | null
          context_relevance?: number | null
          created_at?: string
          cta_alignment?: number | null
          draft_id?: string | null
          engagement_potential?: number | null
          failure_reasons?: Json | null
          goal_alignment?: number | null
          goal_fit_score?: number | null
          historical_comparison?: string | null
          hook_strength?: number | null
          id?: string
          improved_ctas?: Json | null
          improved_hooks?: Json | null
          outcome_potential?: number | null
          outcome_probability?: number | null
          persona_relevance?: number | null
          predicted_score?: number | null
          publish_recommendation?: string | null
          risk_level?: string | null
          stage_breakdown?: Json | null
          strongest_element?: string | null
          suggestions?: Json | null
          target_metric?: string | null
          target_quantity?: number | null
          user_id?: string
          weak_stage?: string | null
          weakest_element?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_scores_draft_id_fkey"
            columns: ["draft_id"]
            isOneToOne: false
            referencedRelation: "drafts"
            referencedColumns: ["id"]
          },
        ]
      }
      strategy_recommendations: {
        Row: {
          confidence: number | null
          created_at: string
          gap_analysis: Json | null
          id: string
          recommendation: Json
          status: string
          user_id: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          gap_analysis?: Json | null
          id?: string
          recommendation?: Json
          status?: string
          user_id: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          gap_analysis?: Json | null
          id?: string
          recommendation?: Json
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          posts_synced: number | null
          started_at: string
          status: string
          sync_type: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          posts_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          posts_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          user_id?: string
        }
        Relationships: []
      }
      writing_diagnoses: {
        Row: {
          content_analysis: Json | null
          created_at: string
          cta_analysis: Json | null
          hook_analysis: Json | null
          id: string
          linkedin_post_id: string
          structure_analysis: Json | null
          updated_at: string
          user_id: string
          what_to_change: string[] | null
          what_weakened: string[] | null
          what_worked: string[] | null
        }
        Insert: {
          content_analysis?: Json | null
          created_at?: string
          cta_analysis?: Json | null
          hook_analysis?: Json | null
          id?: string
          linkedin_post_id: string
          structure_analysis?: Json | null
          updated_at?: string
          user_id: string
          what_to_change?: string[] | null
          what_weakened?: string[] | null
          what_worked?: string[] | null
        }
        Update: {
          content_analysis?: Json | null
          created_at?: string
          cta_analysis?: Json | null
          hook_analysis?: Json | null
          id?: string
          linkedin_post_id?: string
          structure_analysis?: Json | null
          updated_at?: string
          user_id?: string
          what_to_change?: string[] | null
          what_weakened?: string[] | null
          what_worked?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "writing_diagnoses_linkedin_post_id_fkey"
            columns: ["linkedin_post_id"]
            isOneToOne: true
            referencedRelation: "linkedin_posts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
