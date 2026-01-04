//! TOKISTAR プロバイダー
//!
//! TOKISTAR (toki.co.jp) からの
//! 製品情報・IESファイル取得を担当する。

use super::{DownloadResult, ManufacturerProvider, ProductInfo};
use async_trait::async_trait;
use regex::Regex;
use std::io::Read;
use std::path::Path;

/// TOKISTAR プロバイダー
pub struct TokistarProvider {
    base_url: String,
    client: reqwest::Client,
}

impl TokistarProvider {
    pub fn new() -> Self {
        Self {
            base_url: "https://toki.co.jp/tokistar".to_string(),
            client: reqwest::Client::builder()
                .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// fixture_id から partial_fixture_id を抽出
    /// 最初の '-' より前の部分を返す
    /// 例: "OSP01-30K-30D-B-TB" → "OSP01"
    /// 例: "MRD01" → "MRD01" (ハイフンなし)
    fn extract_partial_fixture_id(fixture_id: &str) -> String {
        fixture_id
            .split('-')
            .next()
            .unwrap_or(fixture_id)
            .to_string()
    }

    /// 検索ページからIES ZIPファイルのURLを取得
    async fn get_ies_zip_url(&self, partial_id: &str) -> Result<Option<String>, String> {
        let search_url = format!("{}/download01/?freeword={}", self.base_url, partial_id);

        let response = self
            .client
            .get(&search_url)
            .send()
            .await
            .map_err(|e| format!("Search request failed: {}", e))?;

        let html = response
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        // IES ZIPのURLを抽出
        // パターン: href="https://toki.co.jp/tokistar/wp-content/uploads/YYYY/MM/IES_XXX.zip"
        let re = Regex::new(r#"href="([^"]*\/IES_[^"]*\.zip)""#).unwrap();
        if let Some(caps) = re.captures(&html) {
            return Ok(Some(caps[1].to_string()));
        }

        Ok(None)
    }

    /// 2つの文字列の前方一致長を計算
    fn common_prefix_length(a: &str, b: &str) -> usize {
        a.chars()
            .zip(b.chars())
            .take_while(|(ca, cb)| ca == cb)
            .count()
    }

    /// ZIPファイルの中から最適な.iesファイルを選択
    /// fixture_id の '-' を '_' に置換し、前方一致が最も長いファイルを選択
    fn select_best_ies_file(fixture_id: &str, ies_files: &[String]) -> Option<String> {
        // fixture_id の - を _ に置換して正規化
        let normalized = fixture_id.replace('-', "_");

        // 前方一致の長さでソートし、最長を選択
        ies_files
            .iter()
            .map(|f| {
                // パスからファイル名のみを取り出す（IES_OSP/OSP01_30K.ies → OSP01_30K）
                let filename = Path::new(f)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(f);
                let name = filename
                    .trim_end_matches(".ies")
                    .trim_end_matches(".IES");
                let match_len = Self::common_prefix_length(&normalized, name);
                (f, match_len)
            })
            .max_by_key(|(_, len)| *len)
            .filter(|(_, len)| *len > 0)
            .map(|(f, _)| f.clone())
    }

    /// ZIPファイルをダウンロードして展開し、最適な.iesファイルを取得
    async fn download_and_extract_ies(
        &self,
        zip_url: &str,
        fixture_id: &str,
        dest_path: &str,
    ) -> Result<DownloadResult, String> {
        // ZIPファイルをダウンロード
        let response = self
            .client
            .get(zip_url)
            .send()
            .await
            .map_err(|e| format!("ZIP download failed: {}", e))?;

        if !response.status().is_success() {
            return Ok(DownloadResult::failure(format!(
                "ZIP download failed with status: {}",
                response.status()
            )));
        }

        let zip_bytes = response
            .bytes()
            .await
            .map_err(|e| format!("Failed to read ZIP content: {}", e))?;

        // ZIPを展開して.iesファイル一覧を取得
        let cursor = std::io::Cursor::new(zip_bytes.as_ref());
        let mut archive =
            zip::ZipArchive::new(cursor).map_err(|e| format!("Failed to open ZIP: {}", e))?;

        // .iesファイル一覧を収集
        let ies_files: Vec<String> = (0..archive.len())
            .filter_map(|i| {
                archive.by_index(i).ok().and_then(|file| {
                    let name = file.name().to_string();
                    if name.to_lowercase().ends_with(".ies") {
                        Some(name)
                    } else {
                        None
                    }
                })
            })
            .collect();

        if ies_files.is_empty() {
            return Ok(DownloadResult::failure(
                "No .ies files found in ZIP".to_string(),
            ));
        }

        // 最適なファイルを選択
        let best_file = Self::select_best_ies_file(fixture_id, &ies_files)
            .ok_or_else(|| format!("No matching .ies file found for: {}", fixture_id))?;

        // 選択したファイルを取り出して保存
        let mut file = archive
            .by_name(&best_file)
            .map_err(|e| format!("Failed to read {} from ZIP: {}", best_file, e))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| format!("Failed to read file content: {}", e))?;

        let file_size = contents.len() as u64;

        // 保存先ディレクトリを作成
        let dest = Path::new(dest_path);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        // ファイルを保存
        std::fs::write(dest_path, &contents)
            .map_err(|e| format!("Failed to write file: {}", e))?;

        // 元ファイル名（拡張子なし）を取得
        let original_filename = Path::new(&best_file)
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string());

        Ok(DownloadResult::success(
            dest_path.to_string(),
            file_size,
            original_filename,
        ))
    }
}

impl Default for TokistarProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl ManufacturerProvider for TokistarProvider {
    fn display_name(&self) -> &str {
        "TOKISTAR"
    }

