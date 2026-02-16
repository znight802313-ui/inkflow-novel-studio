import { db, auth } from '../lib/cloudbase';

export interface Project {
  _id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
  last_synced_at?: number;
  is_active: boolean;
}

// Create a new project
export const createProject = async (title: string): Promise<{ data: Project | null; error: any }> => {
  if (!db || !auth) {
    return { data: null, error: { message: 'CloudBase not configured' } };
  }

  try {
    // Sign in anonymously first
    await auth.signInAnonymously();

    const loginState = await auth.getLoginState();
    if (!loginState) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    const userId = loginState.user.uid;

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
      is_active: true
    });

    const project: Project = {
      _id: result.id,
      user_id: userId,
      title: title || '新小说项目',
      created_at: Date.now(),
      updated_at: Date.now(),
      is_active: true
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
    // Sign in anonymously first
    await auth.signInAnonymously();

    const loginState = await auth.getLoginState();
    if (!loginState) {
      return { data: [], error: { message: 'Not authenticated' } };
    }

    const result = await db.collection('projects')
      .where({ user_id: loginState.user.uid })
      .orderBy('updated_at', 'desc')
      .get();

    return { data: result.data as Project[], error: null };
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
    const loginState = await auth.getLoginState();
    if (!loginState) {
      return { data: null, error: { message: 'Not authenticated' } };
    }

    const result = await db.collection('projects')
      .where({ user_id: loginState.user.uid, is_active: true })
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

  try {
    // Sign in anonymously first
    await auth.signInAnonymously();

    const loginState = await auth.getLoginState();
    if (!loginState) {
      return { error: { message: 'Not authenticated' } };
    }

    // Set all projects to inactive
    await db.collection('projects')
      .where({ user_id: loginState.user.uid })
      .update({ is_active: false });

    // Set selected project to active
    await db.collection('projects')
      .doc(projectId)
      .update({ is_active: true, updated_at: Date.now() });

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
    // Get settings
    const settingsResult = await db.collection('novel_settings')
      .where({ project_id: projectId })
      .limit(1)
      .get();

    // Get chapters
    const chaptersResult = await db.collection('chapters')
      .where({ project_id: projectId })
      .orderBy('number', 'asc')
      .get();

    return {
      settings: settingsResult.data[0] || null,
      chapters: chaptersResult.data || [],
      error: null
    };
  } catch (error: any) {
    console.error('Error getting project data:', error);
    return { settings: null, chapters: [], error };
  }
};
