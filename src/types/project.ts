/**
 * プロジェクトデータ型定義
 * spec/persistent/PROJECT.md に対応
 */

import { customAlphabet } from 'nanoid';

/** ID生成用アルファベット（英数字のみ） */
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/** プロジェクトID生成関数（英数字10文字） */
export const createProjectId = customAlphabet(alphabet, 10);

/** プロジェクトデータ */
export interface Project {
  /** 一意識別子（Primary Key） */
  id: string;
  /** プロジェクトのルートディレクトリパス（Unique） */
  root_dir: string;
  /** プロジェクト名 */
  name: string;
  /** 作成日時（ISO 8601） */
  created_at: string;
  /** 最終更新日時（ISO 8601） */
  last_updated_at: string;
  /** 器具リストExcelファイルのパス */
  spec_excel_path?: string;
  /** IESファイル保存先ディレクトリ */
  ies_dir_path?: string;
}

/** 新規プロジェクト作成用の入力データ */
export interface CreateProjectInput {
  root_dir: string;
  name?: string;
}

/** プロジェクト更新用の入力データ */
export interface UpdateProjectInput {
  name?: string;
  spec_excel_path?: string;
  ies_dir_path?: string;
}
