import { useState } from 'react';
import { Card, Button, Alert, Modal, ModalHeader, ModalBody, ModalFooter } from 'flowbite-react';
import {
  HiFolder,
  HiFolderAdd,
  HiExclamation,
  HiTrash,
  HiChevronRight,
} from 'react-icons/hi';
import { open } from '@tauri-apps/plugin-dialog';
import { Project } from '../../types/project';
import { UseProjectStoreReturn } from '../../hooks/useProjectStore';

interface ProjectListPageProps {
  store: UseProjectStoreReturn;
  onSelectProject: (project: Project) => void;
}

export function ProjectListPage({ store, onSelectProject }: ProjectListPageProps) {
  const { projects, isLoading, error, createProject, deleteProject } = store;
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const handleCreateProject = async () => {
    setCreateError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'プロジェクトフォルダを選択',
      });

      if (selected) {
        setIsCreating(true);
        const dirPath = typeof selected === 'string' ? selected : String(selected);
        const project = await createProject({ root_dir: dirPath });
        onSelectProject(project);
      }
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'プロジェクトの作成に失敗しました'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : 'プロジェクトの削除に失敗しました'
      );
    }
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          プロジェクト
        </h2>
        <Button color="blue" onClick={handleCreateProject} disabled={isCreating}>
          <HiFolderAdd className="w-5 h-5 mr-2" />
          {isCreating ? '作成中...' : '新規作成'}
        </Button>
      </div>

      {(error || createError) && (
        <Alert color="failure" icon={HiExclamation} className="mb-4">
          {error || createError}
        </Alert>
      )}

      {projects.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10">
            <HiFolder className="w-16 h-16 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              プロジェクトがありません
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              新規作成ボタンからプロジェクトを作成してください
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              onClick={() => onSelectProject(project)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <HiFolder className="w-10 h-10 text-blue-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {project.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md">
                      {project.root_dir}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      作成: {formatDate(project.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    color="gray"
                    size="sm"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      setDeleteTarget(project);
                    }}
                  >
                    <HiTrash className="w-4 h-4" />
                  </Button>
                  <HiChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 削除確認モーダル */}
      <Modal show={deleteTarget !== null} onClose={() => setDeleteTarget(null)}>
        <ModalHeader>プロジェクトの削除</ModalHeader>
        <ModalBody>
          <p className="text-gray-700 dark:text-gray-300">
            「{deleteTarget?.name}」を削除しますか？
          </p>
          <p className="text-sm text-gray-500 mt-2">
            ※ ファイルシステム上のファイルは削除されません
          </p>
        </ModalBody>
        <ModalFooter>
          <Button color="failure" onClick={handleDeleteConfirm}>
            削除
          </Button>
          <Button color="gray" onClick={() => setDeleteTarget(null)}>
            キャンセル
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
