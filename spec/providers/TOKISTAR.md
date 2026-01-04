# TOKISTAR Provider 仕様

## 概要

TOKISTARメーカーの照明器具に対して、IESファイルのダウンロードを行うプロバイダー。

## メーカー名マッチング

以下のいずれかにマッチする場合にこのプロバイダーが適用される：

- `TOKISTAR`, `tokistar`, `Tokistar`, `TokiStar`（大文字小文字問わず）
- `トキスター`

## データソース

- **URL**: `https://toki.co.jp/tokistar/download01/`
- **検索方法**: `?freeword={partial_fixture_id}` パラメータで検索

## 型番処理

### partial_fixture_id の抽出

`fixture_id`（FIXTURE列の値）の最初の `-` より前の部分を抽出して検索に使用する。

| fixture_id | partial_fixture_id |
|------------|-------------------|
| `OSP01-30K-30D-B-TB` | `OSP01` |
| `CS18S-EM` | `CS18S` |
| `MRD01` | `MRD01` |

### PSU

**無視する**（コイズミと異なり、PSU情報はIESファイル検索に使用しない）

## IESファイル取得フロー

```
1. partial_fixture_id を抽出
2. https://toki.co.jp/tokistar/download01/?freeword={partial_fixture_id} にアクセス
3. HTMLから正規表現でIES ZIPのURLを抽出
   - パターン: href="([^"]*\/IES_[^"]*\.zip)"
   - 例: https://toki.co.jp/tokistar/wp-content/uploads/2023/10/IES_OSP.zip
4. ZIPファイルをダウンロード
5. ZIPを展開し、.iesファイル一覧を取得
6. 最適な.iesファイルを選択（後述）
7. 選択したファイルを保存先にコピー
```

## 最適IESファイル選択ロジック

ZIPファイル内には複数の.iesファイルが含まれる場合がある（色温度・配光角違いなど）。

### 選択アルゴリズム

1. `fixture_id` の `-` を `_` に置換して正規化
2. ZIPの中の各.iesファイル名（パス除去、拡張子除去）と前方一致比較
3. 最も長く一致したファイルを選択

### 例

**入力**: `fixture_id = OSP01-30K-30D-B-TB`

**ZIPの中身**:
```
IES_OSP/
├── OSP01_27K_15D.ies
├── OSP01_30K_15D.ies
├── OSP01_30K_30D.ies    ← 選択される
├── OSP01_30K_50D.ies
└── HL/
    └── OSP01_30K-HL_30D_HL.ies
```

**処理**:
1. 正規化: `OSP01-30K-30D-B-TB` → `OSP01_30K_30D_B_TB`
2. 比較:
   - `OSP01_27K_15D` → 6文字一致
   - `OSP01_30K_15D` → 10文字一致
   - `OSP01_30K_30D` → 13文字一致 ← **最長**
   - `OSP01_30K_50D` → 10文字一致
3. 結果: `IES_OSP/OSP01_30K_30D.ies` を選択

## ファイル名生成

保存時のファイル名は以下の形式：

```
{Spec No.}_{元ファイル名}
```

例: `1001_OSP01_30K_30D.ies`

## 注意事項

1. **ZIPファイル構造**: TOKISTARのZIPはフォルダ階層を含む（例: `IES_OSP/OSP01_30K.ies`）
2. **複数ZIP**: 検索結果に複数のIES ZIPがある場合は最初の1つをダウンロード
3. **マッチ失敗**: 前方一致が0文字のファイルしかない場合はエラー

## 実装ファイル

- `src-tauri/src/providers/tokistar.rs`
