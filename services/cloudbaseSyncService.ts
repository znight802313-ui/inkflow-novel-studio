import { db } from '../lib/cloudbase';
import { NovelSettings, Chapter } from '../types';

// Upload settings to cloud
export const uploadSettings = async (projectId: string, settings: NovelSettings): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    // Check if settings exist
    const result = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .limit(1)
      .get();

    const settingsData = {
      project_id: projectId,
      ...settings,
      updated_at: Date.now()
    };

    if (result.data.length > 0) {
      // Update existing
      await db.collection('novel_settings')
        .doc(result.data[0]._id)
        .update(settingsData);
    } else {
      // Create new
      await db.collection('novel_settings').add(settingsData);
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error uploading settings:', error);
    return { error };
  }
};

// Upload chapters to cloud
export const uploadChapters = async (projectId: string, chapters: Chapter[]): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    // Get existing chapters
    const existingResult = await db.collection('chapters')
      .where({ project_id: projectId })
      .get();

    const existingChapters = existingResult.data;

    // Update or create each chapter
    for (const chapter of chapters) {
      const existing = existingChapters.find((c: any) => c.number === chapter.number);

      const chapterData = {
        project_id: projectId,
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary || '',
        created_at: chapter.createdAt ? new Date(chapter.createdAt).getTime() : Date.now(),
        updated_at: Date.now()
      };

      if (existing) {
        // Update existing chapter
        await db.collection('chapters')
          .doc(existing._id)
          .update(chapterData);
      } else {
        // Create new chapter
        await db.collection('chapters').add(chapterData);
      }
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error uploading chapters:', error);
    return { error };
  }
};

// Download settings from cloud
export const downloadSettings = async (projectId: string): Promise<{ data: NovelSettings | null; error: any }> => {
  if (!db) {
    return { data: null, error: { message: 'CloudBase not configured' } };
  }

  try {
    const result = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .limit(1)
      .get();

    if (result.data.length === 0) {
      return { data: null, error: null };
    }

    const data = result.data[0];
    return { data: data as NovelSettings, error: null };
  } catch (error: any) {
    console.error('Error downloading settings:', error);
    return { data: null, error };
  }
};

// Download chapters from cloud
export const downloadChapters = async (projectId: string): Promise<{ data: Chapter[]; error: any }> => {
  if (!db) {
    return { data: [], error: { message: 'CloudBase not configured' } };
  }

  try {
    const result = await db.collection('chapters')
      .where({ project_id: projectId })
      .orderBy('number', 'asc')
      .get();

    const chapters: Chapter[] = result.data.map((doc: any) => ({
      number: doc.number,
      title: doc.title,
      content: doc.content,
      summary: doc.summary || '',
      createdAt: new Date(doc.created_at).toISOString()
    }));

    return { data: chapters, error: null };
  } catch (error: any) {
    console.error('Error downloading chapters:', error);
    return { data: [], error };
  }
};

// Sync project to cloud (upload)
export const syncProjectToCloud = async (
  projectId: string,
  settings: NovelSettings,
  chapters: Chapter[]
): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    // Upload settings
    await uploadSettings(projectId, settings);

    // Upload chapters
    await uploadChapters(projectId, chapters);

    // Update project last_synced_at
    await db.collection('projects')
      .doc(projectId)
      .update({ last_synced_at: Date.now(), updated_at: Date.now() });

    return { error: null };
  } catch (error: any) {
    console.error('Error syncing to cloud:', error);
    return { error };
  }
};

// Sync project from cloud (download)
export const syncProjectFromCloud = async (projectId: string): Promise<{
  settings: NovelSettings | null;
  chapters: Chapter[];
  error: any;
}> => {
  if (!db) {
    return { settings: null, chapters: [], error: { message: 'CloudBase not configured' } };
  }

  try {
    // Download settings
    const { data: settings, error: settingsError } = await downloadSettings(projectId);
    if (settingsError) {
      return { settings: null, chapters: [], error: settingsError };
    }

    // Download chapters
    const { data: chapters, error: chaptersError } = await downloadChapters(projectId);
    if (chaptersError) {
      return { settings, chapters: [], error: chaptersError };
    }

    return { settings, chapters, error: null };
  } catch (error: any) {
    console.error('Error syncing from cloud:', error);
    return { settings: null, chapters: [], error };
  }
};
