import { useState } from 'react';
import { Card, Button, Alert, Label, TextInput } from 'flowbite-react';
import {
  HiArrowLeft,
  HiFolder,
  HiFolderOpen,
  HiDocumentText,
  HiPlay,
  HiExclamation,
  HiPencil,
  HiCheck,
  HiX,
} from 'react-icons/hi';
import { open } from '@tauri-apps/plugin-dialog';
import { Project } from '../../types/project';
import { UseProjectStoreReturn } from '../../hooks/useProjectStore';

interface ProjectDetailPageProps {
  project: Project;
  store: UseProjectStoreReturn;
  onBack: () => void;
  onStartWizard: () => void;
}

export function ProjectDetailPage({
  project,
  store,
  onBack,
  onStartWizard,
}: ProjectDetailPageProps) {
  const { updateProject } = store;
  const [error, setError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(project.name);

  const handleSelectExcel = async () => {
    setError(null);
    try {
      const selected = await open({
        multiple: false,
        defaultPath: project.root_dir,
        filters: [
          {
            name: 'Excel',
            extensions: ['xlsx', 'xls', 'xlsm'],
          },
        ],
        title: '器具リストExcelを選択',
      });

      if (selected) {
        const filePath = typeof selected === 'string' ? selected : String(selected);
        await updateProject(project.id, { spec_excel_path: filePath });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイル選択に失敗しました');
    }
  };

  const handleSelectIesDir = async () => {
    setError(null);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: project.root_dir,
        title: 'IES保存先フォルダを選択',
      });

      if (selected) {
        const dirPath = typeof selected === 'string' ? selected : String(selected);
        await updateProject(project.id, { ies_dir_path: dirPath });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'フォルダ選択に失敗しました');
    }
  };

  const handleSaveName = async () => {
    if (editName.trim() === '') return;
    try {
      await updateProject(project.id, { name: editName.trim() });
      setIsEditingName(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '名前の更新に失敗しました');
    }
  };

  const handleCancelEditName = () => {
    setEditName(project.name);
    setIsEditingName(false);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFileName = (path: string) => {
    return path.split('/').pop() || path;
  };

  const canStartWizard = project.spec_excel_path && project.ies_dir_path;

  return (
    <div className="max-w-3xl mx-auto">
      <Button color="gray" size="sm" onClick={onBack} className="mb-4">
        <HiArrowLeft className="w-4 h-4 mr-2" />
        プロジェクト一覧
      </Button>

      {error && (
        <Alert color="failure" icon={HiExclamation} className="mb-4">
          {error}
        </Alert>
      )}

      {/* 基本情報 */}
      <Card className="mb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <HiFolder className="w-12 h-12 text-blue-500" />
            <div>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <TextInput
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-64"
                    autoFocus
                  />
                  <Button size="xs" color="success" onClick={handleSaveName}>
                    <HiCheck className="w-4 h-4" />
                  </Button>
                  <Button size="xs" color="gray" onClick={handleCancelEditName}>
                    <HiX className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {project.name}
                  </h2>
                  <Button
                    size="xs"
                    color="gray"
                    onClick={() => setIsEditingName(true)}
                  >
                    <HiPencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {project.root_dir}
              </p>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-400 mt-4 space-y-1">
          <p>作成: {formatDate(project.created_at)}</p>
          <p>更新: {formatDate(project.last_updated_at)}</p>
        </div>
      </Card>

      {/* ファイル設定 */}
      <Card className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ファイル設定
        </h3>

        <div className="space-y-4">
          {/* Excel ファイル */}
          <div>
            <Label className="mb-2 block">器具リスト Excel</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <HiDocumentText className="w-5 h-5 text-gray-400" />
                {project.spec_excel_path ? (
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {getFileName(project.spec_excel_path)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">未設定</span>
                )}
              </div>
              <Button color="gray" onClick={handleSelectExcel}>
                選択
              </Button>
            </div>
            {project.spec_excel_path && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {project.spec_excel_path}
              </p>
            )}
          </div>

          {/* IES 保存先 */}
          <div>
            <Label className="mb-2 block">IES 保存先フォルダ</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <HiFolderOpen className="w-5 h-5 text-gray-400" />
                {project.ies_dir_path ? (
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {getFileName(project.ies_dir_path)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">未設定</span>
                )}
              </div>
              <Button color="gray" onClick={handleSelectIesDir}>
                選択
              </Button>
            </div>
            {project.ies_dir_path && (
              <p className="text-xs text-gray-400 mt-1 truncate">
                {project.ies_dir_path}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* アクション */}
      <Card>
        <div className="flex flex-col items-center py-4">
          <Button
            color="blue"
            size="lg"
            onClick={onStartWizard}
            disabled={!canStartWizard}
          >
            <HiPlay className="w-5 h-5 mr-2" />
            IES 取得を開始
          </Button>
          {!canStartWizard && (
            <p className="text-sm text-gray-500 mt-3">
              ExcelファイルとIES保存先を設定してください
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
