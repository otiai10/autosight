import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'flowbite-react';
import { MainLayout } from './components/layout/MainLayout';
import { FileDropZone } from './components/home/FileDropZone';
import { FixtureTable } from './components/fixtures/FixtureTable';
import { FetchPanel } from './components/fetch/FetchPanel';
import { getSupportedManufacturers } from './services/tauri/commands';
import type { Fixture, FixtureSelection, BatchDownloadResult } from './types/fixture';
import type { ParseResult } from './services/excel/parser';

type Page = 'home' | 'fixtures' | 'fetch' | 'output' | 'settings';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selections, setSelections] = useState<FixtureSelection[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [supportedManufacturers, setSupportedManufacturers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<BatchDownloadResult | null>(null);

  // 対応メーカーを取得
  useEffect(() => {
    getSupportedManufacturers()
      .then(setSupportedManufacturers)
      .catch(console.error);
  }, []);

  // ファイル読み込み完了時
  const handleFileLoaded = useCallback((result: ParseResult, name: string) => {
    setFixtures(result.fixtures);
    setFileName(name);
    setWarnings(result.warnings);

    // 選択状態を初期化（対応メーカーのみ選択）
    setSelections(
      result.fixtures.map((fixture) => ({
        fixture,
        selected: supportedManufacturers.some((m) => fixture.manufacturer.includes(m)),
        downloadStatus: undefined,
      }))
    );

    // 器具一覧ページに遷移
    setCurrentPage('fixtures');
  }, [supportedManufacturers]);

  // 選択状態の変更
  const handleSelectionChange = useCallback((newSelections: FixtureSelection[]) => {
    setSelections(newSelections);
  }, []);

  // ダウンロード進捗の更新
  const handleProgressUpdate = useCallback(
    (specNo: string, status: 'downloading' | 'success' | 'error', error?: string) => {
      setSelections((prev) =>
        prev.map((s) =>
          s.fixture.specNo === specNo
            ? { ...s, downloadStatus: status, downloadError: error }
            : s
        )
      );
    },
    []
  );

  // ダウンロード完了
  const handleComplete = useCallback((result: BatchDownloadResult) => {
    setLastResult(result);
  }, []);

  // ページに応じたコンテンツをレンダリング
  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return <FileDropZone onFileLoaded={handleFileLoaded} />;

      case 'fixtures':
        if (fixtures.length === 0) {
          return (
            <div className="text-center py-20">
              <p className="text-gray-500">
                まずExcelファイルを読み込んでください
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                器具一覧
              </h2>
              <p className="text-gray-500">{fileName}</p>
            </div>

            {warnings.length > 0 && (
              <Alert color="warning">
                <ul className="list-disc list-inside">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <FixtureTable
              fixtures={fixtures}
              selections={selections}
              onSelectionChange={handleSelectionChange}
              supportedManufacturers={supportedManufacturers}
            />
          </div>
        );

      case 'fetch':
        if (fixtures.length === 0) {
          return (
            <div className="text-center py-20">
              <p className="text-gray-500">
                まずExcelファイルを読み込んでください
              </p>
            </div>
          );
        }
        return (
          <FetchPanel
            selections={selections}
            onProgressUpdate={handleProgressUpdate}
            onComplete={handleComplete}
          />
        );

      case 'output':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">出力</h2>
            {lastResult ? (
              <div className="max-w-md mx-auto text-left bg-white p-6 rounded-lg shadow">
                <p className="text-lg font-semibold mb-2">最後の処理結果</p>
                <p>成功: {lastResult.successCount}件</p>
                <p>失敗: {lastResult.failureCount}件</p>
              </div>
            ) : (
              <p className="text-gray-500">
                まだ処理結果がありません
              </p>
            )}
          </div>
        );

      case 'settings':
        return (
          <div className="text-center py-20">
            <h2 className="text-2xl font-bold mb-4">設定</h2>
            <p className="text-gray-500 mb-4">対応メーカー:</p>
            <ul className="list-disc list-inside">
              {supportedManufacturers.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <MainLayout currentPage={currentPage} onNavigate={(page) => setCurrentPage(page as Page)}>
      {renderContent()}
    </MainLayout>
  );
}

export default App;
