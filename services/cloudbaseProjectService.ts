import { db, auth, customAuth } from '../lib/cloudbase';

export interface Project {
  _id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  last_synced_at?: number;
  is_active: boolean;
  coverImage?: string; // Add cover image field
  source?: 'cloud' | 'imported'; // Project source: cloud-created or imported from local
}

// Create a new project
export const createProject = async (title: string): Promise<{ data: Project | null; error: any }> => {
  if (!db || !auth) {
    return { data: null, error: { message: 'CloudBase not configured' } };
  }

  try {
    // Get current custom user
    const currentUser = await customAuth.getCurrentUser();
    if (!currentUser) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    // Ensure anonymous login for database access
    let loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
      loginState = await auth.getLoginState();
      if (!loginState) {
        return { data: null, error: { message: 'Failed to authenticate' } };
      }
    }

    const userId = currentUser.uid; // Use custom user ID

    // Set all existing projects to inactive
    await db.collection('projects')
      .where({ user_id: userId })
      .update({ is_active: false });

    // Create new project
    const result = await db.collection('projects').add({
      user_id: userId,
      title: title || '新小说项目',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_active: true,
      source: 'cloud'
    });

    const project: Project = {
      _id: result.id,
      user_id: userId,
      title: title || '新小说项目',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_active: true,
      source: 'cloud'
    };

    return { data: project, error: null };
  } catch (error: any) {
    console.error('Error creating project:', error);
    return { data: null, error };
  }
};

// Get all projects for current user
export const getProjects = async (): Promise<{ data: Project[]; error: any }> => {
  if (!db || !auth) {
    return { data: [], error: { message: 'CloudBase not configured' } };
  }

  try {
    // Get current custom user
    const currentUser = await customAuth.getCurrentUser();
    if (!currentUser) {
      return { data: [], error: { message: 'Not authenticated' } };
    }

    // Ensure anonymous login for database access
    let loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
      loginState = await auth.getLoginState();
      if (!loginState) {
        return { data: [], error: { message: 'Failed to authenticate' } };
      }
    }

    const result = await db.collection('projects')
      .where({ user_id: currentUser.uid }) // Use custom user ID
      .orderBy('updated_at', 'desc')
      .get();

    console.log('Projects fetched:', result.data);
    console.log('First project structure:', result.data[0]);

    // Fetch cover images for each project from novel_settings
    const projectsWithCovers = await Promise.all(
      result.data.map(async (project: any) => {
        try {
          const settingsResult = await db.collection('novel_settings')
            .where({ project_id: project._id })
            .limit(1)
            .get();

          if (settingsResult.data.length > 0) {
            const settings = settingsResult.data[0];
            return {
              ...project,
              coverImage: settings.cover_image || undefined
            };
          }
        } catch (error) {
          console.error(`Error fetching settings for project ${project._id}:`, error);
        }
        return project;
      })
    );

    console.log('Projects with covers:', projectsWithCovers);

    return { data: projectsWithCovers as Project[], error: null };
  } catch (error: any) {
    console.error('Error getting projects:', error);
    return { data: [], error };
  }
};

// Get active project
export const getActiveProject = async (): Promise<{ data: Project | null; error: any }> => {
  if (!db || !auth) {
    return { data: null, error: { message: 'CloudBase not configured' } };
  }

  try {
    // Get current custom user
    const currentUser = await customAuth.getCurrentUser();
    if (!currentUser) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    // Ensure anonymous login for database access
    let loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
    }

    const result = await db.collection('projects')
      .where({ user_id: currentUser.uid, is_active: true })
      .limit(1)
      .get();

    return { data: result.data[0] as Project || null, error: null };
  } catch (error: any) {
    console.error('Error getting active project:', error);
    return { data: null, error };
  }
};

