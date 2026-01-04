import { useState, useCallback } from 'react';
import { Card, Button, Alert } from 'flowbite-react';
import { HiDocumentAdd, HiExclamation } from 'react-icons/hi';
import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { parseExcelFromBinary, type ParseResult } from '../../services/excel/parser';

interface FileDropZoneProps {
  onFileLoaded: (result: ParseResult, fileName: string, filePath: string) => void;
}

export function FileDropZone({ onFileLoaded }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (filePath: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await readFile(filePath);
        const result = parseExcelFromBinary(data);
        const fileName = filePath.split('/').pop() || filePath;
        onFileLoaded(result, fileName, filePath);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
      } finally {
        setIsLoading(false);
      }
    },
    [onFileLoaded]
  );

  const handleSelectFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Excel',
            extensions: ['xlsx', 'xls', 'xlsm'],
          },
        ],
      });

      if (selected) {
        const filePath = typeof selected === 'string' ? selected : String(selected);
        await handleFile(filePath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイル選択に失敗しました');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      // Tauri環境ではファイルパスを直接取得できないため、
      // ドロップされたファイルはファイル選択ダイアログを使用
      await handleSelectFile();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Card
        className={`w-full max-w-xl cursor-pointer transition-all ${
          isDragging ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleSelectFile}
      >
        <div className="flex flex-col items-center py-10">
          <HiDocumentAdd className="w-16 h-16 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {isLoading ? '読み込み中...' : 'Excelファイルをドラッグ&ドロップ'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">または</p>
          <Button color="blue" disabled={isLoading}>
            ファイルを選択
          </Button>
          <p className="text-xs text-gray-400 mt-4">対応形式: .xlsx, .xls, .xlsm</p>
        </div>
      </Card>

      {error && (
        <Alert color="failure" icon={HiExclamation} className="mt-4 max-w-xl">
          {error}
        </Alert>
      )}
    </div>
  );
}
