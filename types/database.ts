// Supabase Database Types

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
          last_synced_at: string | null;
          is_active: boolean;
          metadata: Record<string, any>;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
          last_synced_at?: string | null;
          is_active?: boolean;
          metadata?: Record<string, any>;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          created_at?: string;
          updated_at?: string;
          last_synced_at?: string | null;
          is_active?: boolean;
          metadata?: Record<string, any>;
        };
      };
      novel_settings: {
        Row: {
          id: string;
          project_id: string;
          title: string | null;
          style: string | null;
          tags: string[] | null;
          gold_finger: string | null;
          synopsis: string | null;
          leveling_system: string | null;
          background: string | null;
          author_note: string | null;
          characters: any[] | null;
          current_plot_progress: string | null;
          cover_image: string | null;
          cover_visual_prompt: string | null;
          novel_type: string | null;
          target_total_words: number | null;
          target_chapter_count: number | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title?: string | null;
          style?: string | null;
          tags?: string[] | null;
          gold_finger?: string | null;
          synopsis?: string | null;
          leveling_system?: string | null;
          background?: string | null;
          author_note?: string | null;
          characters?: any[] | null;
          current_plot_progress?: string | null;
          cover_image?: string | null;
          cover_visual_prompt?: string | null;
          novel_type?: string | null;
          target_total_words?: number | null;
          target_chapter_count?: number | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          title?: string | null;
          style?: string | null;
          tags?: string[] | null;
          gold_finger?: string | null;
          synopsis?: string | null;
          leveling_system?: string | null;
          background?: string | null;
          author_note?: string | null;
          characters?: any[] | null;
          current_plot_progress?: string | null;
          cover_image?: string | null;
          cover_visual_prompt?: string | null;
          novel_type?: string | null;
          target_total_words?: number | null;
          target_chapter_count?: number | null;
          updated_at?: string;
        };
      };
      chapters: {
        Row: {
          id: string;
          project_id: string;
          number: number;
          title: string;
          content: string;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          number: number;
          title: string;
          content: string;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          number?: number;
          title?: string;
          content?: string;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Project type for application use
export interface Project {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  is_active: boolean;
  metadata: {
    chapter_count?: number;
    total_words?: number;
    last_chapter_title?: string;
  };
}
