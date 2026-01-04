import { useState, useEffect, useCallback } from 'react';
import { Alert, Button } from 'flowbite-react';
import { HiArrowRight } from 'react-icons/hi';
import { MainLayout } from './components/layout/MainLayout';
import { FileDropZone } from './components/home/FileDropZone';
import { FixtureTable } from './components/fixtures/FixtureTable';
import { FetchPanel } from './components/fetch/FetchPanel';
import { WizardContainer } from './components/wizard/WizardContainer';
import { useWizardState } from './components/wizard/useWizardState';
import { getSupportedManufacturers } from './services/tauri/commands';
import type { Fixture, FixtureSelection, BatchDownloadResult } from './types/fixture';
import type { ParseResult } from './services/excel/parser';
import type { StepConfig } from './components/wizard/WizardStepper';

type Page = 'wizard' | 'settings';

const WIZARD_STEPS: StepConfig[] = [
  { id: 'file', label: 'ファイル読込', description: 'Excelファイルを選択' },
  { id: 'fixtures', label: '器具一覧', description: '取得対象を選択' },
  { id: 'fetch', label: 'データ取得', description: 'IESファイルDL' },
];

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('wizard');
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [selections, setSelections] = useState<FixtureSelection[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [supportedManufacturers, setSupportedManufacturers] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<BatchDownloadResult | null>(null);

  // ウィザード状態管理
  const {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    resetWizard,
    canNavigateToStep,
  } = useWizardState(WIZARD_STEPS.length);

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

    // 次のステップへ自動遷移
    nextStep();
  }, [supportedManufacturers, nextStep]);

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

  // 選択されている器具の数
  const selectedCount = selections.filter((s) => s.selected).length;

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

            {/* Step 1: 器具一覧 */}
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

              <div className="flex justify-end mt-6">
                <Button onClick={nextStep} disabled={selectedCount === 0}>
                  データ取得へ進む
                  <HiArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Step 2: データ取得 */}
            <div className="space-y-4">
              <FetchPanel
                selections={selections}
                onProgressUpdate={handleProgressUpdate}
                onComplete={handleComplete}
              />

              {lastResult && (
                <div className="mt-6 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                  <h3 className="text-lg font-semibold mb-2">処理結果</h3>
                  <p>成功: {lastResult.successCount}件</p>
                  <p>失敗: {lastResult.failureCount}件</p>
                </div>
              )}

              <div className="flex justify-start mt-6">
                <Button color="light" onClick={resetWizard}>
                  新しいファイルを読み込む
                </Button>
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
