//! コイズミ照明プロバイダー
//!
//! コイズミ照明 Webカタログ (webcatalog.koizumi-lt.co.jp) からの
//! 製品情報・IESファイル取得を担当する。

use super::{DownloadResult, ManufacturerProvider, ProductInfo};
use async_trait::async_trait;
use regex::Regex;
use std::path::Path;

/// コイズミ照明プロバイダー
pub struct KoizumiProvider {
    base_url: String,
    client: reqwest::Client,
}

impl KoizumiProvider {
    pub fn new() -> Self {
        Self {
            base_url: "https://webcatalog.koizumi-lt.co.jp".to_string(),
            client: reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// PSU文字列から型番部分を抽出
    /// 例: "DALI調光電源：XE92701" → Some("XE92701")
    /// 例: "DALI調光電源" → None
    fn extract_psu_model_number(psu: &str) -> Option<&str> {
        // 半角または全角コロンで分割し、末尾の英数字部分を抽出
        let re = Regex::new(r"[:：]\s*([A-Za-z0-9]+)$").unwrap();
        re.captures(psu).map(|caps| caps.get(1).unwrap().as_str())
    }

    /// FIXTURE文字列から型番を抽出
    /// 複数の型番がある場合（例: "本体：AH92025L\nユニット：AE49422L"）はすべて抽出
    /// 単一の型番の場合（例: "XD93319"）はそのまま返す
    fn extract_fixture_model_numbers(fixture: &str) -> Vec<String> {
        // コロン区切りパターン（本体：XX, ユニット：XX）を検索
        let re = Regex::new(r"[:：]\s*([A-Za-z0-9]+)").unwrap();
        let matches: Vec<String> = re
            .captures_iter(fixture)
            .filter_map(|caps| caps.get(1).map(|m| m.as_str().to_string()))
            .collect();

        if matches.is_empty() {
            // コロンパターンがない場合は全体を1つの型番として扱う
            vec![fixture.trim().to_string()]
        } else {
            matches
        }
    }

    /// FIXTURE型番（複数可）とPSUからitem_idを生成
    /// 例: "本体：AH92025L\nユニット：AE49422L", Some("DALI調光電源：XE92701")
    ///     → "AH92025L+AE49422L+XE92701"
    fn build_item_id(fixture: &str, psu: Option<&str>) -> String {
        let mut parts = Self::extract_fixture_model_numbers(fixture);

        if let Some(psu_model) = psu.and_then(Self::extract_psu_model_number) {
            parts.push(psu_model.to_string());
        }

        parts.join("+")
    }

    /// 製品ページからIESファイルのダウンロードURLを取得
    /// item_id: 型番（PSUがある場合は "型番+PSU型番" 形式）
    async fn get_ies_download_url(&self, item_id: &str) -> Result<Option<String>, String> {
        // itemid パラメータで直接アクセス（+ は %2B にエンコード）
        let encoded_id = item_id.replace('+', "%2B");
        let detail_url = format!(
            "{}/kensaku/item/detail/?itemid={}",
            self.base_url, encoded_id
        );

        let response = self
            .client
            .get(&detail_url)
            .send()
            .await
            .map_err(|e| format!("Detail request failed: {}", e))?;

        let html = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        // IESダウンロードリンクを抽出（配光データIES）
        // パターン: /kensaku/download/file/file_type/haikou_data/id/xxxxx
        let re = Regex::new(r#"/kensaku/download/file/file_type/haikou_data/id/(\d+)"#).unwrap();
        if let Some(caps) = re.captures(&html) {
            let file_id = &caps[1];
            return Ok(Some(format!(
                "{}/kensaku/download/file/file_type/haikou_data/id/{}",
                self.base_url, file_id
            )));
        }

        Ok(None)
    }

    /// Content-Dispositionヘッダーからファイル名を抽出
    fn extract_filename_from_header(header_value: &str) -> Option<String> {
        // パターン: filename="xxx.ies" または filename*=UTF-8''xxx.ies
        if let Some(start) = header_value.find("filename=") {
            let rest = &header_value[start + 9..];
            let filename = if rest.starts_with('"') {
                // filename="xxx.ies"
                rest.trim_start_matches('"')
                    .split('"')
                    .next()
                    .map(|s| s.to_string())
            } else {
                // filename=xxx.ies
                rest.split(';').next().map(|s| s.trim().to_string())
            };
            return filename;
        }
        None
    }
}

impl Default for KoizumiProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ManufacturerProvider for KoizumiProvider {
    fn display_name(&self) -> &str {
        "コイズミ照明"
    }

    fn can_handle(&self, manufacturer: &str) -> bool {
        let lower = manufacturer.to_lowercase();
        lower.contains("コイズミ")
            || lower.contains("koizumi")
            || lower.contains("こいずみ")
    }

    async fn fetch_product_info(&self, model_number: &str) -> Result<ProductInfo, String> {
        // 型番から直接製品ページにアクセス
        // IESファイルURLを取得
        let ies_file_url = self.get_ies_download_url(model_number).await?;

        Ok(ProductInfo {
            model_number: model_number.to_string(),
            product_name: None,
            price: None,
            ies_file_url,
            image_url: None,
            product_page_url: Some(format!(
                "{}/kensaku/item/detail/?itemid={}",
                self.base_url, model_number
            )),
        })
    }

    fn generate_filename(
        &self,
        spec_no: &str,
        model_number: &str,
        psu: Option<&str>,
        original_filename: Option<&str>,
    ) -> String {
        // コイズミの場合、元ファイル名に型番+PSUが含まれている
        // 形式: {Spec No.}_{元ファイル名}
        // 元ファイル名がない場合: {Spec No.}_{型番}_{PSU}.ies
        match original_filename {
            Some(orig) => {
                let name = orig.trim_end_matches(".ies").trim_end_matches(".IES");
                format!("{}_{}.ies", spec_no, name)
            }
            None => {
                let safe_model = model_number.replace("/", "_").replace("\\", "_");
                match psu {
                    Some(p) if !p.is_empty() => {
                        let safe_psu = p.replace("/", "_").replace("\\", "_");
                        format!("{}_{}+{}.ies", spec_no, safe_model, safe_psu)
                    }
                    _ => format!("{}_{}.ies", spec_no, safe_model),
                }
            }
        }
    }

    async fn download_ies_file(
        &self,
        model_number: &str,
        psu: Option<&str>,
        dest_path: &str,
    ) -> Result<DownloadResult, String> {
        // item_idを生成（PSUがある場合は結合）
        let item_id = Self::build_item_id(model_number, psu);

        // IESファイルURLを取得（PSU指定時は見つからなければ型番のみで再検索）
        let ies_url = match self.get_ies_download_url(&item_id).await? {
            Some(url) => url,
            None => {
                // PSU指定ありで見つからない場合、型番のみで再検索
                if psu.is_some_and(|p| !p.is_empty()) {
                    self.get_ies_download_url(model_number)
                        .await?
                        .ok_or_else(|| {
                            format!("IES file not found for: {} nor {}", item_id, model_number)
                        })?
                } else {
                    return Err(format!("IES file not available for: {}", item_id));
                }
            }
        };

        // IESファイルをダウンロード
        let response = self
            .client
            .get(&ies_url)
            .send()
            .await
            .map_err(|e| format!("Download request failed: {}", e))?;

        if !response.status().is_success() {
            return Ok(DownloadResult::failure(format!(
                "Download failed with status: {}",
                response.status()
            )));
        }

        // Content-Dispositionヘッダーから元のファイル名を取得
        let original_filename = response
            .headers()
            .get("content-disposition")
            .and_then(|h| h.to_str().ok())
            .and_then(Self::extract_filename_from_header);

        let bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read file content: {}", e))?;

        let file_size = bytes.len() as u64;

        // ファイルを保存
        let dest = Path::new(dest_path);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        std::fs::write(dest_path, &bytes)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(DownloadResult::success(
            dest_path.to_string(),
            file_size,
            original_filename,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_handle() {
        let provider = KoizumiProvider::new();
        assert!(provider.can_handle("コイズミ照明"));
        assert!(provider.can_handle("コイズミ"));
        assert!(provider.can_handle("KOIZUMI"));
        assert!(!provider.can_handle("大光電機"));
        assert!(!provider.can_handle("パナソニック"));
    }

    #[test]
    fn test_extract_psu_model_number() {
        // 全角コロン付き
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("DALI調光電源：XE92701"),
            Some("XE92701")
        );
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("非調光電源：XE92184E"),
            Some("XE92184E")
        );
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("多灯用直流電源装置別置：ELD24320FD"),
            Some("ELD24320FD")
        );

        // 半角コロン付き
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("DALI調光電源: XE92701"),
            Some("XE92701")
        );

        // 型番なし
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("DALI調光電源"),
            None
        );
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("専用電源、"),
            None
        );
        assert_eq!(
            KoizumiProvider::extract_psu_model_number("適合DALI電源ドライバー"),
            None
        );
    }

