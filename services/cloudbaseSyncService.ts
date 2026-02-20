import { db } from '../lib/cloudbase';
import { NovelSettings, Chapter } from '../types';

// Lock to prevent concurrent uploads
let uploadLock = false;

// Upload settings to cloud
export const uploadSettings = async (projectId: string, settings: NovelSettings): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  // Wait if another upload is in progress
  if (uploadLock) {
    console.log('Upload already in progress, skipping...');
    return { error: null };
  }

  uploadLock = true;

  try {
    console.log('Uploading settings for project:', projectId);
    console.log('Settings data:', settings);

    // Check if settings exist
    const result = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .get();

    console.log(`Found ${result.data.length} existing settings documents for project ${projectId}`);

    // Convert camelCase to snake_case for database
    // IMPORTANT: Ensure all fields have default values to prevent undefined from being saved
    const settingsData = {
      project_id: projectId,
      title: settings.title ?? '',
      style: settings.style ?? '',
      tags: Array.isArray(settings.tags) ? settings.tags : [],
      gold_finger: settings.goldFinger ?? '',
      synopsis: settings.synopsis ?? '',
      leveling_system: settings.levelingSystem ?? '',
      background: settings.background ?? '',
      world_rules: settings.worldRules ?? '',
      author_note: settings.authorNote ?? '',
      characters: Array.isArray(settings.characters) ? settings.characters : [],
      factions: Array.isArray(settings.factions) ? settings.factions : [],
      locations: Array.isArray(settings.locations) ? settings.locations : [],
      current_plot_progress: settings.currentPlotProgress ?? '',
      cover_image: settings.coverImage ?? '',
      cover_visual_prompt: settings.coverVisualPrompt ?? '',
      novel_type: settings.novelType ?? 'long',
      target_total_words: settings.targetTotalWords ?? 0,
      target_chapter_count: settings.targetChapterCount ?? 0,
      updated_at: Date.now()
    };

    console.log('Converted settings data:', settingsData);

    if (result.data.length > 0) {
      // Delete ALL existing documents for this project to avoid duplicates
      console.log(`Deleting ${result.data.length} existing documents...`);
      for (const doc of result.data) {
        await db.collection('novel_settings').doc(doc._id).remove();
        console.log(`Deleted document: ${doc._id}`);
      }

      // Create a single new document
      console.log('Creating new document with updated data...');
      const addResult = await db.collection('novel_settings').add(settingsData);
      console.log('Created new document:', addResult);

      if (addResult.code) {
        throw new Error(`Add failed: ${addResult.message || addResult.code}`);
      }

      console.log('Document recreated successfully');
    } else {
      // Create new
      console.log('Creating new settings (no existing record found)');
      const addResult = await db.collection('novel_settings').add(settingsData);
      console.log('Add result:', addResult);

      // Check if add failed
      if (addResult.code) {
        console.error('Add failed with code:', addResult.code);
        throw new Error(`Add failed: ${addResult.message || addResult.code}`);
      }
    }

    console.log('Settings uploaded successfully');
    return { error: null };
  } catch (error: any) {
    console.error('Error uploading settings:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return { error };
  } finally {
    uploadLock = false;
  }
};

