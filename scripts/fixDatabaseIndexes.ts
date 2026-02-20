/**
 * Database Index Fix Script
 *
 * This script fixes the duplicate index issue in CloudBase database
 * Run this once to clean up the database structure
 */

import { db } from '../lib/cloudbase';

export async function fixDatabaseIndexes() {
  if (!db) {
    console.error('CloudBase not configured');
    return { success: false, error: 'CloudBase not configured' };
  }

  try {
    console.log('Starting database index fix...');

    // Step 1: Get all novel_settings documents
    const settingsResult = await db.collection('novel_settings').get();
    console.log(`Found ${settingsResult.data.length} settings documents`);

    // Step 2: For each document, recreate it without the problematic index
    for (const doc of settingsResult.data) {
      console.log(`Processing document: ${doc._id}`);

      // Create a clean copy of the data
      const cleanData = {
        project_id: doc.project_id,
        title: doc.title ?? '',
        style: doc.style ?? '',
        tags: Array.isArray(doc.tags) ? doc.tags : [],
        gold_finger: doc.gold_finger ?? '',
        synopsis: doc.synopsis ?? '',
        leveling_system: doc.leveling_system ?? '',
        background: doc.background ?? '',
        author_note: doc.author_note ?? '',
        characters: Array.isArray(doc.characters) ? doc.characters : [],
        current_plot_progress: doc.current_plot_progress ?? '',
        cover_image: doc.cover_image ?? '',
        cover_visual_prompt: doc.cover_visual_prompt ?? '',
        novel_type: doc.novel_type ?? 'long',
        target_total_words: doc.target_total_words ?? 0,
        target_chapter_count: doc.target_chapter_count ?? 0,
        updated_at: Date.now()
      };

      // Delete the old document
      await db.collection('novel_settings').doc(doc._id).remove();
      console.log(`Deleted old document: ${doc._id}`);

      // Create a new document with clean data
      const addResult = await db.collection('novel_settings').add(cleanData);
      console.log(`Created new document: ${addResult.id}`);
    }

    console.log('Database index fix completed successfully!');
    return { success: true };
  } catch (error: any) {
    console.error('Error fixing database indexes:', error);
    return { success: false, error: error.message };
  }
}