// Switch to a different project
export const switchProject = async (projectId: string): Promise<{ error: any }> => {
  if (!db || !auth) {
    return { error: { message: 'CloudBase not configured' } };
  }

  console.log('switchProject called with projectId:', projectId, 'type:', typeof projectId);

  // Validate projectId
  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
    console.error('Invalid projectId:', projectId);
    return { error: { message: 'Invalid project ID' } };
  }

  try {
    // Get current custom user
    const currentUser = await customAuth.getCurrentUser();
    if (!currentUser) {
      return { error: { message: 'Not authenticated' } };
    }

    // Ensure anonymous login for database access
    let loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
    }

    console.log('Switching to project:', projectId, 'for user:', currentUser.uid);

    // Set all projects to inactive
    await db.collection('projects')
      .where({ user_id: currentUser.uid })
      .update({ is_active: false });

    // Set selected project to active using where instead of doc
    const updateResult = await db.collection('projects')
      .where({ _id: projectId, user_id: currentUser.uid })
      .update({ is_active: true, updated_at: Date.now() });

    console.log('Update result:', updateResult);

    return { error: null };
  } catch (error: any) {
    console.error('Error switching project:', error);
    return { error };
  }
};

// Delete a project
export const deleteProject = async (projectId: string): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    // Delete project
    await db.collection('projects').doc(projectId).remove();

    // Delete associated settings
    const settingsResult = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .get();

    for (const doc of settingsResult.data) {
      await db.collection('novel_settings').doc(doc._id).remove();
    }

    // Delete associated chapters
    const chaptersResult = await db.collection('chapters')
      .where({ project_id: projectId })
      .get();

    for (const doc of chaptersResult.data) {
      await db.collection('chapters').doc(doc._id).remove();
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error deleting project:', error);
    return { error };
  }
};

// Rename a project
export const renameProject = async (projectId: string, newTitle: string): Promise<{ error: any }> => {
  if (!db) {
    return { error: { message: 'CloudBase not configured' } };
  }

  try {
    await db.collection('projects')
      .doc(projectId)
      .update({ title: newTitle, updated_at: Date.now() });

    return { error: null };
  } catch (error: any) {
    console.error('Error renaming project:', error);
    return { error };
  }
};

// Get project data (settings + chapters)
export const getProjectData = async (projectId: string): Promise<{ settings: any; chapters: any[]; error: any }> => {
  if (!db) {
    return { settings: null, chapters: [], error: { message: 'CloudBase not configured' } };
  }

  try {
    // CRITICAL FIX: Use downloadSettings and downloadChapters to ensure proper snake_case to camelCase conversion
    const { downloadSettings, downloadChapters } = await import('./cloudbaseSyncService');

    const { data: settings, error: settingsError } = await downloadSettings(projectId);
    if (settingsError) {
      console.error('Error downloading settings:', settingsError);
      return { settings: null, chapters: [], error: settingsError };
    }

    const { data: chapters, error: chaptersError } = await downloadChapters(projectId);
    if (chaptersError) {
      console.error('Error downloading chapters:', chaptersError);
      return { settings, chapters: [], error: chaptersError };
    }

    return {
      settings,
      chapters,
      error: null
    };
  } catch (error: any) {
    console.error('Error getting project data:', error);
    return { settings: null, chapters: [], error };
  }
};

// Import project from backup file
export const importProject = async (
  title: string,
  settings: any,
  chapters: any[]
): Promise<{ data: Project | null; error: any }> => {
  if (!db || !auth) {
    return { data: null, error: { message: 'CloudBase not configured' } };
  }

  try {
    // Get current custom user
    const currentUser = await customAuth.getCurrentUser();
    if (!currentUser) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    // Ensure anonymous login for database access
    let loginState = await auth.getLoginState();
    if (!loginState) {
      await auth.signInAnonymously();
      loginState = await auth.getLoginState();
      if (!loginState) {
        return { data: null, error: { message: 'Failed to authenticate' } };
      }
    }

    const userId = currentUser.uid;

    // Set all existing projects to inactive
    await db.collection('projects')
      .where({ user_id: userId })
      .update({ is_active: false });

    // Create new project with imported source
    const result = await db.collection('projects').add({
      user_id: userId,
      title: title || '导入的项目',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_active: true,
      source: 'imported'
    });

    const projectId = result.id;

    // Upload settings and chapters to cloud
    const { uploadSettings, uploadChapters } = await import('./cloudbaseSyncService');

    await uploadSettings(projectId, settings);
    await uploadChapters(projectId, chapters);

    const project: Project = {
      _id: projectId,
      user_id: userId,
      title: title || '导入的项目',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_active: true,
      source: 'imported'
    };

    return { data: project, error: null };
  } catch (error: any) {
    console.error('Error importing project:', error);
    return { data: null, error };
  }
};
