import cloudbase from '@cloudbase/js-sdk';
import { ChapterDraft, ChapterConfig, ChatMessage, ChapterVersion, Chapter } from '../types';

const app = cloudbase.init({
  env: import.meta.env.VITE_TCB_ENV_ID || 'ai-novel-6gz22r4k5fbbee49'
});

const db = app.database();
const draftsCollection = db.collection('chapterDrafts');

/**
 * 草稿管理服务
 */
export class DraftService {
  /**
   * 获取项目的当前草稿（最近编辑的）
   */
  static async getCurrentDraft(projectId: string): Promise<ChapterDraft | null> {
    try {
      const res = await draftsCollection
        .where({
          projectId: projectId,
          status: 'editing'
        })
        .orderBy('updatedAt', 'desc')
        .limit(1)
        .get();

      if (res.data && res.data.length > 0) {
        return res.data[0] as ChapterDraft;
      }
      return null;
    } catch (error) {
      console.error('Error getting current draft:', error);
      return null;
    }
  }

  /**
   * 获取项目的所有草稿列表
   */
  static async getDrafts(projectId: string): Promise<ChapterDraft[]> {
    try {
      const res = await draftsCollection
        .where({
          projectId: projectId
        })
        .orderBy('updatedAt', 'desc')
        .get();

      return (res.data || []) as ChapterDraft[];
    } catch (error) {
      console.error('Error getting drafts:', error);
      return [];
    }
  }

  /**
   * 保存草稿（创建或更新）
   */
  static async saveDraft(draft: ChapterDraft): Promise<ChapterDraft | null> {
    try {
      const now = Date.now();

      // 如果有 _id，说明是更新
      if (draft._id) {
        // 准备更新数据，移除系统字段
        const { _id, _openid, ...draftData } = draft as any;
        const updateData = {
          ...draftData,
          updatedAt: now
        };

        console.log('Updating draft with _id:', _id);
        console.log('Update data:', updateData);

        // 使用 set() 完全替换文档
        await draftsCollection.doc(_id).set(updateData);

        console.log('Draft updated successfully');
        return { ...updateData, _id, updatedAt: now } as ChapterDraft;
      } else {
        // 创建新草稿
        const draftData = {
          ...draft,
          createdAt: now,
          updatedAt: now
        };

        console.log('Creating new draft:', draftData);
        const res = await draftsCollection.add(draftData);
        console.log('Draft created with id:', res.id);

        return { ...draftData, _id: res.id } as ChapterDraft;
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      return null;
    }
  }

  /**
   * 删除草稿
   */
  static async deleteDraft(draftId: string): Promise<boolean> {
    try {
      await draftsCollection.doc(draftId).remove();
      return true;
    } catch (error) {
      console.error('Error deleting draft:', error);
      return false;
    }
  }

  /**
   * 创建新草稿
   */
  static createNewDraft(
    projectId: string,
    chapterNumber: number = 0,
    config?: Partial<ChapterConfig>
  ): ChapterDraft {
    const now = Date.now();
    return {
      id: `draft_${now}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      chapterNumber,
      title: '',
      content: '',
      config: {
        wordCount: null,
        selectedCharacters: [],
        newCharacters: [],
        plotPoints: [],
        synopsis: '',
        authorNote: '',
        ...config
      },
      chatHistory: [],
      versions: [],
      createdAt: now,
      updatedAt: now,
      status: 'editing'
    };
  }

  /**
   * 从正式章节创建草稿（用于修改已发布章节）
   */
  static createDraftFromChapter(
    projectId: string,
    chapter: Chapter,
    config?: ChapterConfig
  ): ChapterDraft {
    const now = Date.now();
    return {
      id: `draft_${now}_${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      chapterNumber: chapter.number,
      title: chapter.title,
      content: chapter.content,
      config: config || {
        wordCount: null,
        selectedCharacters: [],
        newCharacters: [],
        plotPoints: [],
        synopsis: chapter.summary || '',
        authorNote: ''
      },
      chatHistory: [],
      versions: [{
        id: `version_${now}`,
        content: chapter.content,
        timestamp: now,
        note: '从已发布章节创建',
        type: 'manual'
      }],
      createdAt: now,
      updatedAt: now,
      status: 'editing'
    };
  }

  /**
   * 将草稿标记为已完成
   */
  static async completeDraft(draftId: string): Promise<boolean> {
    try {
      await draftsCollection.doc(draftId).update({
        status: 'completed',
        updatedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error completing draft:', error);
      return false;
    }
  }

  /**
   * 清理过期草稿（超过30天未更新的已完成草稿）
   */
  static async cleanupOldDrafts(projectId: string): Promise<number> {
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

      const res = await draftsCollection
        .where({
          projectId: projectId,
          status: 'completed',
          updatedAt: db.command.lt(thirtyDaysAgo)
        })
        .get();

      const draftsToDelete = res.data || [];

      for (const draft of draftsToDelete) {
        await draftsCollection.doc(draft._id).remove();
      }

      return draftsToDelete.length;
    } catch (error) {
      console.error('Error cleaning up old drafts:', error);
      return 0;
    }
  }

  /**
   * 更新草稿的特定字段
   */
  static async updateDraftField(
    draftId: string,
    field: keyof ChapterDraft,
    value: any
  ): Promise<boolean> {
    try {
      await draftsCollection.doc(draftId).update({
        [field]: value,
        updatedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error updating draft field:', error);
      return false;
    }
  }

  /**
   * 添加版本到草稿
   */
  static async addVersion(
    draftId: string,
    version: ChapterVersion
  ): Promise<boolean> {
    try {
      const draft = await draftsCollection.doc(draftId).get();
      if (!draft.data) return false;

      const currentDraft = draft.data as ChapterDraft;
      const versions = currentDraft.versions || [];

      // 只保留最近20个版本
      const updatedVersions = [...versions, version].slice(-20);

      await draftsCollection.doc(draftId).update({
        versions: updatedVersions,
        updatedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error adding version:', error);
      return false;
    }
  }

  /**
   * 更新聊天历史
   */
  static async updateChatHistory(
    draftId: string,
    chatHistory: ChatMessage[]
  ): Promise<boolean> {
    try {
      await draftsCollection.doc(draftId).update({
        chatHistory: chatHistory,
        updatedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Error updating chat history:', error);
      return false;
    }
  }
}

export default DraftService;
