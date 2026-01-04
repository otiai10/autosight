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

    async fn download_ies_file(
        &self,
        model_number: &str,
        dest_path: &str,
    ) -> Result<DownloadResult, String> {
        // 製品情報を取得
        let product_info = self.fetch_product_info(model_number).await?;

        let ies_url = product_info
            .ies_file_url
            .ok_or_else(|| format!("IES file not available for: {}", model_number))?;

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

        Ok(DownloadResult::success(dest_path.to_string(), file_size))
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
}
