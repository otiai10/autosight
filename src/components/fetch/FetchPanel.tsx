import { useState } from 'react';
import { Card, Button, Progress, Alert, TextInput } from 'flowbite-react';
import { HiDownload, HiFolder, HiFolderOpen, HiExclamation, HiCheck } from 'react-icons/hi';
import { open } from '@tauri-apps/plugin-dialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { batchDownloadIesFiles } from '../../services/tauri/commands';
import type { FixtureSelection, BatchDownloadResult } from '../../types/fixture';

interface FetchPanelProps {
  selections: FixtureSelection[];
  onProgressUpdate: (
    specNo: string,
    status: 'downloading' | 'success' | 'error',
    error?: string
  ) => void;
  onComplete: (result: BatchDownloadResult) => void;
}

export function FetchPanel({ selections, onProgressUpdate, onComplete }: FetchPanelProps) {
  const [destDir, setDestDir] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchDownloadResult | null>(null);

  const selectedItems = selections.filter((s) => s.selected);

  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    if (selected && typeof selected === 'string') {
      setDestDir(selected);
    }
  };

  const handleOpenFolder = async () => {
    if (destDir) {
      await revealItemInDir(destDir);
    }
  };

  const handleStartDownload = async () => {
    if (!destDir) {
      setError('保存先フォルダを選択してください');
      return;
    }

    if (selectedItems.length === 0) {
      setError('ダウンロードする器具を選択してください');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setResult(null);
    setProgress({ current: 0, total: selectedItems.length });

    try {
      // 各アイテムのステータスを更新
      selectedItems.forEach((item) => {
        onProgressUpdate(item.fixture.specNo, 'downloading');
      });

      const downloadResult = await batchDownloadIesFiles({
        items: selectedItems.map((item) => ({
          specNo: item.fixture.specNo,
          manufacturer: item.fixture.manufacturer,
          modelNumber: item.fixture.fixture,
        })),
        destDir,
      });

      // 結果に基づいてステータスを更新
      downloadResult.results.forEach((r) => {
        onProgressUpdate(
          r.specNo,
          r.result.success ? 'success' : 'error',
          r.result.error
        );
      });

      setResult(downloadResult);
      onComplete(downloadResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        IESファイル取得
      </h2>

      {/* 選択状況 */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">選択中の器具</h3>
            <p className="text-gray-500">{selectedItems.length}件の器具が選択されています</p>
          </div>
          {selectedItems.length > 0 && (
            <div className="text-right">
              <p className="text-sm text-gray-500">対応メーカー</p>
              <p className="font-semibold">
                {[...new Set(selectedItems.map((s) => s.fixture.manufacturer))].join(', ')}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* 保存先設定 */}
      <Card>
        <h3 className="text-lg font-semibold mb-4">保存先フォルダ</h3>
        <div className="flex gap-2">
          <TextInput
            value={destDir}
            onChange={(e) => setDestDir(e.target.value)}
            placeholder="保存先フォルダを選択..."
            className="flex-1"
            readOnly
          />
          <Button color="gray" onClick={handleSelectFolder}>
            <HiFolder className="w-5 h-5 mr-2" />
            選択
          </Button>
        </div>
      </Card>

      {/* ダウンロードボタン */}
      <div className="flex justify-center">
        <Button
          size="xl"
          color="blue"
          onClick={handleStartDownload}
          disabled={isDownloading || selectedItems.length === 0 || !destDir}
        >
          <HiDownload className="w-6 h-6 mr-2" />
          {isDownloading ? 'ダウンロード中...' : 'IESファイルをダウンロード'}
        </Button>
      </div>

      {/* 進捗表示 */}
      {isDownloading && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">ダウンロード進捗</h3>
          <Progress
            progress={(progress.current / progress.total) * 100}
            size="lg"
            color="blue"
          />
          <p className="text-center text-gray-500 mt-2">
            {progress.current} / {progress.total} 完了
          </p>
        </Card>
      )}

      {/* エラー表示 */}
      {error && (
        <Alert color="failure" icon={HiExclamation}>
          {error}
        </Alert>
      )}

      {/* 結果表示 */}
      {result && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <HiCheck className="w-8 h-8 text-green-500" />
              <div>
                <h3 className="text-lg font-semibold">ダウンロード完了</h3>
                <p className="text-gray-500">
                  成功: {result.successCount}件 / 失敗: {result.failureCount}件
                </p>
              </div>
            </div>
            <Button color="gray" onClick={handleOpenFolder}>
              <HiFolderOpen className="w-5 h-5 mr-2" />
              保存先を開く
            </Button>
          </div>

          {result.failureCount > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold text-red-600 mb-2">失敗した器具:</h4>
              <ul className="list-disc list-inside text-sm text-gray-600">
                {result.results
                  .filter((r) => !r.result.success)
                  .map((r) => (
                    <li key={r.specNo}>
                      {r.specNo} ({r.modelNumber}): {r.result.error}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
