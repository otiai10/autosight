/**
 * 器具データ型定義
 * schema/ies-fixture-list.schema.json の Fixture Base シートに対応
 */

/** Fixture Base の1行に対応する器具データ */
export interface Fixture {
  /** 器具記号 (例: A01, D11w) */
  specNo: string;
  /** 更新日 */
  date?: Date;
  /** リビジョン */
  revision?: string;
  /** 除外フラグ (0=有効, 1=除外) */
  omitted?: number;
  /** 器具タイプ名称 */
  luminaireType: string;
  /** 光源種類 (LED等) */
  lightSourceType?: string;
  /** 色温度 (例: 2700K) */
  colorTemp?: string;
  /** 配光角 (例: 20°) */
  beamAngle?: string;
  /** 光束値 (ルーメン) */
  lumen?: number;
  /** 消費電力 (ワット) */
  wattage?: number;
  /** 皮相電力 (VA) */
  va?: number;
  /** 数量単位 */
  unit?: string;
  /** メーカー名 */
  manufacturer: string;
  /** 型番 */
  fixture: string;
  /** 型番備考 */
  modelNote?: string;
  /** 調光制御方式 */
  control?: string;
  /** 電源装置情報 */
  psu?: string;
  /** アクセサリー */
  accessories?: string;
  /** 注記 */
  notes?: string;
  /** 製品リンクURL */
  productLink?: string;
  /** IESファイルチェック状態 */
  iesFileCheck?: string;
  /** 器具本体定価 */
  costFixture?: number;
  /** 電源装置定価 */
  costDriver?: number;
  /** その他付属品定価 */
  costOthers?: number;
}

/** ダウンロード結果（Rust側と対応） */
export interface DownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

/** 一括ダウンロード用のアイテム */
export interface BatchDownloadItem {
  specNo: string;
  manufacturer: string;
  modelNumber: string;
}

/** 一括ダウンロードリクエスト */
export interface BatchDownloadRequest {
  items: BatchDownloadItem[];
  destDir: string;
}

/** 単体ダウンロード結果 */
export interface SingleDownloadResult {
  specNo: string;
  modelNumber: string;
  result: DownloadResult;
}

/** 一括ダウンロード結果 */
export interface BatchDownloadResult {
  successCount: number;
  failureCount: number;
  results: SingleDownloadResult[];
}

/** ダウンロード進捗イベント（Rust側からの通知） */
export interface DownloadProgressEvent {
  specNo: string;
  status: 'processing' | 'success' | 'error';
  error?: string;
}

/** 製品情報（Rust側と対応） */
export interface ProductInfo {
  modelNumber: string;
  productName?: string;
  price?: number;
  iesFileUrl?: string;
  imageUrl?: string;
  productPageUrl?: string;
}

/** 器具の選択状態 */
export interface FixtureSelection {
  fixture: Fixture;
  selected: boolean;
  downloadStatus?: 'pending' | 'waiting' | 'downloading' | 'success' | 'error';
  downloadError?: string;
}
