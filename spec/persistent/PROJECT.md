# Project 仕様

## 概要

ユーザーが管理する照明設計プロジェクトの永続化データ。複数のプロジェクトを作成・管理でき、各プロジェクトは特定のディレクトリに紐づく。

## 属性

| 属性名 | 型 | 必須 | 説明 |
|--------|-----|------|------|
| `id` | `string` | Yes | 一意識別子（nanoid, 英数字10文字） |
| `root_dir` | `string` | Yes | プロジェクトのルートディレクトリパス（**Unique**） |
| `name` | `string` | Yes | プロジェクト名（デフォルトは `root_dir` の basename） |
| `created_at` | `string` | Yes | 作成日時（ISO 8601） |
| `last_updated_at` | `string` | Yes | 最終更新日時（ISO 8601） |
| `spec_excel_path` | `string` | No | 器具リストExcelファイルのパス（`root_dir` 配下を期待） |
| `ies_dir_path` | `string` | No | IESファイル保存先ディレクトリ（`root_dir` 配下を期待） |

**制約**:
- `id` は Primary Key（内部参照用）
- `root_dir` は Unique（同じディレクトリを複数のプロジェクトで参照することはできない）

### root_dir について

- 既存のディレクトリを指定する
- 内部構造は自由だが、`spec_excel_path` や `ies_dir_path` は `root_dir` 配下であることを強く期待
- `name` のデフォルト値は `root_dir` の basename から取得

## 型定義

```typescript
import { customAlphabet } from 'nanoid';

interface Project {
  id: string;              // Primary Key (nanoid 10文字, 英数字のみ)
  root_dir: string;        // Unique
  name: string;
  created_at: string;
  last_updated_at: string;
  spec_excel_path?: string;
  ies_dir_path?: string;
}

// ID生成（英数字のみ、10文字）
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const createProjectId = customAlphabet(alphabet, 10);
```

## ストレージ

### 使用プラグイン

`tauri-plugin-store` を使用してKVS形式で永続化する。

### ストアファイル

```
{app_data_dir}/autosight.store.json
```

### キー構造

| キー | 型 | 説明 |
|------|-----|------|
| `projects` | `Project[]` | 全プロジェクトのリスト |
| `current_project_id` | `string \| null` | 現在選択中のプロジェクトの `id` |

### ストレージ操作

```typescript
// 読み込み
const projects = await store.get<Project[]>('projects') ?? [];
const currentProjectId = await store.get<string | null>('current_project_id');

// 保存
await store.set('projects', projects);
await store.set('current_project_id', project.id);
await store.save();
```

## 操作

### 作成

1. ユーザーが `root_dir` を選択（ディレクトリ選択ダイアログ）
2. 同じ `root_dir` のプロジェクトが既に存在する場合はエラー
3. `id` を nanoid(10) で生成
4. `name` にデフォルト値（basename）を設定、編集可能
5. 新規 `Project` を生成し `projects` に追加
6. 作成したプロジェクトの `id` を `current_project_id` に設定

### 選択

1. プロジェクト一覧から選択
2. `current_project_id` を選択したプロジェクトの `id` に更新
3. プロジェクト詳細画面へ遷移

### 削除

1. 確認ダイアログを表示
2. `projects` から該当プロジェクトを削除
3. `current_project_id` が削除対象の `id` なら `null` に設定

**注意**: ファイルシステム上のファイルは削除しない（参照のみ削除）

## 画面遷移

```
[サイドナビ: プロジェクト]
        │
        ▼
┌─────────────────────┐
│  プロジェクト一覧    │  ← 作成・削除が可能
│  - Project A        │
│  - Project B        │
│  + 新規作成         │
└─────────────────────┘
        │ 選択
        ▼
┌─────────────────────┐
│  プロジェクト詳細    │
│  - 基本情報         │
│  - Excelファイル設定 │
│  - IES保存先設定    │
│  ──────────────────│
│  [IES取得を開始] ──────→ IES取得ウィザード
└─────────────────────┘
```

## 実装ファイル

- `src/types/project.ts` - 型定義
- `src/hooks/useProjects.ts` - プロジェクト操作フック
- `src/pages/ProjectListPage.tsx` - プロジェクト一覧画面
- `src/pages/ProjectDetailPage.tsx` - プロジェクト詳細画面
