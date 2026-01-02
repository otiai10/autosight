# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

AutoSight - IES照明器具リスト用Excelデータ処理デスクトップアプリケーション

照明設計プロジェクトで使用するExcelファイル（器具リスト）を読み込み、Webサービスと連携してデータ処理を行う。

## 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite
- **デスクトップ**: Tauri 2 (Rust)
- **UI**: Flowbite React + Tailwind CSS
- **パッケージマネージャ**: pnpm

## 開発コマンド

```bash
# 開発サーバー起動（Tauri + Vite）
pnpm tauri dev

# フロントエンドのみ（ブラウザで確認）
pnpm dev

# ビルド
pnpm tauri build

# 型チェック
pnpm build  # tsc && vite build
```

## アーキテクチャ

```
src/              # Reactフロントエンド
src-tauri/        # Tauri (Rust) バックエンド
  src/lib.rs      # Tauriプラグイン初期化
schema/           # Excelスキーマ定義 (JSON Schema)
example/          # サンプルExcelファイル（gitignore）
```

### Tauriプラグイン（有効化済み）

- `tauri-plugin-dialog`: ファイル選択ダイアログ
- `tauri-plugin-fs`: ファイル読み書き
- `tauri-plugin-http`: HTTP通信
- `tauri-plugin-opener`: 外部アプリ起動

### Excelスキーマ

`schema/ies-fixture-list.schema.json` でExcelファイル構造を定義。主要シート:

- **Fixture Base**: 器具マスターデータ（Spec No., メーカー, 型番, 色温度, 消費電力, コスト等）
- **器具仕様**: 印刷用レイアウト
- **器具リスト**: プロジェクト向け器具一覧

## 注意事項

- フロントエンドからのファイルアクセス・HTTP通信はTauriプラグイン経由で行う（`@tauri-apps/plugin-*`）
- Rustコード変更時は `pnpm tauri dev` の再起動が必要