    fn can_handle(&self, manufacturer: &str) -> bool {
        let lower = manufacturer.to_lowercase();
        lower.contains("tokistar") || lower.contains("トキスター")
    }

    async fn fetch_product_info(&self, model_number: &str) -> Result<ProductInfo, String> {
        let partial_id = Self::extract_partial_fixture_id(model_number);
        let ies_file_url = self.get_ies_zip_url(&partial_id).await?;

        Ok(ProductInfo {
            model_number: model_number.to_string(),
            product_name: None,
            price: None,
            ies_file_url,
            image_url: None,
            product_page_url: Some(format!(
                "{}/download01/?freeword={}",
                self.base_url, partial_id
            )),
        })
    }

    fn generate_filename(
        &self,
        spec_no: &str,
        model_number: &str,
        _psu: Option<&str>,
        original_filename: Option<&str>,
    ) -> String {
        // {Spec No.}_{元ファイル名}
        // 例: "1001_OSP01_30K_30D.ies"
        match original_filename {
            Some(orig) => {
                // 既に .ies 拡張子がある場合はそのまま使用
                if orig.to_lowercase().ends_with(".ies") {
                    format!("{}_{}", spec_no, orig)
                } else {
                    format!("{}_{}.ies", spec_no, orig)
                }
            }
            None => {
                let safe_model = model_number.replace('/', "_").replace('\\', "_");
                format!("{}_{}.ies", spec_no, safe_model)
            }
        }
    }

