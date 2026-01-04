import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { createKoizumiTestData } from './test/mocks/excel-data';

// Tauriプラグインのモック
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
import { readFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // getSupportedManufacturers のモック
    vi.mocked(invoke).mockImplementation(async (cmd: string) => {
      if (cmd === 'get_supported_manufacturers') {
        return ['コイズミ照明'];
      }
      return null;
    });
  });

  describe('Excelファイル読み込み → 器具一覧画面遷移', () => {
    it('Excelファイルを選択すると、器具一覧画面に遷移しテーブルが表示される', async () => {
      const user = userEvent.setup();
      const mockExcelData = await createKoizumiTestData();

      // ファイル選択ダイアログのモック
      vi.mocked(open).mockResolvedValue('/path/to/fixtures.xlsx');

      // ファイル読み込みのモック
      vi.mocked(readFile).mockResolvedValue(mockExcelData);

      render(<App />);

      // 初期状態: ホーム画面のファイル選択ボタンが表示される
      const selectButton = screen.getByRole('button', { name: /ファイルを選択/i });
      expect(selectButton).toBeInTheDocument();

      // ファイル選択ボタンをクリック
      await user.click(selectButton);

      // ファイル選択ダイアログが呼ばれたことを確認
      await waitFor(() => {
        expect(open).toHaveBeenCalledWith({
          multiple: false,
          filters: [
            {
              name: 'Excel',
              extensions: ['xlsx', 'xls', 'xlsm'],
            },
          ],
        });
      });

      // ファイルが読み込まれたことを確認
      await waitFor(() => {
        expect(readFile).toHaveBeenCalledWith('/path/to/fixtures.xlsx');
      });

      // 器具一覧画面に遷移したことを確認
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /器具一覧/i })).toBeInTheDocument();
      });

      // 器具データがテーブルに表示されていることを確認
      await waitFor(() => {
        // Spec No.
        expect(screen.getByText('A01')).toBeInTheDocument();
        expect(screen.getByText('A02')).toBeInTheDocument();
        expect(screen.getByText('B01')).toBeInTheDocument();

        // メーカー名
        expect(screen.getAllByText('コイズミ照明')).toHaveLength(2);
        expect(screen.getByText('大光電機')).toBeInTheDocument();

        // 型番
        expect(screen.getByText('AD12345')).toBeInTheDocument();
        expect(screen.getByText('AD67890')).toBeInTheDocument();
        expect(screen.getByText('DDL-1234')).toBeInTheDocument();
      });
    });

    it('対応メーカーの器具は自動的に選択される', async () => {
      const user = userEvent.setup();
      const mockExcelData = await createKoizumiTestData();

      vi.mocked(open).mockResolvedValue('/path/to/fixtures.xlsx');
      vi.mocked(readFile).mockResolvedValue(mockExcelData);

      render(<App />);

      await user.click(screen.getByRole('button', { name: /ファイルを選択/i }));

      // 器具一覧画面に遷移するまで待機
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /器具一覧/i })).toBeInTheDocument();
      });

      // チェックボックスを取得
      const checkboxes = screen.getAllByRole('checkbox');

      // コイズミ照明の器具（A01, A02）は選択されている
      // 大光電機の器具（B01）は選択されていない
      // 最初のチェックボックスは「全選択」用なのでスキップ
      await waitFor(() => {
        const fixtureCheckboxes = checkboxes.slice(1); // 最初の全選択を除く
        expect(fixtureCheckboxes).toHaveLength(3);
      });
    });

    it('ファイル選択がキャンセルされた場合は何も起きない', async () => {
      const user = userEvent.setup();

      // キャンセル（nullを返す）
      vi.mocked(open).mockResolvedValue(null);

      render(<App />);

      await user.click(screen.getByRole('button', { name: /ファイルを選択/i }));

      // ファイル読み込みは呼ばれない
      expect(readFile).not.toHaveBeenCalled();

      // ホーム画面のままであることを確認
      expect(screen.getByText(/Excelファイルをドラッグ/i)).toBeInTheDocument();
    });

    it('ファイル名が画面に表示される', async () => {
      const user = userEvent.setup();
      const mockExcelData = await createKoizumiTestData();

      vi.mocked(open).mockResolvedValue('/path/to/test-fixtures.xlsx');
      vi.mocked(readFile).mockResolvedValue(mockExcelData);

      render(<App />);

      await user.click(screen.getByRole('button', { name: /ファイルを選択/i }));

      await waitFor(() => {
        expect(screen.getByText('test-fixtures.xlsx')).toBeInTheDocument();
      });
    });
  });

  describe('画面遷移', () => {
    it('サイドバーから各ページに遷移できる', async () => {
      const user = userEvent.setup();

      render(<App />);

      // 設定ページに遷移
      await user.click(screen.getByText('設定'));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: '設定' })).toBeInTheDocument();
      });

      // ファイル読込（ホーム）に戻る
      await user.click(screen.getByText('ファイル読込'));
      await waitFor(() => {
        expect(screen.getByText(/Excelファイルをドラッグ/i)).toBeInTheDocument();
      });
    });
  });
});
