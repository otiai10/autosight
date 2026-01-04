import { useState, useEffect, useCallback } from 'react';
import { Alert, Button, Card, Spinner, TextInput } from 'flowbite-react';
import { HiArrowRight, HiCheck, HiFolder, HiFolderOpen, HiDownload, HiDocumentDownload } from 'react-icons/hi';
import { open } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { MainLayout } from './components/layout/MainLayout';
import { FileDropZone } from './components/home/FileDropZone';
import { FixtureTable } from './components/fixtures/FixtureTable';
import { WizardContainer } from './components/wizard/WizardContainer';
import { useWizardState } from './components/wizard/useWizardState';
import { getSupportedManufacturers, batchDownloadIesFiles, listenDownloadProgress } from './services/tauri/commands';
import { updateIesFileCheck } from './services/excel/parser';
import type { Fixture, FixtureSelection, BatchDownloadResult } from './types/fixture';
import type { ParseResult } from './services/excel/parser';
import type { StepConfig } from './components/wizard/WizardStepper';
import type { Workbook } from 'exceljs';

type Page = 'wizard' | 'settings';

const WIZARD_STEPS: StepConfig[] = [
  { id: 'file', label: 'ファイル読込', description: 'Excelを選択' },
  { id: 'process', label: '処理', description: '選択・DL・保存' },
  { id: 'complete', label: '完了', description: '結果確認' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('wizard');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selections, setSelections] = useState<FixtureSelection[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [filePath, setFilePath] = useState<string>('');
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [fixtureBaseSheetName, setFixtureBaseSheetName] = useState<string>('');
  const [supportedManufacturers, setSupportedManufacturers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // ダウンロード関連
  const [destDir, setDestDir] = useState<string>('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastResult, setLastResult] = useState<BatchDownloadResult | null>(null);

  // Excel保存関連
  const [isSaving, setIsSaving] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ウィザード状態管理
  const {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    resetWizard: resetWizardState,
    canNavigateToStep,
  } = useWizardState(WIZARD_STEPS.length);

  // 対応メーカーを取得
  useEffect(() => {
    getSupportedManufacturers()
      .then(setSupportedManufacturers)
      .catch(console.error);
  }, []);

  // ダウンロード進捗イベントをリッスン
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listenDownloadProgress((event) => {
      setSelections((prev) =>
        prev.map((s) => {
          if (s.fixture.specNo !== event.specNo) return s;

          // ステータスに応じて更新
          if (event.status === 'processing') {
            return { ...s, downloadStatus: 'downloading' };
          } else if (event.status === 'success') {
            return { ...s, downloadStatus: 'success', downloadError: undefined };
          } else if (event.status === 'error') {
            return { ...s, downloadStatus: 'error', downloadError: event.error };
          }
          return s;
        })
      );
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // ウィザードリセット
  const resetWizard = useCallback(() => {
    resetWizardState();
    setFixtures([]);
    setSelections([]);
    setFileName('');
    setFilePath('');
    setWorkbook(null);
    setFixtureBaseSheetName('');
    setWarnings([]);
    setDestDir('');
    setLastResult(null);
    setSaveComplete(false);
    setSaveError(null);
  }, [resetWizardState]);

  // ファイル読み込み完了時
  const handleFileLoaded = useCallback((result: ParseResult, name: string, path: string) => {
    setFixtures(result.fixtures);
    setFileName(name);
    setFilePath(path);
    setWorkbook(result.workbook);
    setFixtureBaseSheetName(result.fixtureBaseSheetName);
    setWarnings(result.warnings);
    setLastResult(null);
    setSaveComplete(false);
    setSaveError(null);

    // 保存先を元ファイルと同じフォルダに設定
    const dir = path.substring(0, path.lastIndexOf('/'));
    setDestDir(dir);

    // 選択状態を初期化（対応メーカーのみ選択）
    setSelections(
      result.fixtures.map((fixture) => ({
        fixture,
        selected: supportedManufacturers.some((m) => fixture.manufacturer.includes(m)),
        downloadStatus: undefined,
      }))
    );

    nextStep();
  }, [supportedManufacturers, nextStep]);

  // 選択状態の変更
  const handleSelectionChange = useCallback((newSelections: FixtureSelection[]) => {
    setSelections(newSelections);
  }, []);

  // フォルダ選択
  const handleSelectFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      defaultPath: destDir || undefined,
    });
    if (selected && typeof selected === 'string') {
      setDestDir(selected);
    }
  };

  // フォルダを開く
  const handleOpenFolder = async () => {
    if (destDir) {
      await revealItemInDir(destDir);
    }
  };

  // ダウンロード実行
  const handleDownload = useCallback(async () => {
    const selectedItems = selections.filter((s) => s.selected);
    if (!destDir || selectedItems.length === 0) return;

    setIsDownloading(true);
    setLastResult(null);

    // 選択アイテムを「待機中」状態に（イベントで順次更新される）
    setSelections((prev) =>
      prev.map((s) => ({
        ...s,
        downloadStatus: s.selected ? 'waiting' : s.downloadStatus,
        downloadError: undefined,
      }))
    );

    try {
      const result = await batchDownloadIesFiles({
        items: selectedItems.map((item) => ({
          specNo: item.fixture.specNo,
          manufacturer: item.fixture.manufacturer,
          modelNumber: item.fixture.fixture,
          psu: item.fixture.psu,
        })),
        destDir,
      });

      // 最終結果を保存（サマリー表示用）
      setLastResult(result);
    } catch (err) {
      console.error('Download error:', err);
      // エラー時は待機中のアイテムをerror状態に
      setSelections((prev) =>
        prev.map((s) => ({
          ...s,
          downloadStatus: s.downloadStatus === 'waiting' ? 'error' : s.downloadStatus,
          downloadError: s.downloadStatus === 'waiting'
            ? (err instanceof Error ? err.message : 'ダウンロードに失敗')
            : s.downloadError,
        }))
      );
    } finally {
      setIsDownloading(false);
    }
  }, [selections, destDir]);

  // Excel保存処理
  const handleSaveToExcel = useCallback(async () => {
    if (!workbook || !filePath || !lastResult) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updates = lastResult.results
        .filter((r) => r.result.success && r.result.filePath)
        .map((r) => ({
          specNo: r.specNo,
          filePath: r.result.filePath!,
        }));

      const updatedData = await updateIesFileCheck(workbook, fixtureBaseSheetName, updates);
      await writeFile(filePath, updatedData);

      setSaveComplete(true);
      nextStep(); // 完了画面へ
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'ファイルの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [workbook, filePath, fixtureBaseSheetName, lastResult, nextStep]);

  // 選択されている器具の数
  const selectedCount = selections.filter((s) => s.selected).length;
  const canDownload = selectedCount > 0 && destDir && !isDownloading;
  const canSave = lastResult && lastResult.successCount > 0 && !isSaving && !saveComplete;

  // ページに応じたコンテンツをレンダリング
  const renderContent = () => {
    switch (currentPage) {
      case 'wizard':
        return (
          <WizardContainer
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={goToStep}
            canNavigateToStep={canNavigateToStep}
          >
            {/* Step 0: ファイル読込 */}
            <FileDropZone onFileLoaded={handleFileLoaded} />

            {/* Step 1: 処理（一覧+DL+保存） */}
            <div className="space-y-4">
              {/* ヘッダー */}
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

              {/* アクションバー */}
              <Card>
                <div className="flex flex-wrap items-center gap-4">
                  {/* 保存先フォルダ */}
                  <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      保存先:
                    </span>
                    <TextInput
                      value={destDir}
                      onChange={(e) => setDestDir(e.target.value)}
                      placeholder="保存先フォルダを選択..."
                      className="flex-1"
                      readOnly
                    />
                    <Button color="gray" size="sm" onClick={handleSelectFolder}>
                      <HiFolder className="w-4 h-4" />
                    </Button>
                    {destDir && (
                      <Button color="gray" size="sm" onClick={handleOpenFolder}>
                        <HiFolderOpen className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* ダウンロードボタン */}
                  <Button
                    color="blue"
                    disabled={!canDownload}
                    onClick={handleDownload}
                  >
                    {isDownloading ? (
                      <>
                        <Spinner size="sm" className="mr-2" />
                        ダウンロード中...
                      </>
                    ) : (
                      <>
                        <HiDownload className="w-5 h-5 mr-2" />
                        IESダウンロード ({selectedCount}件)
                      </>
                    )}
                  </Button>

                  {/* Excel保存ボタン */}
                  {lastResult && (
                    <Button
                      color={saveComplete ? 'success' : 'green'}
                      disabled={!canSave}
                      onClick={handleSaveToExcel}
                    >
                      {isSaving ? (
                        <>
                          <Spinner size="sm" className="mr-2" />
                          保存中...
                        </>
                      ) : saveComplete ? (
                        <>
                          <HiCheck className="w-5 h-5 mr-2" />
                          保存完了
                        </>
                      ) : (
                        <>
                          <HiDocumentDownload className="w-5 h-5 mr-2" />
                          Excelに上書き保存
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* 結果サマリー */}
                {lastResult && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600 font-medium">
                        成功: {lastResult.successCount}件
                      </span>
                      {lastResult.failureCount > 0 && (
                        <span className="text-red-600 font-medium">
                          失敗: {lastResult.failureCount}件
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {saveError && (
                  <Alert color="failure" className="mt-4">
                    {saveError}
                  </Alert>
                )}
              </Card>

              {/* テーブル */}
              <FixtureTable
                fixtures={fixtures}
                selections={selections}
                onSelectionChange={handleSelectionChange}
                supportedManufacturers={supportedManufacturers}
              />
            </div>

            {/* Step 2: 完了 */}
            <div className="space-y-6">
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-6">
                  <HiCheck className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  処理が完了しました
                </h2>

                <Card className="max-w-md mx-auto text-left">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">読込ファイル:</span>
                      <span className="font-medium">{fileName}</span>
                    </div>
                    {lastResult && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">ダウンロード成功:</span>
                          <span className="font-medium text-green-600">{lastResult.successCount}件</span>
                        </div>
                        {lastResult.failureCount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">ダウンロード失敗:</span>
                            <span className="font-medium text-red-600">{lastResult.failureCount}件</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Excel保存:</span>
                      <span className="font-medium text-green-600">完了</span>
                    </div>
                  </div>
                </Card>

                <div className="mt-8">
                  <Button onClick={resetWizard}>
                    新しいファイルを読み込む
                    <HiArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </WizardContainer>
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