    async fn download_ies_file(
        &self,
        model_number: &str,
        _psu: Option<&str>, // PSUは無視
        dest_path: &str,
    ) -> Result<DownloadResult, String> {
        // partial_fixture_id を抽出
        let partial_id = Self::extract_partial_fixture_id(model_number);

        // IES ZIPのURLを取得
        let zip_url = self
            .get_ies_zip_url(&partial_id)
            .await?
            .ok_or_else(|| format!("IES file not found for: {}", partial_id))?;

        // ZIPをダウンロードして展開、最適な.iesファイルを保存
        self.download_and_extract_ies(&zip_url, model_number, dest_path)
            .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_can_handle() {
        let provider = TokistarProvider::new();
        assert!(provider.can_handle("TOKISTAR"));
        assert!(provider.can_handle("tokistar"));
        assert!(provider.can_handle("Tokistar"));
        assert!(provider.can_handle("TokiStar"));
        assert!(provider.can_handle("トキスター"));
        assert!(!provider.can_handle("コイズミ照明"));
        assert!(!provider.can_handle("大光電機"));
    }

    #[test]
    fn test_extract_partial_fixture_id() {
        // ハイフンありのケース
        assert_eq!(
            TokistarProvider::extract_partial_fixture_id("OSP01-30K-30D-B-TB"),
            "OSP01"
        );
        assert_eq!(
            TokistarProvider::extract_partial_fixture_id("CS18S-EM"),
            "CS18S"
        );

        // ハイフンなしのケース
        assert_eq!(
            TokistarProvider::extract_partial_fixture_id("MRD01"),
            "MRD01"
        );
    }

    #[test]
    fn test_common_prefix_length() {
        assert_eq!(TokistarProvider::common_prefix_length("OSP01_30K", "OSP01_30K_30D"), 9);
        assert_eq!(TokistarProvider::common_prefix_length("OSP01_30K_30D", "OSP01_27K"), 6);
        assert_eq!(TokistarProvider::common_prefix_length("ABC", "XYZ"), 0);
        assert_eq!(TokistarProvider::common_prefix_length("", "OSP01"), 0);
    }

    #[test]
    fn test_select_best_ies_file() {
        // フラットなファイル名
        let ies_files = vec![
            "OSP01_27K.ies".to_string(),
            "OSP01_30K_30D.ies".to_string(),
            "OSP01.ies".to_string(),
        ];

        // OSP01-30K-30D-B-TB → OSP01_30K_30D_B_TB
        // 最も長く一致する OSP01_30K_30D.ies が選ばれるべき
        let result = TokistarProvider::select_best_ies_file("OSP01-30K-30D-B-TB", &ies_files);
        assert_eq!(result, Some("OSP01_30K_30D.ies".to_string()));

        // OSP01-27K → OSP01_27K
        let result = TokistarProvider::select_best_ies_file("OSP01-27K", &ies_files);
        assert_eq!(result, Some("OSP01_27K.ies".to_string()));

        // OSP01 → OSP01
        let result = TokistarProvider::select_best_ies_file("OSP01", &ies_files);
        // OSP01.ies, OSP01_27K.ies, OSP01_30K_30D.ies 全て5文字一致
        // max_by_key は最後に見つかった最大値を返すため、実装依存
        assert!(result.is_some());
    }

    #[test]
    fn test_select_best_ies_file_with_path() {
        // 実際のZIPのようにパス付きファイル名
        let ies_files = vec![
            "IES_OSP/OSP01_27K_15D.ies".to_string(),
            "IES_OSP/OSP01_30K_30D.ies".to_string(),
            "IES_OSP/HL/OSP01_30K-HL_30D_HL.ies".to_string(),
        ];

        // OSP01-30K-30D → OSP01_30K_30D
        let result = TokistarProvider::select_best_ies_file("OSP01-30K-30D", &ies_files);
        assert_eq!(result, Some("IES_OSP/OSP01_30K_30D.ies".to_string()));

        // OSP01-27K-15D → OSP01_27K_15D
        let result = TokistarProvider::select_best_ies_file("OSP01-27K-15D", &ies_files);
        assert_eq!(result, Some("IES_OSP/OSP01_27K_15D.ies".to_string()));
    }

    #[test]
    fn test_select_best_ies_file_no_match() {
        let ies_files = vec!["ABC123.ies".to_string()];

        let result = TokistarProvider::select_best_ies_file("XYZ999", &ies_files);
        assert_eq!(result, None);
    }

    #[test]
    fn test_generate_filename() {
        let provider = TokistarProvider::new();

        // 元ファイル名あり（.ies付き）
        assert_eq!(
            provider.generate_filename("1001", "OSP01-30K", None, Some("OSP01_30K_30D.ies")),
            "1001_OSP01_30K_30D.ies"
        );

        // 元ファイル名あり（.iesなし）
        assert_eq!(
            provider.generate_filename("1001", "OSP01-30K", None, Some("OSP01_30K_30D")),
            "1001_OSP01_30K_30D.ies"
        );

        // 元ファイル名なし
        assert_eq!(
            provider.generate_filename("1001", "OSP01-30K", None, None),
            "1001_OSP01-30K.ies"
        );

        // PSUは無視される
        assert_eq!(
            provider.generate_filename("1001", "OSP01", Some("PSU123"), Some("OSP01.ies")),
            "1001_OSP01.ies"
        );
    }
}
