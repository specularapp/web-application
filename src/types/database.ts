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
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          files: Json
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["ai_role"]
          sources: Json
          state: Database["public"]["Enums"]["ai_answer_state"] | null
          steps: Json
          voice_seconds: number | null
          voice_url: string | null
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          files?: Json
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["ai_role"]
          sources?: Json
          state?: Database["public"]["Enums"]["ai_answer_state"] | null
          steps?: Json
          voice_seconds?: number | null
          voice_url?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          files?: Json
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["ai_role"]
          sources?: Json
          state?: Database["public"]["Enums"]["ai_answer_state"] | null
          steps?: Json
          voice_seconds?: number | null
          voice_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          organization_id: string
          period_start: string
          updated_at: string
          used: number
        }
        Insert: {
          organization_id: string
          period_start: string
          updated_at?: string
          used?: number
        }
        Update: {
          organization_id?: string
          period_start?: string
          updated_at?: string
          used?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          at: string
          automation_id: string
          created_at: string
          id: string
          mode: Database["public"]["Enums"]["automation_run_mode"]
          organization_id: string
          status: Database["public"]["Enums"]["automation_run_status"]
          steps: Json
          trigger_label: string
        }
        Insert: {
          at?: string
          automation_id: string
          created_at?: string
          id?: string
          mode: Database["public"]["Enums"]["automation_run_mode"]
          organization_id: string
          status: Database["public"]["Enums"]["automation_run_status"]
          steps?: Json
          trigger_label: string
        }
        Update: {
          at?: string
          automation_id?: string
          created_at?: string
          id?: string
          mode?: Database["public"]["Enums"]["automation_run_mode"]
          organization_id?: string
          status?: Database["public"]["Enums"]["automation_run_status"]
          steps?: Json
          trigger_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          edges: Json
          id: string
          last_run_at: string | null
          name: string
          nodes: Json
          organization_id: string
          run_count: number
          status: Database["public"]["Enums"]["automation_status"]
          template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          edges?: Json
          id?: string
          last_run_at?: string | null
          name: string
          nodes?: Json
          organization_id: string
          run_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          edges?: Json
          id?: string
          last_run_at?: string | null
          name?: string
          nodes?: Json
          organization_id?: string
          run_count?: number
          status?: Database["public"]["Enums"]["automation_status"]
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
      catalog_items: {
        Row: {
          active: boolean
          category: string
          cost: number | null
          created_at: string
          created_by: string | null
          deliverables: string[]
          description: string
          duration_max: number | null
          duration_min: number | null
          hue: Database["public"]["Enums"]["palette_hue"]
          id: string
          image_url: string | null
          kind: Database["public"]["Enums"]["catalog_kind"]
          max_discount: number
          name: string
          notes: string | null
          organization_id: string
          price: number
          reference: string
          requirements: string[]
          revisions: number | null
          stock_capacity: number | null
          stock_minimum: number | null
          stock_quantity: number | null
          support_days: number | null
          tags: string[]
          unit: Database["public"]["Enums"]["catalog_unit"]
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deliverables?: string[]
          description?: string
          duration_max?: number | null
          duration_min?: number | null
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          image_url?: string | null
          kind: Database["public"]["Enums"]["catalog_kind"]
          max_discount?: number
          name: string
          notes?: string | null
          organization_id: string
          price: number
          reference?: string
          requirements?: string[]
          revisions?: number | null
          stock_capacity?: number | null
          stock_minimum?: number | null
          stock_quantity?: number | null
          support_days?: number | null
          tags?: string[]
          unit: Database["public"]["Enums"]["catalog_unit"]
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          cost?: number | null
          created_at?: string
          created_by?: string | null
          deliverables?: string[]
          description?: string
          duration_max?: number | null
          duration_min?: number | null
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          image_url?: string | null
          kind?: Database["public"]["Enums"]["catalog_kind"]
          max_discount?: number
          name?: string
          notes?: string | null
          organization_id?: string
          price?: number
          reference?: string
          requirements?: string[]
          revisions?: number | null
          stock_capacity?: number | null
          stock_minimum?: number | null
          stock_quantity?: number | null
          support_days?: number | null
          tags?: string[]
          unit?: Database["public"]["Enums"]["catalog_unit"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_events: {
        Row: {
          actor: string | null
          at: string
          charge_id: string
          detail: string | null
          id: string
          kind: Database["public"]["Enums"]["charge_event_kind"]
          organization_id: string
        }
        Insert: {
          actor?: string | null
          at?: string
          charge_id: string
          detail?: string | null
          id?: string
          kind: Database["public"]["Enums"]["charge_event_kind"]
          organization_id: string
        }
        Update: {
          actor?: string | null
          at?: string
          charge_id?: string
          detail?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["charge_event_kind"]
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      charge_installments: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          due_date: string
          id: string
          number: number
          organization_id: string
          paid_at: string | null
          paid_method: Database["public"]["Enums"]["payment_method"] | null
          reported: boolean
          transaction_id: string | null
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          due_date: string
          id?: string
          number: number
          organization_id: string
          paid_at?: string | null
          paid_method?: Database["public"]["Enums"]["payment_method"] | null
          reported?: boolean
          transaction_id?: string | null
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          due_date?: string
          id?: string
          number?: number
          organization_id?: string
          paid_at?: string | null
          paid_method?: Database["public"]["Enums"]["payment_method"] | null
          reported?: boolean
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_installments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_installments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          cancelled_at: string | null
          client_avatar_url: string | null
          client_company: string | null
          client_email: string | null
          client_id: string | null
          client_name: string | null
          contract_id: string | null
          created_at: string
          description: string
          direction: Database["public"]["Enums"]["charge_direction"]
          id: string
          image_url: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string
          organization_id: string
          owner_id: string | null
          payment_info: string
          project_id: string | null
          quote_id: string | null
          recurrence: Database["public"]["Enums"]["charge_recurrence"]
          recurring_from_id: string | null
          reference: string
          sent_at: string | null
          title: string
          token_hash: string
          token_version: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          amount: number
          cancelled_at?: string | null
          client_avatar_url?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["charge_direction"]
          id?: string
          image_url?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string
          organization_id: string
          owner_id?: string | null
          payment_info?: string
          project_id?: string | null
          quote_id?: string | null
          recurrence?: Database["public"]["Enums"]["charge_recurrence"]
          recurring_from_id?: string | null
          reference?: string
          sent_at?: string | null
          title: string
          token_hash: string
          token_version?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          amount?: number
          cancelled_at?: string | null
          client_avatar_url?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string | null
          contract_id?: string | null
          created_at?: string
          description?: string
          direction?: Database["public"]["Enums"]["charge_direction"]
          id?: string
          image_url?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string
          organization_id?: string
          owner_id?: string | null
          payment_info?: string
          project_id?: string | null
          quote_id?: string | null
          recurrence?: Database["public"]["Enums"]["charge_recurrence"]
          recurring_from_id?: string | null
          reference?: string
          sent_at?: string | null
          title?: string
          token_hash?: string
          token_version?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charges_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_recurring_from_id_fkey"
            columns: ["recurring_from_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          about: string | null
          active: boolean
          avatar_url: string | null
          city: string | null
          company: string | null
          company_logo_url: string | null
          created_at: string
          created_by: string | null
          email: string | null
          favorite: boolean
          id: string
          name: string
          organization_id: string
          phone: string | null
          reference: string
          role: string | null
          tags: string[]
          updated_at: string
          website: string | null
        }
        Insert: {
          about?: string | null
          active?: boolean
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          reference?: string
          role?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Update: {
          about?: string | null
          active?: boolean
          avatar_url?: string | null
          city?: string | null
          company?: string | null
          company_logo_url?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          favorite?: boolean
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          reference?: string
          role?: string | null
          tags?: string[]
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_events: {
        Row: {
          actor: string | null
          at: string
          contract_id: string
          id: string
          kind: Database["public"]["Enums"]["contract_event_kind"]
          organization_id: string
        }
        Insert: {
          actor?: string | null
          at?: string
          contract_id: string
          id?: string
          kind: Database["public"]["Enums"]["contract_event_kind"]
          organization_id: string
        }
        Update: {
          actor?: string | null
          at?: string
          contract_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["contract_event_kind"]
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_events_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_parties: {
        Row: {
          avatar_url: string | null
          contract_id: string
          created_at: string
          email: string
          id: string
          name: string
          organization_id: string
          position: number
          role: Database["public"]["Enums"]["contract_party_role"]
          signature_url: string | null
          signed_at: string | null
          token_hash: string
          token_version: number
          viewed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          contract_id: string
          created_at?: string
          email: string
          id?: string
          name: string
          organization_id: string
          position?: number
          role: Database["public"]["Enums"]["contract_party_role"]
          signature_url?: string | null
          signed_at?: string | null
          token_hash: string
          token_version?: number
          viewed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          contract_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          role?: Database["public"]["Enums"]["contract_party_role"]
          signature_url?: string | null
          signed_at?: string | null
          token_hash?: string
          token_version?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_parties_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_parties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_signature_fields: {
        Row: {
          contract_id: string
          created_at: string
          height: number
          id: string
          organization_id: string
          page: number
          party_id: string
          width: number
          x: number
          y: number
        }
        Insert: {
          contract_id: string
          created_at?: string
          height: number
          id?: string
          organization_id: string
          page: number
          party_id: string
          width: number
          x: number
          y: number
        }
        Update: {
          contract_id?: string
          created_at?: string
          height?: number
          id?: string
          organization_id?: string
          page?: number
          party_id?: string
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "contract_signature_fields_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signature_fields_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_signature_fields_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "contract_parties"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number | null
          body: Json | null
          cancelled_at: string | null
          client_id: string | null
          created_at: string
          description: string
          expires_at: string | null
          expires_in_days: number
          file_name: string | null
          file_pages: number | null
          file_path: string | null
          file_size: number | null
          id: string
          kind: Database["public"]["Enums"]["contract_kind"]
          organization_id: string
          owner_id: string | null
          project_id: string | null
          quote_id: string | null
          reference: string
          sent_at: string | null
          signed_at: string | null
          source: Database["public"]["Enums"]["contract_source"]
          status: Database["public"]["Enums"]["contract_status"]
          template_id: string | null
          theme: Database["public"]["Enums"]["contract_theme"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          body?: Json | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          expires_in_days?: number
          file_name?: string | null
          file_pages?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["contract_kind"]
          organization_id: string
          owner_id?: string | null
          project_id?: string | null
          quote_id?: string | null
          reference?: string
          sent_at?: string | null
          signed_at?: string | null
          source: Database["public"]["Enums"]["contract_source"]
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          theme?: Database["public"]["Enums"]["contract_theme"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          body?: Json | null
          cancelled_at?: string | null
          client_id?: string | null
          created_at?: string
          description?: string
          expires_at?: string | null
          expires_in_days?: number
          file_name?: string | null
          file_pages?: number | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["contract_kind"]
          organization_id?: string
          owner_id?: string | null
          project_id?: string | null
          quote_id?: string | null
          reference?: string
          sent_at?: string | null
          signed_at?: string | null
          source?: Database["public"]["Enums"]["contract_source"]
          status?: Database["public"]["Enums"]["contract_status"]
          template_id?: string | null
          theme?: Database["public"]["Enums"]["contract_theme"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "crm_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funnels: {
        Row: {
          created_at: string
          folder_id: string | null
          glyph: Database["public"]["Enums"]["funnel_glyph"]
          hue: Database["public"]["Enums"]["palette_hue"]
          id: string
          name: string
          organization_id: string
          position: number
          reference: string
          slug: string
          stages: Database["public"]["Enums"]["crm_stage"][]
          updated_at: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          glyph?: Database["public"]["Enums"]["funnel_glyph"]
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          name: string
          organization_id: string
          position?: number
          reference?: string
          slug: string
          stages?: Database["public"]["Enums"]["crm_stage"][]
          updated_at?: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          glyph?: Database["public"]["Enums"]["funnel_glyph"]
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          name?: string
          organization_id?: string
          position?: number
          reference?: string
          slug?: string
          stages?: Database["public"]["Enums"]["crm_stage"][]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_funnels_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "crm_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_funnels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_settings: {
        Row: {
          opening_balance: number
          organization_id: string
          updated_at: string
        }
        Insert: {
          opening_balance?: number
          organization_id: string
          updated_at?: string
        }
        Update: {
          opening_balance?: number
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      gamification_days: {
        Row: {
          accesses: number
          day: string
          online_minutes: number
          user_id: string
        }
        Insert: {
          accesses?: number
          day: string
          online_minutes?: number
          user_id: string
        }
        Update: {
          accesses?: number
          day?: string
          online_minutes?: number
          user_id?: string
        }
        Relationships: []
      }
      gamification_profiles: {
        Row: {
          bonus_claimed_on: string | null
          created_at: string
          points: number
          since: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_claimed_on?: string | null
          created_at?: string
          points?: number
          since?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_claimed_on?: string | null
          created_at?: string
          points?: number
          since?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_href: string | null
          action_label: string | null
          actor_avatar_url: string | null
          actor_name: string | null
          created_at: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          action_href?: string | null
          action_label?: string | null
          actor_avatar_url?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          organization_id: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          action_href?: string | null
          action_label?: string | null
          actor_avatar_url?: string | null
          actor_name?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          organization_id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          activity: number
          attachments: number
          attribution: Json
          average_response_minutes: number | null
          city: string | null
          client_avatar_url: string | null
          client_company: string | null
          client_id: string | null
          client_name: string
          closed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string
          entered_at: string
          expected_at: string | null
          first_response_minutes: number | null
          funnel_id: string | null
          id: string
          last_touch_at: string | null
          next_step_at: string | null
          next_step_label: string | null
          organization_id: string
          owner_id: string | null
          partner_code: string | null
          probability: number
          quote_id: string | null
          reference: string
          source: Database["public"]["Enums"]["opportunity_source"]
          stage: Database["public"]["Enums"]["crm_stage"]
          stage_since: string
          state: string | null
          tags: string[]
          temperature: Database["public"]["Enums"]["opportunity_temperature"]
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          activity?: number
          attachments?: number
          attribution?: Json
          average_response_minutes?: number | null
          city?: string | null
          client_avatar_url?: string | null
          client_company?: string | null
          client_id?: string | null
          client_name: string
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          entered_at?: string
          expected_at?: string | null
          first_response_minutes?: number | null
          funnel_id?: string | null
          id?: string
          last_touch_at?: string | null
          next_step_at?: string | null
          next_step_label?: string | null
          organization_id: string
          owner_id?: string | null
          partner_code?: string | null
          probability?: number
          quote_id?: string | null
          reference?: string
          source?: Database["public"]["Enums"]["opportunity_source"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          stage_since?: string
          state?: string | null
          tags?: string[]
          temperature?: Database["public"]["Enums"]["opportunity_temperature"]
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          activity?: number
          attachments?: number
          attribution?: Json
          average_response_minutes?: number | null
          city?: string | null
          client_avatar_url?: string | null
          client_company?: string | null
          client_id?: string | null
          client_name?: string
          closed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          entered_at?: string
          expected_at?: string | null
          first_response_minutes?: number | null
          funnel_id?: string | null
          id?: string
          last_touch_at?: string | null
          next_step_at?: string | null
          next_step_label?: string | null
          organization_id?: string
          owner_id?: string | null
          partner_code?: string | null
          probability?: number
          quote_id?: string | null
          reference?: string
          source?: Database["public"]["Enums"]["opportunity_source"]
          stage?: Database["public"]["Enums"]["crm_stage"]
          stage_since?: string
          state?: string | null
          tags?: string[]
          temperature?: Database["public"]["Enums"]["opportunity_temperature"]
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "crm_funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_people: {
        Row: {
          created_at: string
          opportunity_id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          opportunity_id: string
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          opportunity_id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_people_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
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
          archived_at: string | null
          banner_url: string | null
          city: string | null
          created_at: string
          created_by: string | null
          custom_domain: string | null
          custom_domain_verified_at: string | null
          email: string | null
          id: string
          industry: Database["public"]["Enums"]["organization_industry"] | null
          kind: Database["public"]["Enums"]["organization_kind"]
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          phone: string | null
          slug: string
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          archived_at?: string | null
          banner_url?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          email?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["organization_industry"] | null
          kind?: Database["public"]["Enums"]["organization_kind"]
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          phone?: string | null
          slug: string
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          archived_at?: string | null
          banner_url?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          custom_domain?: string | null
          custom_domain_verified_at?: string | null
          email?: string | null
          id?: string
          industry?: Database["public"]["Enums"]["organization_industry"] | null
          kind?: Database["public"]["Enums"]["organization_kind"]
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          phone?: string | null
          slug?: string
          state?: string | null
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
          bio: string | null
          created_at: string
          current_organization_id: string | null
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          links: Json
          location: string | null
          resume_public: boolean
          resume_slug: string | null
          skills: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          links?: Json
          location?: string | null
          resume_public?: boolean
          resume_slug?: string | null
          skills?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_organization_id?: string | null
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          links?: Json
          location?: string | null
          resume_public?: boolean
          resume_slug?: string | null
          skills?: string[]
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
      project_events: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          id: string
          organization_id: string
          project_id: string
          task_title: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          id?: string
          organization_id: string
          project_id: string
          task_title?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          id?: string
          organization_id?: string
          project_id?: string
          task_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          created_at: string
          organization_id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          client_id: string | null
          cover_url: string | null
          created_at: string
          description: string
          due_at: string | null
          folder_id: string | null
          glyph: Database["public"]["Enums"]["project_glyph"]
          hue: Database["public"]["Enums"]["palette_hue"]
          id: string
          is_public: boolean
          logo_url: string | null
          name: string
          organization_id: string
          owner_id: string | null
          progress: number
          reference: string
          slug: string
          stages: Database["public"]["Enums"]["task_stage"][]
          started_at: string
          status: Database["public"]["Enums"]["project_status"]
          tags: string[]
          tools: Database["public"]["Enums"]["project_tool"][]
          updated_at: string
          url: string | null
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          folder_id?: string | null
          glyph?: Database["public"]["Enums"]["project_glyph"]
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name: string
          organization_id: string
          owner_id?: string | null
          progress?: number
          reference?: string
          slug: string
          stages?: Database["public"]["Enums"]["task_stage"][]
          started_at?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          tools?: Database["public"]["Enums"]["project_tool"][]
          updated_at?: string
          url?: string | null
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          client_id?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string
          due_at?: string | null
          folder_id?: string | null
          glyph?: Database["public"]["Enums"]["project_glyph"]
          hue?: Database["public"]["Enums"]["palette_hue"]
          id?: string
          is_public?: boolean
          logo_url?: string | null
          name?: string
          organization_id?: string
          owner_id?: string | null
          progress?: number
          reference?: string
          slug?: string
          stages?: Database["public"]["Enums"]["task_stage"][]
          started_at?: string
          status?: Database["public"]["Enums"]["project_status"]
          tags?: string[]
          tools?: Database["public"]["Enums"]["project_tool"][]
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "project_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_lines: {
        Row: {
          catalog_item_id: string | null
          courtesy: Database["public"]["Enums"]["quote_courtesy"]
          created_at: string
          description: string
          id: string
          name: string
          organization_id: string
          position: number
          quantity: number
          quote_id: string
          unit: Database["public"]["Enums"]["catalog_unit"]
          unit_price: number
        }
        Insert: {
          catalog_item_id?: string | null
          courtesy?: Database["public"]["Enums"]["quote_courtesy"]
          created_at?: string
          description?: string
          id?: string
          name: string
          organization_id: string
          position?: number
          quantity?: number
          quote_id: string
          unit?: Database["public"]["Enums"]["catalog_unit"]
          unit_price: number
        }
        Update: {
          catalog_item_id?: string | null
          courtesy?: Database["public"]["Enums"]["quote_courtesy"]
          created_at?: string
          description?: string
          id?: string
          name?: string
          organization_id?: string
          position?: number
          quantity?: number
          quote_id?: string
          unit?: Database["public"]["Enums"]["catalog_unit"]
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          cash_discount: number
          client_avatar_url: string | null
          client_city: string | null
          client_company: string | null
          client_email: string | null
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          discount_kind: Database["public"]["Enums"]["discount_kind"] | null
          discount_value: number | null
          id: string
          installments: number
          issued_at: string
          notes: string
          organization_id: string
          owner_id: string | null
          payment_methods: Database["public"]["Enums"]["payment_method"][]
          reference: string
          responded_at: string | null
          sent_at: string | null
          share_token_hash: string
          share_token_version: number
          status: Database["public"]["Enums"]["quote_status"]
          title: string
          updated_at: string
          valid_until: string | null
          viewed_at: string | null
        }
        Insert: {
          cash_discount?: number
          client_avatar_url?: string | null
          client_city?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          discount_kind?: Database["public"]["Enums"]["discount_kind"] | null
          discount_value?: number | null
          id?: string
          installments?: number
          issued_at?: string
          notes?: string
          organization_id: string
          owner_id?: string | null
          payment_methods?: Database["public"]["Enums"]["payment_method"][]
          reference?: string
          responded_at?: string | null
          sent_at?: string | null
          share_token_hash: string
          share_token_version?: number
          status?: Database["public"]["Enums"]["quote_status"]
          title: string
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Update: {
          cash_discount?: number
          client_avatar_url?: string | null
          client_city?: string | null
          client_company?: string | null
          client_email?: string | null
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          discount_kind?: Database["public"]["Enums"]["discount_kind"] | null
          discount_value?: number | null
          id?: string
          installments?: number
          issued_at?: string
          notes?: string
          organization_id?: string
          owner_id?: string | null
          payment_methods?: Database["public"]["Enums"]["payment_method"][]
          reference?: string
          responded_at?: string | null
          sent_at?: string | null
          share_token_hash?: string
          share_token_version?: number
          status?: Database["public"]["Enums"]["quote_status"]
          title?: string
          updated_at?: string
          valid_until?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      record_history: {
        Row: {
          action: Database["public"]["Enums"]["history_action"]
          actor_id: string | null
          at: string
          changes: Json
          id: string
          organization_id: string
          record_id: string
          record_type: Database["public"]["Enums"]["record_kind"]
          summary: string
        }
        Insert: {
          action: Database["public"]["Enums"]["history_action"]
          actor_id?: string | null
          at?: string
          changes?: Json
          id?: string
          organization_id: string
          record_id: string
          record_type: Database["public"]["Enums"]["record_kind"]
          summary: string
        }
        Update: {
          action?: Database["public"]["Enums"]["history_action"]
          actor_id?: string | null
          at?: string
          changes?: Json
          id?: string
          organization_id?: string
          record_id?: string
          record_type?: Database["public"]["Enums"]["record_kind"]
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "record_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reference_counters: {
        Row: {
          kind: string
          organization_id: string
          value: number
          year: number
        }
        Insert: {
          kind: string
          organization_id: string
          value?: number
          year: number
        }
        Update: {
          kind?: string
          organization_id?: string
          value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "reference_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          assignee_id: string | null
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          organization_id: string
          position: number
          priority: Database["public"]["Enums"]["task_priority"] | null
          task_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          organization_id: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"] | null
          task_id: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          organization_id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"] | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          label: string | null
          name: string
          organization_id: string
          size_bytes: number | null
          task_id: string
          type: Database["public"]["Enums"]["task_attachment_type"]
          url: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          label?: string | null
          name: string
          organization_id: string
          size_bytes?: number | null
          task_id: string
          type: Database["public"]["Enums"]["task_attachment_type"]
          url: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          label?: string | null
          name?: string
          organization_id?: string
          size_bytes?: number | null
          task_id?: string
          type?: Database["public"]["Enums"]["task_attachment_type"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_event_fk"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "task_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          audio_seconds: number | null
          audio_url: string | null
          id: string
          kind: Database["public"]["Enums"]["task_event_kind"]
          mentions: Json
          organization_id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          audio_seconds?: number | null
          audio_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_event_kind"]
          mentions?: Json
          organization_id: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          audio_seconds?: number | null
          audio_url?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_event_kind"]
          mentions?: Json
          organization_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          client_id: string | null
          contract_id: string | null
          created_at: string
          id: string
          linked_project_id: string | null
          organization_id: string
          position: number
          quote_id: string | null
          task_id: string
        }
        Insert: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          id?: string
          linked_project_id?: string | null
          organization_id: string
          position?: number
          quote_id?: string | null
          task_id: string
        }
        Update: {
          client_id?: string | null
          contract_id?: string | null
          created_at?: string
          id?: string
          linked_project_id?: string | null
          organization_id?: string
          position?: number
          quote_id?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_linked_project_id_fkey"
            columns: ["linked_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_people: {
        Row: {
          created_at: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_people_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_people_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          alert: string | null
          created_at: string
          description: string
          due_date: string
          estimate_minutes: number | null
          id: string
          organization_id: string
          owner_id: string | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string | null
          reference: string
          stage: Database["public"]["Enums"]["task_stage"]
          start_date: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          alert?: string | null
          created_at?: string
          description?: string
          due_date: string
          estimate_minutes?: number | null
          id?: string
          organization_id: string
          owner_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          reference?: string
          stage?: Database["public"]["Enums"]["task_stage"]
          start_date?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          alert?: string | null
          created_at?: string
          description?: string
          due_date?: string
          estimate_minutes?: number | null
          id?: string
          organization_id?: string
          owner_id?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string | null
          reference?: string
          stage?: Database["public"]["Enums"]["task_stage"]
          start_date?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          charge_id: string | null
          created_at: string
          created_by: string | null
          date: string
          description: string
          id: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          method_label: string | null
          method_type: Database["public"]["Enums"]["payment_method"] | null
          organization_id: string
          reference: string
          status: Database["public"]["Enums"]["transaction_status"]
          time: string | null
          title: string
          updated_at: string
          visual_avatar_url: string | null
          visual_name: string | null
          visual_type: Database["public"]["Enums"]["transaction_visual"] | null
        }
        Insert: {
          amount: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          description?: string
          id?: string
          kind: Database["public"]["Enums"]["transaction_kind"]
          method_label?: string | null
          method_type?: Database["public"]["Enums"]["payment_method"] | null
          organization_id: string
          reference?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          time?: string | null
          title: string
          updated_at?: string
          visual_avatar_url?: string | null
          visual_name?: string | null
          visual_type?: Database["public"]["Enums"]["transaction_visual"] | null
        }
        Update: {
          amount?: number
          charge_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          description?: string
          id?: string
          kind?: Database["public"]["Enums"]["transaction_kind"]
          method_label?: string | null
          method_type?: Database["public"]["Enums"]["payment_method"] | null
          organization_id?: string
          reference?: string
          status?: Database["public"]["Enums"]["transaction_status"]
          time?: string | null
          title?: string
          updated_at?: string
          visual_avatar_url?: string | null
          visual_name?: string | null
          visual_type?: Database["public"]["Enums"]["transaction_visual"] | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
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
      can_manage_org_file: { Args: { p_name: string }; Returns: boolean }
      can_write: { Args: { p_organization_id: string }; Returns: boolean }
      charge_by_token: { Args: { p_token_hash: string }; Returns: Json }
      claim_daily_bonus: { Args: { p_points: number }; Returns: boolean }
      complete_onboarding: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      consume_ai_credit: {
        Args: { p_amount?: number; p_organization_id: string }
        Returns: number
      }
      contract_by_party_token: { Args: { p_token_hash: string }; Returns: Json }
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
      gamification_summary: {
        Args: never
        Returns: {
          bonus_claimed_today: boolean
          daily_points: number
          points: number
          rank: number
          since: string
        }[]
      }
      has_role: {
        Args: {
          p_organization_id: string
          p_roles: Database["public"]["Enums"]["member_role"][]
        }
        Returns: boolean
      }
      is_member: { Args: { p_organization_id: string }; Returns: boolean }
      log_record_event: {
        Args: {
          p_action: Database["public"]["Enums"]["history_action"]
          p_changes?: Json
          p_organization_id: string
          p_record_id: string
          p_record_type: Database["public"]["Enums"]["record_kind"]
          p_summary: string
        }
        Returns: string
      }
      mark_charge_viewed: { Args: { p_token_hash: string }; Returns: undefined }
      mark_contract_party_viewed: {
        Args: { p_token_hash: string }
        Returns: undefined
      }
      mark_quote_viewed: { Args: { p_token_hash: string }; Returns: undefined }
      mfa_satisfied: { Args: never; Returns: boolean }
      next_reference: {
        Args: { p_kind: string; p_organization_id: string; p_prefix: string }
        Returns: string
      }
      notify_member: {
        Args: {
          p_action_href?: string
          p_action_label?: string
          p_actor_avatar_url?: string
          p_actor_name?: string
          p_description?: string
          p_kind: Database["public"]["Enums"]["notification_kind"]
          p_organization_id: string
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      opportunity_open_counts: {
        Args: { p_organization_id: string }
        Returns: {
          funnel_id: string
          total: number
        }[]
      }
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
      public_portfolio: { Args: { p_slug: string }; Returns: Json }
      public_resume: { Args: { p_slug: string }; Returns: Json }
      quote_by_token: { Args: { p_token_hash: string }; Returns: Json }
      record_access: { Args: { p_minutes?: number }; Returns: undefined }
      record_automation_run: {
        Args: {
          p_automation_id: string
          p_mode: Database["public"]["Enums"]["automation_run_mode"]
          p_status: Database["public"]["Enums"]["automation_run_status"]
          p_steps: Json
          p_trigger_label: string
        }
        Returns: string
      }
      report_installment_paid: {
        Args: { p_installment_id: string; p_token_hash: string }
        Returns: boolean
      }
      respond_quote: {
        Args: { p_approved: boolean; p_token_hash: string }
        Returns: boolean
      }
      set_current_org: {
        Args: { p_organization_id: string }
        Returns: undefined
      }
      set_organization_archived: {
        Args: { p_archived: boolean; p_organization_id: string }
        Returns: undefined
      }
      shares_org_with: { Args: { p_user_id: string }; Returns: boolean }
      sign_contract_party: {
        Args: { p_signature_url: string; p_token_hash: string }
        Returns: boolean
      }
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
      task_open_counts: {
        Args: { p_organization_id: string }
        Returns: {
          project_id: string
          total: number
        }[]
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
      text_array_ok: {
        Args: { p_max_items: number; p_max_length: number; p_values: string[] }
        Returns: boolean
      }
      text_len_ok: {
        Args: { p_max: number; p_min: number; p_value: string }
        Returns: boolean
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
      ai_answer_state: "thinking" | "writing" | "done" | "stopped"
      ai_role: "person" | "assistant"
      automation_run_mode: "event" | "test"
      automation_run_status: "ok" | "failed" | "waiting"
      automation_status: "active" | "paused" | "draft"
      billing_cycle: "monthly" | "yearly"
      billing_plan: "free" | "pro" | "alliance"
      catalog_kind: "product" | "service"
      catalog_unit: "project" | "hour" | "month" | "unit"
      charge_direction: "incoming" | "outgoing"
      charge_event_kind:
        | "created"
        | "sent"
        | "resent"
        | "viewed"
        | "reported"
        | "paid"
        | "reopened"
        | "cancelled"
      charge_recurrence: "none" | "monthly" | "quarterly" | "yearly"
      contract_event_kind:
        | "created"
        | "sent"
        | "resent"
        | "viewed"
        | "signed"
        | "cancelled"
      contract_kind:
        | "landing"
        | "institutional"
        | "ecommerce"
        | "app"
        | "branding"
        | "uiux"
        | "maintenance"
        | "content"
        | "other"
      contract_party_role: "issuer" | "client"
      contract_source: "pdf" | "template" | "scratch"
      contract_status: "draft" | "sent" | "partial" | "signed" | "cancelled"
      contract_theme: "plain" | "blue" | "green" | "yellow" | "purple"
      crm_stage:
        | "lead"
        | "contact"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      discount_kind: "percent" | "amount"
      funnel_glyph:
        | "funnel"
        | "storefront"
        | "megaphone"
        | "handshake"
        | "target"
        | "buildings"
        | "tray"
      history_action:
        | "created"
        | "updated"
        | "archived"
        | "restored"
        | "deleted"
      member_role: "owner" | "admin" | "member"
      notification_kind: "acao" | "revisao" | "sistema"
      opportunity_source:
        | "whatsapp"
        | "indicacao"
        | "site"
        | "instagram"
        | "google"
        | "facebook"
        | "evento"
        | "prospeccao"
        | "telefone"
        | "outro"
      opportunity_temperature: "cold" | "warm" | "hot"
      organization_industry:
        | "web_development"
        | "mobile_development"
        | "product_design"
        | "brand_design"
        | "design_and_development"
        | "other"
      organization_kind: "freelancer" | "agency"
      palette_hue:
        | "red"
        | "orange"
        | "yellow"
        | "green"
        | "mint"
        | "teal"
        | "cyan"
        | "blue"
        | "indigo"
        | "purple"
        | "pink"
        | "brown"
      payment_method: "pix" | "transfer" | "boleto" | "card"
      plan_feature_kind: "flag" | "limit"
      project_glyph:
        | "kanban"
        | "palette"
        | "globe"
        | "storefront"
        | "megaphone"
        | "binoculars"
        | "tray"
      project_status: "active" | "paused" | "done" | "cancelled"
      project_tool:
        | "figma"
        | "adobexd"
        | "adobeillustrator"
        | "adobephotoshop"
        | "adobepremierepro"
        | "after-effects"
        | "canva"
        | "webflow"
        | "wordpress"
        | "woocommerce"
        | "nextjs"
        | "react"
        | "vuejs"
        | "nuxtjs"
        | "angular"
        | "typescript"
        | "javascript"
        | "nodejs"
        | "python"
        | "php"
        | "flutter"
        | "dart"
        | "kotlin"
        | "swift"
        | "tailwindcss"
        | "sass"
        | "html5"
        | "css"
        | "firebase"
        | "vercel"
        | "cloudflare"
        | "aws"
        | "googlecloud"
        | "docker"
        | "github"
        | "gitlab"
        | "postgresSQL"
        | "mySQL"
        | "mongodb"
        | "redis"
        | "threejs"
        | "jest"
        | "vitejs"
      quote_courtesy: "no" | "yes" | "today"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "approved"
        | "declined"
        | "expired"
      record_kind:
        | "client"
        | "catalog"
        | "project"
        | "task"
        | "quote"
        | "contract"
        | "charge"
        | "opportunity"
        | "automation"
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused"
      task_attachment_type: "pdf" | "image" | "figma" | "link" | "file"
      task_event_kind: "comment" | "change"
      task_priority: "low" | "normal" | "high" | "urgent"
      task_stage:
        | "backlog"
        | "todo"
        | "doing"
        | "blocked"
        | "review"
        | "approval"
        | "publishing"
        | "done"
      transaction_kind: "income" | "expense" | "scheduled"
      transaction_status: "confirmed" | "pending" | "cancelled"
      transaction_visual: "person" | "brand"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      ai_answer_state: ["thinking", "writing", "done", "stopped"],
      ai_role: ["person", "assistant"],
      automation_run_mode: ["event", "test"],
      automation_run_status: ["ok", "failed", "waiting"],
      automation_status: ["active", "paused", "draft"],
      billing_cycle: ["monthly", "yearly"],
      billing_plan: ["free", "pro", "alliance"],
      catalog_kind: ["product", "service"],
      catalog_unit: ["project", "hour", "month", "unit"],
      charge_direction: ["incoming", "outgoing"],
      charge_event_kind: [
        "created",
        "sent",
        "resent",
        "viewed",
        "reported",
        "paid",
        "reopened",
        "cancelled",
      ],
      charge_recurrence: ["none", "monthly", "quarterly", "yearly"],
      contract_event_kind: [
        "created",
        "sent",
        "resent",
        "viewed",
        "signed",
        "cancelled",
      ],
      contract_kind: [
        "landing",
        "institutional",
        "ecommerce",
        "app",
        "branding",
        "uiux",
        "maintenance",
        "content",
        "other",
      ],
      contract_party_role: ["issuer", "client"],
      contract_source: ["pdf", "template", "scratch"],
      contract_status: ["draft", "sent", "partial", "signed", "cancelled"],
      contract_theme: ["plain", "blue", "green", "yellow", "purple"],
      crm_stage: [
        "lead",
        "contact",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      discount_kind: ["percent", "amount"],
      funnel_glyph: [
        "funnel",
        "storefront",
        "megaphone",
        "handshake",
        "target",
        "buildings",
        "tray",
      ],
      history_action: ["created", "updated", "archived", "restored", "deleted"],
      member_role: ["owner", "admin", "member"],
      notification_kind: ["acao", "revisao", "sistema"],
      opportunity_source: [
        "whatsapp",
        "indicacao",
        "site",
        "instagram",
        "google",
        "facebook",
        "evento",
        "prospeccao",
        "telefone",
        "outro",
      ],
      opportunity_temperature: ["cold", "warm", "hot"],
      organization_industry: [
        "web_development",
        "mobile_development",
        "product_design",
        "brand_design",
        "design_and_development",
        "other",
      ],
      organization_kind: ["freelancer", "agency"],
      palette_hue: [
        "red",
        "orange",
        "yellow",
        "green",
        "mint",
        "teal",
        "cyan",
        "blue",
        "indigo",
        "purple",
        "pink",
        "brown",
      ],
      payment_method: ["pix", "transfer", "boleto", "card"],
      plan_feature_kind: ["flag", "limit"],
      project_glyph: [
        "kanban",
        "palette",
        "globe",
        "storefront",
        "megaphone",
        "binoculars",
        "tray",
      ],
      project_status: ["active", "paused", "done", "cancelled"],
      project_tool: [
        "figma",
        "adobexd",
        "adobeillustrator",
        "adobephotoshop",
        "adobepremierepro",
        "after-effects",
        "canva",
        "webflow",
        "wordpress",
        "woocommerce",
        "nextjs",
        "react",
        "vuejs",
        "nuxtjs",
        "angular",
        "typescript",
        "javascript",
        "nodejs",
        "python",
        "php",
        "flutter",
        "dart",
        "kotlin",
        "swift",
        "tailwindcss",
        "sass",
        "html5",
        "css",
        "firebase",
        "vercel",
        "cloudflare",
        "aws",
        "googlecloud",
        "docker",
        "github",
        "gitlab",
        "postgresSQL",
        "mySQL",
        "mongodb",
        "redis",
        "threejs",
        "jest",
        "vitejs",
      ],
      quote_courtesy: ["no", "yes", "today"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "approved",
        "declined",
        "expired",
      ],
      record_kind: [
        "client",
        "catalog",
        "project",
        "task",
        "quote",
        "contract",
        "charge",
        "opportunity",
        "automation",
      ],
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
      task_attachment_type: ["pdf", "image", "figma", "link", "file"],
      task_event_kind: ["comment", "change"],
      task_priority: ["low", "normal", "high", "urgent"],
      task_stage: [
        "backlog",
        "todo",
        "doing",
        "blocked",
        "review",
        "approval",
        "publishing",
        "done",
      ],
      transaction_kind: ["income", "expense", "scheduled"],
      transaction_status: ["confirmed", "pending", "cancelled"],
      transaction_visual: ["person", "brand"],
    },
  },
} as const