    #[test]
    fn test_extract_fixture_model_numbers() {
        // 単一の型番（コロンなし）
        assert_eq!(
            KoizumiProvider::extract_fixture_model_numbers("XD93319"),
            vec!["XD93319"]
        );

        // 複数の型番（本体＋ユニット）
        assert_eq!(
            KoizumiProvider::extract_fixture_model_numbers("本体：AH92025L\nユニット：AE49422L"),
            vec!["AH92025L", "AE49422L"]
        );

        // 半角コロン
        assert_eq!(
            KoizumiProvider::extract_fixture_model_numbers("本体: AH92025L\nユニット: AE49422L"),
            vec!["AH92025L", "AE49422L"]
        );

        // 単一の型番（コロン付き）
        assert_eq!(
            KoizumiProvider::extract_fixture_model_numbers("本体：XD93319"),
            vec!["XD93319"]
        );
    }

    #[test]
    fn test_build_item_id() {
        // 単一型番 + PSU型番あり
        assert_eq!(
            KoizumiProvider::build_item_id("AD12345", Some("DALI調光電源：XE92701")),
            "AD12345+XE92701"
        );

        // 単一型番 + PSU型番なし（説明のみ）
        assert_eq!(
            KoizumiProvider::build_item_id("AD12345", Some("DALI調光電源")),
            "AD12345"
        );

        // 単一型番 + PSU指定なし
        assert_eq!(
            KoizumiProvider::build_item_id("AD12345", None),
            "AD12345"
        );

        // 単一型番 + 空文字
        assert_eq!(
            KoizumiProvider::build_item_id("AD12345", Some("")),
            "AD12345"
        );

        // 複数型番（本体＋ユニット） + PSUなし
        assert_eq!(
            KoizumiProvider::build_item_id("本体：AH92025L\nユニット：AE49422L", None),
            "AH92025L+AE49422L"
        );

        // 複数型番（本体＋ユニット） + PSU型番あり
        assert_eq!(
            KoizumiProvider::build_item_id(
                "本体：AH92025L\nユニット：AE49422L",
                Some("DALI調光電源：XE92701")
            ),
            "AH92025L+AE49422L+XE92701"
        );
    }
}
