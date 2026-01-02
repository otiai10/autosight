import { useState } from "react";
import { Button, Card, FileInput, Label, Alert } from "flowbite-react";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile, mkdir } from "@tauri-apps/plugin-fs";
import { fetch } from "@tauri-apps/plugin-http";

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [excelPath, setExcelPath] = useState<string>("");

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // 検証1: ファイル選択ダイアログ
  const testFileDialog = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: "Excel", extensions: ["xlsx", "xls", "xlsm"] },
          { name: "All", extensions: ["*"] },
        ],
      });
      if (selected) {
        setExcelPath(selected as string);
        addLog(`ファイル選択成功: ${selected}`);
      } else {
        addLog("ファイル選択がキャンセルされました");
      }
    } catch (e) {
      addLog(`エラー: ${e}`);
    }
  };

  // 検証2: HTTP通信
  const testHttpFetch = async () => {
    try {
      addLog("HTTP GETリクエスト送信中...");
      const response = await fetch("https://httpbin.org/get", {
        method: "GET",
      });
      const data = await response.json();
      addLog(`HTTP成功! ステータス: ${response.status}`);
      addLog(`レスポンス: ${JSON.stringify(data).substring(0, 100)}...`);
    } catch (e) {
      addLog(`HTTPエラー: ${e}`);
    }
  };

  // 検証3: ファイル読み取り
  const testReadFile = async () => {
    if (!excelPath) {
      addLog("先にファイルを選択してください");
      return;
    }
    try {
      addLog(`ファイル読み取り中: ${excelPath}`);
      const contents = await readFile(excelPath);
      addLog(`ファイル読み取り成功! サイズ: ${contents.length} bytes`);
    } catch (e) {
      addLog(`ファイル読み取りエラー: ${e}`);
    }
  };

  // 検証4: ファイル書き込み
  const testWriteFile = async () => {
    try {
      const savePath = await open({
        directory: true,
        title: "保存先フォルダを選択",
      });
      if (!savePath) {
        addLog("フォルダ選択がキャンセルされました");
        return;
      }

      const testContent = `AutoSight テストファイル\n作成日時: ${new Date().toISOString()}\n`;
      const filePath = `${savePath}/autosight_test.txt`;

      await writeFile(filePath, new TextEncoder().encode(testContent));
      addLog(`ファイル書き込み成功: ${filePath}`);
    } catch (e) {
      addLog(`ファイル書き込みエラー: ${e}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">
          AutoSight - 技術検証
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* 検証1: ファイル選択 */}
          <Card>
            <h2 className="text-xl font-semibold mb-4">検証1: ファイル選択</h2>
            <Button onClick={testFileDialog} color="blue">
              Excelファイルを選択
            </Button>
            {excelPath && (
              <p className="mt-2 text-sm text-gray-600 truncate">
                選択: {excelPath}
              </p>
            )}
          </Card>

          {/* 検証2: HTTP通信 */}
          <Card>
            <h2 className="text-xl font-semibold mb-4">検証2: HTTP通信</h2>
            <Button onClick={testHttpFetch} color="green">
              HTTP GETテスト
            </Button>
          </Card>

          {/* 検証3: ファイル読み取り */}
          <Card>
            <h2 className="text-xl font-semibold mb-4">検証3: ファイル読み取り</h2>
            <Button onClick={testReadFile} color="purple">
              選択ファイルを読み取り
            </Button>
          </Card>

          {/* 検証4: ファイル書き込み */}
          <Card>
            <h2 className="text-xl font-semibold mb-4">検証4: ファイル書き込み</h2>
            <Button onClick={testWriteFile} color="pink">
              テストファイルを保存
            </Button>
          </Card>
        </div>

        {/* ログ表示 */}
        <Card>
          <h2 className="text-xl font-semibold mb-4">ログ</h2>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">ボタンをクリックして検証を開始...</p>
            ) : (
              logs.map((log, i) => <p key={i}>{log}</p>)
            )}
          </div>
          {logs.length > 0 && (
            <Button
              onClick={() => setLogs([])}
              color="gray"
              size="sm"
              className="mt-2"
            >
              ログをクリア
            </Button>
          )}
        </Card>
      </div>
    </div>
  );
}

export default App;
