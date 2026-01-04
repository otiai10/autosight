# KOIZUMI Provider 仕様

## 概要

コイズミ照明の照明器具に対して、IESファイルのダウンロードを行うプロバイダー。

## メーカー名マッチング

以下のいずれかにマッチする場合にこのプロバイダーが適用される：

- `コイズミ`（部分一致）
- `koizumi`（大文字小文字問わず）
- `こいずみ`

## データソース

- **URL**: `https://webcatalog.koizumi-lt.co.jp`
- **製品ページ**: `/kensaku/item/detail/?itemid={item_id}`
- **IESダウンロード**: `/kensaku/download/file/file_type/haikou_data/id/{file_id}`

## 型番処理

### FIXTURE型番の抽出

FIXTURE列の値から型番を抽出する。複数の型番が含まれる場合はすべて抽出。

| FIXTURE列の値 | 抽出結果 |
|--------------|---------|
| `XD93319` | `["XD93319"]` |
| `本体：AH92025L` | `["AH92025L"]` |
| `本体：AH92025L\nユニット：AE49422L` | `["AH92025L", "AE49422L"]` |

**抽出ルール**:
- コロン（`：` または `:`）の後の英数字を抽出
- コロンがない場合は全体を1つの型番として扱う

### PSU型番の抽出

PSU列の値から型番部分のみを抽出する。

| PSU列の値 | 抽出結果 |
|----------|---------|
| `DALI調光電源：XE92701` | `XE92701` |
| `非調光電源：XE92184E` | `XE92184E` |
| `DALI調光電源` | `None`（型番なし） |
| `専用電源、` | `None`（型番なし） |

**抽出ルール**:
- 正規表現 `[:：]\s*([A-Za-z0-9]+)$` でコロン以降の英数字を抽出
- 型番がない場合は `None`

### item_id の生成

FIXTURE型番とPSU型番を `+` で連結して item_id を生成。

| FIXTURE | PSU | item_id |
|---------|-----|---------|
| `AD12345` | `None` | `AD12345` |
| `AD12345` | `DALI調光電源：XE92701` | `AD12345+XE92701` |
| `本体：AH92025L\nユニット：AE49422L` | `None` | `AH92025L+AE49422L` |
| `本体：AH92025L\nユニット：AE49422L` | `DALI調光電源：XE92701` | `AH92025L+AE49422L+XE92701` |

## IESファイル取得フロー

```
1. FIXTURE型番とPSU型番から item_id を生成
2. https://webcatalog.koizumi-lt.co.jp/kensaku/item/detail/?itemid={item_id} にアクセス
3. HTMLから正規表現でIESダウンロードURLを抽出
   - パターン: /kensaku/download/file/file_type/haikou_data/id/(\d+)
4. IESファイルを直接ダウンロード（ZIPではない）
5. Content-Dispositionヘッダーから元ファイル名を取得
6. ファイルを保存
```

## PSUフォールバック機能

PSU指定ありで製品が見つからない場合、**FIXTURE型番のみで再検索**を行う。

```
1. item_id = "AH92025L+XE92701" で検索 → 見つからない
2. item_id = "AH92025L" で再検索 → 見つかればダウンロード
```

これにより、PSU型番が不正確な場合でもIESファイルを取得できる可能性が高まる。

## ファイル名生成

保存時のファイル名は以下の形式：

```
{Spec No.}_{元ファイル名}.ies
```

例:
- `1001_AD12345.ies`
- `1002_AH92025L+AE49422L+XE92701.ies`

元ファイル名がない場合:
```
{Spec No.}_{型番}+{PSU型番}.ies
```

## 注意事項

1. **直接ダウンロード**: コイズミはZIPではなく.iesファイルを直接ダウンロード
2. **元ファイル名**: Content-Dispositionヘッダーから取得
3. **URLエンコード**: item_id 内の `+` は `%2B` にエンコードされる

## 実装ファイル

- `src-tauri/src/providers/koizumi.rs`
