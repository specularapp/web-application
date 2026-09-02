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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      billing_events: {
        Row: {
          id: string
          organization_id: string | null
          payload: Json | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          organization_id?: string | null
          payload?: Json | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          organization_id?: string | null
          payload?: Json | null
          received_at?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_plans: {
        Row: {
          code: Database["public"]["Enums"]["billing_plan"]
          created_at: string
          is_paid: boolean
          name: string
          tier: number
          trial_days: number
          trial_requires_payment_method: boolean
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["billing_plan"]
          created_at?: string
          is_paid?: boolean
          name: string
          tier: number
          trial_days?: number
          trial_requires_payment_method?: boolean
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["billing_plan"]
          created_at?: string
          is_paid?: boolean
          name?: string
          tier?: number
          trial_days?: number
          trial_requires_payment_method?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      billing_prices: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          cycle: Database["public"]["Enums"]["billing_cycle"]
          plan: Database["public"]["Enums"]["billing_plan"]
          stripe_price_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          cycle: Database["public"]["Enums"]["billing_cycle"]
          plan: Database["public"]["Enums"]["billing_plan"]
          stripe_price_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          cycle?: Database["public"]["Enums"]["billing_cycle"]
          plan?: Database["public"]["Enums"]["billing_plan"]
          stripe_price_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_prices_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      billing_trials: {
        Row: {
          ends_at: string
          organization_id: string
          plan: Database["public"]["Enums"]["billing_plan"]
          started_at: string
        }
        Insert: {
          ends_at: string
          organization_id: string
          plan: Database["public"]["Enums"]["billing_plan"]
          started_at?: string
        }
        Update: {
          ends_at?: string
          organization_id?: string
          plan?: Database["public"]["Enums"]["billing_plan"]
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_trials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_trials_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          name: string | null
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          name?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_subscriptions: {
        Row: {
          amount_cents: number | null
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          cycle: Database["public"]["Enums"]["billing_cycle"] | null
          organization_id: string
          payment_brand: string | null
          payment_last4: string | null
          plan: Database["public"]["Enums"]["billing_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          organization_id: string
          payment_brand?: string | null
          payment_last4?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number | null
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          cycle?: Database["public"]["Enums"]["billing_cycle"] | null
          organization_id?: string
          payment_brand?: string | null
          payment_last4?: string | null
          plan?: Database["public"]["Enums"]["billing_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_subscriptions_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      organizations: {
        Row: {
          banner_url: string | null
          created_at: string
          created_by: string | null
          id: string
          industry: Database["public"]["Enums"]["organization_industry"] | null
          kind: Database["public"]["Enums"]["organization_kind"]
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          slug: string
          updated_at: string
          website: string | null
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["organization_industry"] | null
          kind?: Database["public"]["Enums"]["organization_kind"]
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          slug: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["organization_industry"] | null
          kind?: Database["public"]["Enums"]["organization_kind"]
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          slug?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          limit_value: number | null
          plan: Database["public"]["Enums"]["billing_plan"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          limit_value?: number | null
          plan: Database["public"]["Enums"]["billing_plan"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          limit_value?: number | null
          plan?: Database["public"]["Enums"]["billing_plan"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_feature_key_fkey"
            columns: ["feature_key"]
            isOneToOne: false
            referencedRelation: "plan_features"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "billing_plans"
            referencedColumns: ["code"]
          },
        ]
      }
      plan_features: {
        Row: {
          created_at: string
          description: string | null
          key: string
          kind: Database["public"]["Enums"]["plan_feature_kind"]
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          key: string
          kind: Database["public"]["Enums"]["plan_feature_kind"]
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          key?: string
          kind?: Database["public"]["Enums"]["plan_feature_kind"]
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_organization_id: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_organization_id_fkey"
            columns: ["current_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { p_token: string }; Returns: string }
      attach_billing_customer: {
        Args: { p_organization_id: string; p_stripe_customer_id: string }
        Returns: string
      }
      can_manage_billing: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      can_manage_logo: { Args: { p_name: string }; Returns: boolean }
      complete_onboarding: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      create_invite: {
        Args: {
          p_email: string
          p_name?: string
          p_organization_id: string
          p_role?: Database["public"]["Enums"]["member_role"]
        }
        Returns: string
      }
      current_org: { Args: never; Returns: string }
      current_plan: {
        Args: never
        Returns: Database["public"]["Enums"]["billing_plan"]
      }
      has_role: {
        Args: {
          p_organization_id: string
          p_roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { p_organization_id: string }; Returns: boolean }
      mfa_satisfied: { Args: never; Returns: boolean }
      organization_plan: {
        Args: { p_organization_id: string }
        Returns: Database["public"]["Enums"]["billing_plan"]
      }
      plan_allows: {
        Args: { p_feature_key: string; p_organization_id: string }
        Returns: boolean
      }
      plan_at_least: {
        Args: {
          p_organization_id: string
          p_plan: Database["public"]["Enums"]["billing_plan"]
        }
        Returns: boolean
      }
      plan_feature_kind_of: {
        Args: { p_feature_key: string }
        Returns: Database["public"]["Enums"]["plan_feature_kind"]
      }
      plan_limit: {
        Args: { p_feature_key: string; p_organization_id: string }
        Returns: number
      }
      plan_tier: {
        Args: { p_plan: Database["public"]["Enums"]["billing_plan"] }
        Returns: number
      }
      plan_within_limit: {
        Args: {
          p_count: number
          p_feature_key: string
          p_organization_id: string
        }
        Returns: boolean
      }
      set_current_org: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      shares_org_with: { Args: { p_user_id: string }; Returns: boolean }
      sync_subscription: {
        Args: {
          p_amount_cents?: number
          p_cancel_at_period_end: boolean
          p_canceled_at: string
          p_currency?: string
          p_current_period_end: string
          p_current_period_start: string
          p_cycle: Database["public"]["Enums"]["billing_cycle"]
          p_organization_id: string
          p_payment_brand?: string
          p_payment_last4?: string
          p_plan: Database["public"]["Enums"]["billing_plan"]
          p_status: Database["public"]["Enums"]["subscription_status"]
          p_stripe_customer_id: string
          p_stripe_price_id: string
          p_stripe_subscription_id: string
          p_trial_end: string
          p_trial_start: string
        }
        Returns: undefined
      }
      team_members: {
        Args: { p_organization_id: string }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          name: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }[]
      }
      trial_available: {
        Args: {
          p_organization_id: string
          p_plan: Database["public"]["Enums"]["billing_plan"]
        }
        Returns: boolean
      }
    }
    Enums: {
      billing_cycle: "monthly" | "yearly"
      billing_plan: "free" | "pro" | "alliance"
      member_role: "owner" | "admin" | "member"
      organization_industry:
        | "web_development"
        | "mobile_development"
        | "product_design"
        | "brand_design"
        | "design_and_development"
        | "other"
      organization_kind: "freelancer" | "agency"
      plan_feature_kind: "flag" | "limit"
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      billing_cycle: ["monthly", "yearly"],
      billing_plan: ["free", "pro", "alliance"],
      member_role: ["owner", "admin", "member"],
      organization_industry: [
        "web_development",
        "mobile_development",
        "product_design",
        "brand_design",
        "design_and_development",
        "other",
      ],
      organization_kind: ["freelancer", "agency"],
      plan_feature_kind: ["flag", "limit"],
      subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
  },
} as const
