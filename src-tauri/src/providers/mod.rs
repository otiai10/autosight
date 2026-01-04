//! メーカープロバイダーモジュール
//!
//! 照明器具メーカーごとに異なるデータ取得ロジックを抽象化し、
//! プラグイン的に追加可能なアーキテクチャを提供する。

pub mod koizumi;
pub mod tokistar;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// 製品情報
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProductInfo {
    /// 型番
    pub model_number: String,
    /// 製品名
    pub product_name: Option<String>,
    /// 定価（円）
    pub price: Option<u32>,
    /// IESファイルのURL
    pub ies_file_url: Option<String>,
    /// 製品画像のURL
    pub image_url: Option<String>,
    /// 製品ページのURL
    pub product_page_url: Option<String>,
}

/// ダウンロード結果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    /// 成功したかどうか
    pub success: bool,
    /// 保存先ファイルパス
    pub file_path: Option<String>,
    /// ファイルサイズ（バイト）
    pub file_size: Option<u64>,
    /// 元のファイル名（サーバーから取得）
    pub original_filename: Option<String>,
    /// エラーメッセージ
    pub error: Option<String>,
}

impl DownloadResult {
    pub fn success(file_path: String, file_size: u64, original_filename: Option<String>) -> Self {
        Self {
            success: true,
            file_path: Some(file_path),
            file_size: Some(file_size),
            original_filename,
            error: None,
        }
    }

    pub fn failure(error: String) -> Self {
        Self {
            success: false,
            file_path: None,
            file_size: None,
            original_filename: None,
            error: Some(error),
        }
    }
}

/// メーカープロバイダー trait
///
/// 各メーカーはこのtraitを実装することで、AutoSightに統合される。
/// 新しいメーカーを追加する場合は、このtraitを実装した構造体を作成し、
/// ProviderRegistryに登録するだけでよい。
#[async_trait]
pub trait ManufacturerProvider: Send + Sync {
    /// 表示名（日本語）
    fn display_name(&self) -> &str;

    /// このプロバイダーが指定されたメーカー名を処理できるか判定
    ///
    /// # Arguments
    /// * `manufacturer` - Excelの「メーカー」列の値
    fn can_handle(&self, manufacturer: &str) -> bool;

    /// 製品情報を取得
    ///
    /// # Arguments
    /// * `model_number` - 型番（Excelの「FIXTURE」列の値）
    async fn fetch_product_info(&self, model_number: &str) -> Result<ProductInfo, String>;

    /// IESファイルをダウンロード
    ///
    /// # Arguments
    /// * `model_number` - 型番
    /// * `psu` - PSU型番（オプション）
    /// * `dest_path` - 保存先ファイルパス
    async fn download_ies_file(
        &self,
        model_number: &str,
        psu: Option<&str>,
        dest_path: &str,
    ) -> Result<DownloadResult, String>;

    /// ダウンロード後のファイル名を生成
    ///
    /// プロバイダーごとに最適な命名規則を実装する。
    ///
    /// # Arguments
    /// * `spec_no` - Spec No.
    /// * `model_number` - 型番
    /// * `psu` - PSU型番（オプション）
    /// * `original_filename` - サーバーから取得した元ファイル名（オプション）
    fn generate_filename(
        &self,
        spec_no: &str,
        model_number: &str,
        psu: Option<&str>,
        original_filename: Option<&str>,
    ) -> String;
}

/// プロバイダーレジストリ
///
/// 登録されたメーカープロバイダーを管理し、
/// メーカー名から適切なプロバイダーを取得する。
pub struct ProviderRegistry {
    providers: Vec<Arc<dyn ManufacturerProvider>>,
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl ProviderRegistry {
    /// 新しいレジストリを作成（デフォルトプロバイダーを登録）
    pub fn new() -> Self {
        let mut registry = Self { providers: vec![] };
        registry.register(Arc::new(koizumi::KoizumiProvider::new()));
        registry.register(Arc::new(tokistar::TokistarProvider::new()));
        registry
    }

    /// プロバイダーを登録
    pub fn register(&mut self, provider: Arc<dyn ManufacturerProvider>) {
        self.providers.push(provider);
    }

    /// メーカー名から適切なプロバイダーを取得
    pub fn get_provider(&self, manufacturer: &str) -> Option<Arc<dyn ManufacturerProvider>> {
        self.providers
            .iter()
            .find(|p| p.can_handle(manufacturer))
            .cloned()
    }

    /// 対応メーカー名一覧を取得
    pub fn get_supported_manufacturers(&self) -> Vec<String> {
        self.providers
            .iter()
            .map(|p| p.display_name().to_string())
            .collect()
    }
}