// Upload chapters to cloud
export const uploadChapters = async (projectId: string, chapters: Chapter[]): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    console.log('Uploading chapters for project:', projectId);
    console.log('Number of chapters:', chapters.length);

    // Get existing chapters
    const existingResult = await db.collection('chapters')
      .where({ project_id: projectId })
      .get();

    const existingChapters = existingResult.data;

    // Group existing chapters by number to find duplicates
    const chaptersByNumber = new Map<number, any[]>();
    existingChapters.forEach((ch: any) => {
      if (!chaptersByNumber.has(ch.number)) {
        chaptersByNumber.set(ch.number, []);
      }
      chaptersByNumber.get(ch.number)!.push(ch);
    });

    // Delete duplicate chapters (keep the most recent one)
    for (const [number, duplicates] of chaptersByNumber.entries()) {
      if (duplicates.length > 1) {
        console.log(`Found ${duplicates.length} duplicates for chapter ${number}, cleaning up...`);
        // Sort by updated_at, keep the most recent
        duplicates.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
        // Delete all except the first one (most recent)
        for (let i = 1; i < duplicates.length; i++) {
          console.log(`Deleting duplicate chapter ${number} with _id:`, duplicates[i]._id);
          await db.collection('chapters').doc(duplicates[i]._id).remove();
        }
      }
    }

    // Refresh the list after cleanup
    const refreshedResult = await db.collection('chapters')
      .where({ project_id: projectId })
      .get();
    const cleanedChapters = refreshedResult.data;

    // Update or create each chapter
    for (const chapter of chapters) {
      const existing = cleanedChapters.find((c: any) => c.number === chapter.number);

      const chapterData = {
        project_id: projectId,
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
        summary: chapter.summary || '',
        created_at: chapter.createdAt || Date.now(), // createdAt is already a timestamp
        updated_at: Date.now()
      };

      if (existing) {
        // Update existing chapter using set() to avoid field type conflicts
        console.log('Updating chapter', chapter.number, 'with _id:', existing._id);
        await db.collection('chapters')
          .doc(existing._id)
          .set(chapterData);
      } else {
        // Create new chapter
        console.log('Creating new chapter', chapter.number);
        await db.collection('chapters').add(chapterData);
      }
    }

    console.log('Chapters uploaded successfully');
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
    console.log('Downloading settings for project:', projectId);
    const result = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .orderBy('updated_at', 'desc') // Get the most recent one
      .get();

    console.log('Settings query result:', result.data.length, 'documents found');

    if (result.data.length === 0) {
      console.log('No settings found for project');
      return { data: null, error: null };
    }

    // If there are multiple documents, clean up the old ones
    if (result.data.length > 1) {
      console.warn(`Found ${result.data.length} duplicate settings documents, cleaning up...`);
      // Keep the first one (most recent), delete the rest
      for (let i = 1; i < result.data.length; i++) {
        await db.collection('novel_settings').doc(result.data[i]._id).remove();
        console.log(`Deleted duplicate document: ${result.data[i]._id}`);
      }
    }

    const doc = result.data[0]; // Use the most recent document

    console.log('Raw document from database:', doc);
    console.log('[DOWNLOAD-CHECK] Field values from database:', {
      gold_finger: doc.gold_finger,
      gold_finger_type: typeof doc.gold_finger,
      gold_finger_length: doc.gold_finger?.length,
      leveling_system: doc.leveling_system,
      author_note: doc.author_note,
      author_note_type: typeof doc.author_note,
      author_note_length: doc.author_note?.length,
      current_plot_progress: doc.current_plot_progress,
      cover_image: doc.cover_image ? `${doc.cover_image.substring(0, 50)}...` : '(empty)',
      cover_visual_prompt: doc.cover_visual_prompt,
      cover_visual_prompt_type: typeof doc.cover_visual_prompt,
      cover_visual_prompt_length: doc.cover_visual_prompt?.length
    });

    // Convert snake_case to camelCase for frontend
    // IMPORTANT: Use ?? instead of || to handle undefined values correctly
    const settings: NovelSettings = {
      title: doc.title ?? '',
      style: doc.style ?? '',
      tags: Array.isArray(doc.tags) ? doc.tags : [],
      goldFinger: doc.gold_finger ?? '',
      synopsis: doc.synopsis ?? '',
      levelingSystem: doc.leveling_system ?? '',
      background: doc.background ?? '',
      worldRules: doc.world_rules ?? '',
      authorNote: doc.author_note ?? '',
      characters: Array.isArray(doc.characters) ? doc.characters : [],
      factions: Array.isArray(doc.factions) ? doc.factions : [],
      locations: Array.isArray(doc.locations) ? doc.locations : [],
      currentPlotProgress: doc.current_plot_progress ?? '',
      coverImage: doc.cover_image ?? '',
      coverVisualPrompt: doc.cover_visual_prompt ?? '',
      novelType: doc.novel_type ?? 'long',
      targetTotalWords: doc.target_total_words ?? 0,
      targetChapterCount: doc.target_chapter_count ?? 0
    };

    console.log('[DOWNLOAD-CHECK] Settings after conversion:', {
      goldFinger: settings.goldFinger,
      goldFinger_type: typeof settings.goldFinger,
      goldFinger_length: settings.goldFinger?.length,
      authorNote: settings.authorNote,
      authorNote_type: typeof settings.authorNote,
      authorNote_length: settings.authorNote?.length,
      coverVisualPrompt: settings.coverVisualPrompt,
      coverVisualPrompt_type: typeof settings.coverVisualPrompt,
      coverVisualPrompt_length: settings.coverVisualPrompt?.length,
      coverImage: settings.coverImage ? `${settings.coverImage.substring(0, 50)}...` : '(empty)'
    });
    return { data: settings, error: null };
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
    console.log('Downloading chapters for project:', projectId);
    const result = await db.collection('chapters')
      .where({ project_id: projectId })
      .orderBy('number', 'asc')
      .get();

    console.log('Chapters query result:', result.data.length, 'chapters found');

    const chapters: Chapter[] = result.data.map((doc: any) => ({
      id: doc._id, // Use CloudBase _id as chapter id
      number: doc.number,
      title: doc.title,
      content: doc.content,
      summary: doc.summary || '',
      createdAt: doc.created_at // Keep as timestamp number
    }));

    console.log('Chapters loaded:', chapters.length);
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

    // Update project last_synced_at - use doc().update()
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
