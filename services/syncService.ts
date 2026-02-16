import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NovelSettings, Chapter } from '../types';

/**
 * Data Sync Service
 * Handles synchronization between local storage and cloud database
 */

// Upload settings to cloud
export const uploadSettings = async (
  projectId: string,
  settings: NovelSettings
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    // Convert app format to database format
    const dbSettings = {
      project_id: projectId,
      title: settings.title,
      style: settings.style,
      tags: settings.tags,
      gold_finger: settings.goldFinger,
      synopsis: settings.synopsis,
      leveling_system: settings.levelingSystem,
      background: settings.background,
      author_note: settings.authorNote,
      characters: settings.characters,
      current_plot_progress: settings.currentPlotProgress,
      cover_image: settings.coverImage,
      cover_visual_prompt: settings.coverVisualPrompt,
      novel_type: settings.novelType,
      target_total_words: settings.targetTotalWords,
      target_chapter_count: settings.targetChapterCount,
    };

    // Upsert (insert or update)
    const { error } = await supabase
      .from('novel_settings')
      .upsert(dbSettings, { onConflict: 'project_id' });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error uploading settings:', error);
    return { error };
  }
};

// Upload chapters to cloud
export const uploadChapters = async (
  projectId: string,
  chapters: Chapter[]
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    // Convert app format to database format
    const dbChapters = chapters.map(ch => ({
      project_id: projectId,
      number: ch.number,
      title: ch.title,
      content: ch.content,
      summary: ch.summary,
      created_at: new Date(ch.createdAt).toISOString(),
    }));

    // Delete existing chapters and insert new ones
    await supabase
      .from('chapters')
      .delete()
      .eq('project_id', projectId);

    if (dbChapters.length > 0) {
      const { error } = await supabase
        .from('chapters')
        .insert(dbChapters);

      if (error) throw error;
    }

    return { error: null };
  } catch (error) {
    console.error('Error uploading chapters:', error);
    return { error };
  }
};

// Upload single chapter to cloud
export const uploadChapter = async (
  projectId: string,
  chapter: Chapter
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    const dbChapter = {
      project_id: projectId,
      number: chapter.number,
      title: chapter.title,
      content: chapter.content,
      summary: chapter.summary,
      created_at: new Date(chapter.createdAt).toISOString(),
    };

    // Upsert chapter
    const { error } = await supabase
      .from('chapters')
      .upsert(dbChapter, { onConflict: 'project_id,number' });

    if (error) throw error;

    return { error: null };
  } catch (error) {
    console.error('Error uploading chapter:', error);
    return { error };
  }
};

// Download settings from cloud
export const downloadSettings = async (
  projectId: string
): Promise<{ data: NovelSettings | null; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { data: null, error: new Error('Supabase not configured') };
  }

  try {
    const { data, error } = await supabase
      .from('novel_settings')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return { data: null, error: null };
    }

    // Convert database format to app format
    const settings: NovelSettings = {
      title: data.title || '',
      style: data.style || '',
      tags: data.tags || [],
      goldFinger: data.gold_finger || '',
      synopsis: data.synopsis || '',
      levelingSystem: data.leveling_system || '',
      background: data.background || '',
      authorNote: data.author_note || '',
      characters: data.characters || [],
      currentPlotProgress: data.current_plot_progress || '',
      coverImage: data.cover_image || '',
      coverVisualPrompt: data.cover_visual_prompt || '',
      novelType: (data.novel_type as 'long' | 'short') || 'long',
      targetTotalWords: data.target_total_words || undefined,
      targetChapterCount: data.target_chapter_count || undefined,
    };

    return { data: settings, error: null };
  } catch (error) {
    console.error('Error downloading settings:', error);
    return { data: null, error };
  }
};

// Download chapters from cloud
export const downloadChapters = async (
  projectId: string
): Promise<{ data: Chapter[]; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { data: [], error: new Error('Supabase not configured') };
  }

  try {
    const { data, error } = await supabase
      .from('chapters')
      .select('*')
      .eq('project_id', projectId)
      .order('number', { ascending: true });

    if (error) throw error;

    // Convert database format to app format
    const chapters: Chapter[] = (data || []).map(ch => ({
      id: ch.id,
      number: ch.number,
      title: ch.title,
      content: ch.content,
      summary: ch.summary || '',
      createdAt: new Date(ch.created_at).getTime(),
    }));

    return { data: chapters, error: null };
  } catch (error) {
    console.error('Error downloading chapters:', error);
    return { data: [], error };
  }
};

// Full project sync (upload all data)
export const syncProjectToCloud = async (
  projectId: string,
  settings: NovelSettings,
  chapters: Chapter[]
): Promise<{ error: any }> => {
  if (!isSupabaseConfigured()) {
    return { error: new Error('Supabase not configured') };
  }

  try {
    // Upload settings
    const settingsResult = await uploadSettings(projectId, settings);
    if (settingsResult.error) throw settingsResult.error;

    // Upload chapters
    const chaptersResult = await uploadChapters(projectId, chapters);
    if (chaptersResult.error) throw chaptersResult.error;

    // Update project's last_synced_at
    await supabase
      .from('projects')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', projectId);

    return { error: null };
  } catch (error) {
    console.error('Error syncing project to cloud:', error);
    return { error };
  }
};

// Full project sync (download all data)
export const syncProjectFromCloud = async (
  projectId: string
): Promise<{ settings: NovelSettings | null; chapters: Chapter[]; error: any }> => {
  if (!isSupabaseConfigured()) {
    return { settings: null, chapters: [], error: new Error('Supabase not configured') };
  }

  try {
    // Download settings
    const settingsResult = await downloadSettings(projectId);
    if (settingsResult.error) throw settingsResult.error;

    // Download chapters
    const chaptersResult = await downloadChapters(projectId);
    if (chaptersResult.error) throw chaptersResult.error;

    return {
      settings: settingsResult.data,
      chapters: chaptersResult.data,
      error: null
    };
  } catch (error) {
    console.error('Error syncing project from cloud:', error);
    return { settings: null, chapters: [], error };
  }
};

// Check if project needs sync (compare local and cloud timestamps)
export const needsSync = async (projectId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('projects')
      .select('last_synced_at, updated_at')
      .eq('id', projectId)
      .single();

    if (error || !data) return false;

    // If never synced, needs sync
    if (!data.last_synced_at) return true;

    // If updated after last sync, needs sync
    const lastSynced = new Date(data.last_synced_at).getTime();
    const lastUpdated = new Date(data.updated_at).getTime();

    return lastUpdated > lastSynced;
  } catch (error) {
    console.error('Error checking sync status:', error);
    return false;
  }
};
