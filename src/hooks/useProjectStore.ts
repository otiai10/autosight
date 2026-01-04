/**
 * プロジェクトストレージフック
 * tauri-plugin-store を使用したプロジェクト永続化
 */

import { useState, useEffect, useCallback } from 'react';
import { Store } from '@tauri-apps/plugin-store';
import {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  createProjectId,
} from '../types/project';

const STORE_NAME = 'autosight.store.json';
const PROJECTS_KEY = 'projects';
const CURRENT_PROJECT_KEY = 'current_project_id';

/** プロジェクトストアの状態 */
export interface ProjectStoreState {
  projects: Project[];
  currentProjectId: string | null;
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;
}

/** プロジェクトストアの操作 */
export interface ProjectStoreActions {
  createProject: (input: CreateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  selectProject: (id: string | null) => Promise<void>;
  updateProject: (id: string, input: UpdateProjectInput) => Promise<Project>;
  reload: () => Promise<void>;
}

export type UseProjectStoreReturn = ProjectStoreState & ProjectStoreActions;

/** ディレクトリパスからbasenameを取得 */
function getBasename(path: string): string {
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || path;
}

/** ストアインスタンスを取得（キャッシュ） */
let storePromise: Promise<Store> | null = null;
async function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = Store.load(STORE_NAME, {
      defaults: {},
      autoSave: false,
    });
  }
  return storePromise;
}

export function useProjectStore(): UseProjectStoreReturn {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentProject =
    projects.find((p) => p.id === currentProjectId) || null;

  /** ストアからデータを読み込む */
  const loadFromStore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const store = await getStore();
      const loadedProjects =
        (await store.get<Project[]>(PROJECTS_KEY)) ?? [];
      const loadedCurrentId =
        (await store.get<string | null>(CURRENT_PROJECT_KEY)) ?? null;
      setProjects(loadedProjects);
      setCurrentProjectId(loadedCurrentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load store');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** ストアにデータを保存する */
  const saveToStore = useCallback(
    async (newProjects: Project[], newCurrentId: string | null) => {
      try {
        const store = await getStore();
        await store.set(PROJECTS_KEY, newProjects);
        await store.set(CURRENT_PROJECT_KEY, newCurrentId);
        await store.save();
      } catch (e) {
        throw new Error(
          e instanceof Error ? e.message : 'Failed to save store'
        );
      }
    },
    []
  );

  /** 初期ロード */
  useEffect(() => {
    loadFromStore();
  }, [loadFromStore]);

  /** プロジェクト作成 */
  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project> => {
      // 重複チェック
      if (projects.some((p) => p.root_dir === input.root_dir)) {
        throw new Error('同じディレクトリのプロジェクトが既に存在します');
      }

      const now = new Date().toISOString();
      const newProject: Project = {
        id: createProjectId(),
        root_dir: input.root_dir,
        name: input.name || getBasename(input.root_dir),
        created_at: now,
        last_updated_at: now,
      };

      const newProjects = [...projects, newProject];
      await saveToStore(newProjects, newProject.id);
      setProjects(newProjects);
      setCurrentProjectId(newProject.id);

      return newProject;
    },
    [projects, saveToStore]
  );

  /** プロジェクト削除 */
  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      const newProjects = projects.filter((p) => p.id !== id);
      const newCurrentId = currentProjectId === id ? null : currentProjectId;
      await saveToStore(newProjects, newCurrentId);
      setProjects(newProjects);
      setCurrentProjectId(newCurrentId);
    },
    [projects, currentProjectId, saveToStore]
  );

  /** プロジェクト選択 */
  const selectProject = useCallback(
    async (id: string | null): Promise<void> => {
      if (id !== null && !projects.some((p) => p.id === id)) {
        throw new Error('指定されたプロジェクトが見つかりません');
      }
      await saveToStore(projects, id);
      setCurrentProjectId(id);
    },
    [projects, saveToStore]
  );

  /** プロジェクト更新 */
  const updateProject = useCallback(
    async (id: string, input: UpdateProjectInput): Promise<Project> => {
      const index = projects.findIndex((p) => p.id === id);
      if (index === -1) {
        throw new Error('指定されたプロジェクトが見つかりません');
      }

      const updatedProject: Project = {
        ...projects[index],
        ...input,
        last_updated_at: new Date().toISOString(),
      };

      const newProjects = [...projects];
      newProjects[index] = updatedProject;
      await saveToStore(newProjects, currentProjectId);
      setProjects(newProjects);

      return updatedProject;
    },
    [projects, currentProjectId, saveToStore]
  );

  return {
    projects,
    currentProjectId,
    currentProject,
    isLoading,
    error,
    createProject,
    deleteProject,
    selectProject,
    updateProject,
    reload: loadFromStore,
  };
}
