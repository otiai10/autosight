//! Tauriコマンド
//!
//! フロントエンド（React）から呼び出すためのコマンドを定義する。

use crate::providers::{DownloadResult, ProductInfo, ProviderRegistry};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

/// ダウンロード進捗イベントのペイロード
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressEvent {
    /// Spec No.（アイテム識別用）
    pub spec_no: String,
    /// ステータス: "processing" | "success" | "error"
    pub status: String,
    /// エラーメッセージ（エラー時のみ）
    pub error: Option<String>,
}

/// 一括ダウンロードの進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProgress {
    /// 現在処理中のインデックス
    pub current: usize,
    /// 全体の件数
    pub total: usize,
    /// 現在処理中の型番
    pub current_model: String,
    /// 成功件数
    pub success_count: usize,
    /// 失敗件数
    pub failure_count: usize,
}

/// 一括ダウンロードのリクエスト
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDownloadRequest {
    /// ダウンロード対象のリスト（メーカー名、型番のペア）
    pub items: Vec<BatchDownloadItem>,
    /// 保存先ディレクトリ
    pub dest_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDownloadItem {
    /// Spec No.（ファイル名に使用）
    pub spec_no: String,
    /// メーカー名
    pub manufacturer: String,
    /// 型番
    pub model_number: String,
    /// PSU型番（オプション）
    pub psu: Option<String>,
}

/// 一括ダウンロードの結果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchDownloadResult {
    /// 成功件数
    pub success_count: usize,
    /// 失敗件数
    pub failure_count: usize,
    /// 各ファイルの結果
    pub results: Vec<SingleDownloadResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SingleDownloadResult {
    pub spec_no: String,
    pub model_number: String,
    pub result: DownloadResult,
}

/// 対応メーカー一覧を取得
#[tauri::command]
pub async fn get_supported_manufacturers(
    registry: State<'_, Arc<Mutex<ProviderRegistry>>>,
) -> Result<Vec<String>, String> {
    let registry = registry.lock().await;
    Ok(registry.get_supported_manufacturers())
}

/// 製品情報を取得
#[tauri::command]
pub async fn fetch_product_info(
    registry: State<'_, Arc<Mutex<ProviderRegistry>>>,
    manufacturer: String,
    model_number: String,
) -> Result<ProductInfo, String> {
    let registry = registry.lock().await;
    let provider = registry
        .get_provider(&manufacturer)
        .ok_or_else(|| format!("No provider for manufacturer: {}", manufacturer))?;

    provider.fetch_product_info(&model_number).await
}

/// IESファイルを単体ダウンロード
#[tauri::command]
pub async fn download_ies_file(
    registry: State<'_, Arc<Mutex<ProviderRegistry>>>,
    manufacturer: String,
    model_number: String,
    psu: Option<String>,
    dest_path: String,
) -> Result<DownloadResult, String> {
    let registry = registry.lock().await;
    let provider = registry
        .get_provider(&manufacturer)
        .ok_or_else(|| format!("No provider for manufacturer: {}", manufacturer))?;

    provider
        .download_ies_file(&model_number, psu.as_deref(), &dest_path)
        .await
}

/// IESファイルを一括ダウンロード
#[tauri::command]
pub async fn batch_download_ies_files(
    app: AppHandle,
    registry: State<'_, Arc<Mutex<ProviderRegistry>>>,
    request: BatchDownloadRequest,
) -> Result<BatchDownloadResult, String> {
    let registry = registry.lock().await;
    let mut results = Vec::new();
    let mut success_count = 0;
    let mut failure_count = 0;

    for item in &request.items {
        // 処理開始イベントを発火
        let _ = app.emit(
            "download-progress",
            DownloadProgressEvent {
                spec_no: item.spec_no.clone(),
                status: "processing".to_string(),
                error: None,
            },
        );
        // 一時ファイル名でダウンロード（後で元ファイル名を使ってリネーム）
        let temp_path = format!(
            "{}/temp_{}.ies",
            request.dest_dir,
            item.spec_no
        );

        let result = if let Some(provider) = registry.get_provider(&item.manufacturer) {
            match provider
                .download_ies_file(&item.model_number, item.psu.as_deref(), &temp_path)
                .await
            {
                Ok(mut r) => {
                    if r.success {
                        // プロバイダーの命名規則でファイル名を生成
                        let filename = provider.generate_filename(
                            &item.spec_no,
                            &item.model_number,
                            item.psu.as_deref(),
                            r.original_filename.as_deref(),
                        );
                        let final_path = format!("{}/{}", request.dest_dir, filename);

                        // ファイルをリネーム
                        if let Err(e) = std::fs::rename(&temp_path, &final_path) {
                            r = DownloadResult::failure(format!("Failed to rename file: {}", e));
                        } else {
                            r.file_path = Some(final_path);
                        }
                    }
                    r
                }
                Err(e) => DownloadResult::failure(e),
            }
        } else {
            DownloadResult::failure(format!("No provider for: {}", item.manufacturer))
        };

        if result.success {
            success_count += 1;
        } else {
            failure_count += 1;
        }

        // 完了イベントを発火
        let _ = app.emit(
            "download-progress",
            DownloadProgressEvent {
                spec_no: item.spec_no.clone(),
                status: if result.success {
                    "success".to_string()
                } else {
                    "error".to_string()
                },
                error: result.error.clone(),
            },
        );

        results.push(SingleDownloadResult {
            spec_no: item.spec_no.clone(),
            model_number: item.model_number.clone(),
            result,
        });
    }

    Ok(BatchDownloadResult {
        success_count,
        failure_count,
        results,
    })
}

/// メーカーが対応しているか確認
#[tauri::command]
pub async fn is_manufacturer_supported(
    registry: State<'_, Arc<Mutex<ProviderRegistry>>>,
    manufacturer: String,
) -> Result<bool, String> {
    let registry = registry.lock().await;
    Ok(registry.get_provider(&manufacturer).is_some())
}
