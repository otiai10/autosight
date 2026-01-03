mod commands;
mod providers;

use providers::ProviderRegistry;
use std::sync::Arc;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // プロバイダーレジストリを初期化
    let registry = Arc::new(Mutex::new(ProviderRegistry::new()));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(registry)
        .invoke_handler(tauri::generate_handler![
            commands::get_supported_manufacturers,
            commands::fetch_product_info,
            commands::download_ies_file,
            commands::batch_download_ies_files,
            commands::is_manufacturer_supported,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
