/**
 * Tipi dello schema, allineati a mano a `supabase/migrations/0001_flusso.sql`.
 *
 * Normalmente questo file lo genera la CLI:
 *   npx supabase gen types typescript --project-id <ref> > lib/supabase/database.types.ts
 * Va rigenerato a ogni migrazione. Finché la migrazione resta una sola, questa
 * versione scritta a mano è la fonte di verità per il client.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          deadline: string | null;
          archived: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          color?: string;
          deadline?: string | null;
          archived?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };

      recurring: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          project_id: string | null;
          est_minutes: number | null;
          energy: string | null;
          subtasks: Json;
          freq: string;
          dow: number[];
          start_minute: number | null;
          skip: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          project_id?: string | null;
          est_minutes?: number | null;
          energy?: string | null;
          subtasks?: Json;
          freq: string;
          dow?: number[];
          start_minute?: number | null;
          skip?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring"]["Insert"]>;
        Relationships: [];
      };

      ideas: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          project_id: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          project_id?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ideas"]["Insert"]>;
        Relationships: [];
      };

      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          notes: string;
          status: string;
          day: string | null;
          start_minute: number | null;
          est_minutes: number | null;
          energy: string | null;
          project_id: string | null;
          deadline: string | null;
          subtasks: Json;
          recur_id: string | null;
          sort_order: number;
          created_at: string;
          postpone_count: number;
          last_postponed_at: string | null;
          actual_duration_minutes: number | null;
          is_daily_highlight: boolean;
          highlight_date: string | null;
          first_planned_at: string | null;
          status_review: string;
          google_event_id: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          notes?: string;
          status?: string;
          day?: string | null;
          start_minute?: number | null;
          est_minutes?: number | null;
          energy?: string | null;
          project_id?: string | null;
          deadline?: string | null;
          subtasks?: Json;
          recur_id?: string | null;
          sort_order?: number;
          created_at?: string;
          postpone_count?: number;
          last_postponed_at?: string | null;
          actual_duration_minutes?: number | null;
          is_daily_highlight?: boolean;
          highlight_date?: string | null;
          first_planned_at?: string | null;
          status_review?: string;
          google_event_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };

      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          started_at: string;
          ended_at: string | null;
          planned_minutes: number;
          actual_minutes: number | null;
          outcome: string | null;
          was_micro_start: boolean;
          paused_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          planned_minutes: number;
          actual_minutes?: number | null;
          outcome?: string | null;
          was_micro_start?: boolean;
          paused_seconds?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["focus_sessions"]["Insert"]
        >;
        Relationships: [];
      };

      daily_reviews: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          type: string;
          planned_minutes: number;
          completed_minutes: number;
          tasks_planned: number;
          tasks_completed: number;
          notes: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          date: string;
          type: string;
          planned_minutes?: number;
          completed_minutes?: number;
          tasks_planned?: number;
          tasks_completed?: number;
          notes?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["daily_reviews"]["Insert"]
        >;
        Relationships: [];
      };

      okrs: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          quarter: string;
          objective: string;
          key_results: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          quarter: string;
          objective: string;
          key_results?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["okrs"]["Insert"]>;
        Relationships: [];
      };

      blocks: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          label: string | null;
          day: string | null;
          recur: boolean;
          dow: number[];
          start_minute: number;
          end_minute: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          type: string;
          label?: string | null;
          day?: string | null;
          recur?: boolean;
          dow?: number[];
          start_minute: number;
          end_minute: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["blocks"]["Insert"]>;
        Relationships: [];
      };

      /** Contiene i token cifrati: raggiungibile solo con `service_role`. */
      google_accounts: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext: string | null;
          token_expires_at: string | null;
          scopes: string[];
          needs_reconnect: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          email: string;
          access_token_ciphertext: string;
          refresh_token_ciphertext?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          needs_reconnect?: boolean;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["google_accounts"]["Insert"]
        >;
        Relationships: [];
      };

      google_calendars: {
        Row: {
          id: string;
          user_id: string;
          account_id: string;
          google_calendar_id: string;
          name: string;
          color: string;
          enabled: boolean;
          is_write_target: boolean;
          sync_token: string | null;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          account_id: string;
          google_calendar_id: string;
          name: string;
          color?: string;
          enabled?: boolean;
          is_write_target?: boolean;
          sync_token?: string | null;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["google_calendars"]["Insert"]
        >;
        Relationships: [];
      };

      google_events: {
        Row: {
          id: string;
          user_id: string;
          calendar_id: string;
          google_event_id: string;
          title: string;
          day: string;
          start_minute: number;
          end_minute: number;
          all_day: boolean;
          local_done: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          calendar_id: string;
          google_event_id: string;
          title?: string;
          day: string;
          start_minute?: number;
          end_minute?: number;
          all_day?: boolean;
          local_done?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["google_events"]["Insert"]
        >;
        Relationships: [];
      };

      user_settings: {
        Row: {
          user_id: string;
          work_start: number;
          work_end: number;
          theme: string;
          peak_hours_start: string;
          peak_hours_end: string;
          low_hours_start: string | null;
          low_hours_end: string | null;
          buffer_minutes: number;
          micro_start_minutes: number;
          daily_cap_minutes: number;
          google_write_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id?: string;
          work_start?: number;
          work_end?: number;
          theme?: string;
          peak_hours_start?: string;
          peak_hours_end?: string;
          low_hours_start?: string | null;
          low_hours_end?: string | null;
          buffer_minutes?: number;
          micro_start_minutes?: number;
          daily_cap_minutes?: number;
          google_write_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["user_settings"]["Insert"]
        >;
        Relationships: [];
      };
    };

    Views: {
      /** Stato degli account Google collegati, senza mai i token. */
      google_accounts_public: {
        Row: {
          id: string;
          user_id: string;
          email: string;
          scopes: string[];
          needs_reconnect: boolean;
          token_expires_at: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };

    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"];
