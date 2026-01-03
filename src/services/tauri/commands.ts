/**
 * Tauriコマンド呼び出し
 * Rust側で定義したコマンドをTypeScriptから呼び出すためのラッパー
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  BatchDownloadRequest,
  BatchDownloadResult,
  DownloadResult,
  ProductInfo,
} from '../../types/fixture';

/**
 * 対応メーカー一覧を取得
 */
export async function getSupportedManufacturers(): Promise<string[]> {
  return invoke<string[]>('get_supported_manufacturers');
}

/**
 * メーカーが対応しているか確認
 */
export async function isManufacturerSupported(manufacturer: string): Promise<boolean> {
  return invoke<boolean>('is_manufacturer_supported', { manufacturer });
}

/**
 * 製品情報を取得
 */
export async function fetchProductInfo(
  manufacturer: string,
  modelNumber: string
): Promise<ProductInfo> {
  return invoke<ProductInfo>('fetch_product_info', {
    manufacturer,
    modelNumber,
  });
}

/**
 * IESファイルを単体ダウンロード
 */
export async function downloadIesFile(
  manufacturer: string,
  modelNumber: string,
  destPath: string
): Promise<DownloadResult> {
  return invoke<DownloadResult>('download_ies_file', {
    manufacturer,
    modelNumber,
    destPath,
  });
}

/**
 * IESファイルを一括ダウンロード
 */
export async function batchDownloadIesFiles(
  request: BatchDownloadRequest
): Promise<BatchDownloadResult> {
  return invoke<BatchDownloadResult>('batch_download_ies_files', {
    request: {
      items: request.items.map((item) => ({
        spec_no: item.specNo,
        manufacturer: item.manufacturer,
        model_number: item.modelNumber,
      })),
      dest_dir: request.destDir,
    },
  });
}
