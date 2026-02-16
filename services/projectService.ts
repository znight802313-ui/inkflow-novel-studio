import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Project } from '../types/database';
import { NovelSettings, Chapter } from '../types';

/**
 * Project Management Service
 * Handles CRUD operations for novel projects
 */

// Create a new project
export const createProject = async (title: string): Promise<{ data: Project | null; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    // Deactivate all other projects first
    await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('user_id', user.user.id);

    // Create new project
    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: user.user.id,
        title: title || '新小说项目',
        is_active: true,
        metadata: {}
      })
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error creating project:', error);
    return { data: null, error };
  }
};

// Get all projects for current user
export const getProjects = async (): Promise<{ data: Project[] | null; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching projects:', error);
    return { data: null, error };
  }
};

// Get active project
export const getActiveProject = async (): Promise<{ data: Project | null; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.user.id)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    console.error('Error fetching active project:', error);
    return { data: null, error };
  }
};

// Switch to a different project
export const switchProject = async (projectId: string): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { error: new Error('User not authenticated') };
    }

    // Deactivate all projects
    await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('user_id', user.user.id);

    // Activate selected project
    const { error } = await supabase
      .from('projects')
      .update({ is_active: true })
      .eq('id', projectId)
      .eq('user_id', user.user.id);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error switching project:', error);
    return { error };
  }
};

// Update project metadata
export const updateProjectMetadata = async (
  projectId: string,
  metadata: { chapter_count?: number; total_words?: number; last_chapter_title?: string }
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { error } = await supabase
      .from('projects')
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error updating project metadata:', error);
    return { error };
  }
};

// Delete a project (and all associated data)
export const deleteProject = async (projectId: string): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      return { error: new Error('User not authenticated') };
    }

    // Delete project (CASCADE will delete settings and chapters)
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .eq('user_id', user.user.id);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { error };
  }
};

// Rename a project
export const renameProject = async (projectId: string, newTitle: string): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const { error } = await supabase
      .from('projects')
      .update({ title: newTitle, updated_at: new Date().toISOString() })
      .eq('id', projectId);

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error renaming project:', error);
    return { error };
  }
};

// Get project with full data (settings + chapters)
export const getProjectData = async (projectId: string): Promise<{
  settings: NovelSettings | null;
  chapters: Chapter[];
  error: any;
}> => {
  if (!isSupabaseConfigured()) {
    return { settings: null, chapters: [], error: new Error('Supabase not configured') };
  }

  try {
    // Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('novel_settings')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      throw settingsError;
    }

    // Fetch chapters
    const { data: chaptersData, error: chaptersError } = await supabase
      .from('chapters')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true });

    if (chaptersError) throw chaptersError;

    // Convert database format to app format
    const settings: NovelSettings | null = settingsData ? {
      title: settingsData.title || '',
      style: settingsData.style || '',
      tags: settingsData.tags || [],
      goldFinger: settingsData.gold_finger || '',
      synopsis: settingsData.synopsis || '',
      levelingSystem: settingsData.leveling_system || '',
      background: settingsData.background || '',
      authorNote: settingsData.author_note || '',
      characters: settingsData.characters || [],
      currentPlotProgress: settingsData.current_plot_progress || '',
      coverImage: settingsData.cover_image || '',
      coverVisualPrompt: settingsData.cover_visual_prompt || '',
      novelType: (settingsData.novel_type as 'long' | 'short') || 'long',
      targetTotalWords: settingsData.target_total_words || undefined,
      targetChapterCount: settingsData.target_chapter_count || undefined,
    } : null;

    const chapters: Chapter[] = (chaptersData || []).map(ch => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      content: ch.content,
      summary: ch.summary || '',
      createdAt: new Date(ch.created_at).getTime(),
    }));

    return { settings, chapters, error: null };
  } catch (error) {
    console.error('Error fetching project data:', error);
    return { settings: null, chapters: [], error };
  }
};
