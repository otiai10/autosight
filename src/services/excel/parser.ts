/**
 * Excel解析サービス
 * IES照明器具リストExcelファイルをパースしてFixtureデータに変換する
 */

import * as XLSX from 'xlsx';
import type { Fixture } from '../../types/fixture';

/** Fixture Baseシートのカラムマッピング */
const COLUMN_MAPPING: Record<string, keyof Fixture> = {
  'Spec No.': 'specNo',
  Date: 'date',
  'Rev.': 'revision',
  omitted: 'omitted',
  Luminaire_Type: 'luminaireType',
  'Light source type': 'lightSourceType',
  色温度: 'colorTemp',
  配光角: 'beamAngle',
  Lumen: 'lumen',
  消費電力: 'wattage',
  VA: 'va',
  Unit: 'unit',
  メーカー: 'manufacturer',
  FIXTURE: 'fixture',
  型番備考: 'modelNote',
  制御: 'control',
  PSU: 'psu',
  ACCESSORIES: 'accessories',
  注記: 'notes',
  製品リンク: 'productLink',
  'IES File Check': 'iesFileCheck',
  'Cost of Fixture': 'costFixture',
  'Cost of Driver': 'costDriver',
  'Cost of Others': 'costOthers',
};

/** 必須カラム */
const REQUIRED_COLUMNS = ['Spec No.', 'メーカー', 'FIXTURE'];

export interface ParseResult {
  fixtures: Fixture[];
  warnings: string[];
  sheetNames: string[];
}

/**
 * Excelのシリアル日付をJavaScript Dateに変換
 */
function excelDateToJSDate(serial: number): Date {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

/**
 * バイナリデータからExcelを解析
 */
export function parseExcelFromBinary(data: Uint8Array): ParseResult {
  // 新しいUint8Arrayにコピーして確実にオフセット0から始まるようにする
  const cleanData = new Uint8Array(data);
  const workbook = XLSX.read(cleanData, { type: 'array' });
  const warnings: string[] = [];

  // Fixture Baseシートを探す
  const fixtureBaseSheet = workbook.SheetNames.find(
    (name) => name === 'Fixture Base' || name.toLowerCase().includes('fixture')
  );

  if (!fixtureBaseSheet) {
    throw new Error('Fixture Base シートが見つかりません');
  }

  const sheet = workbook.Sheets[fixtureBaseSheet];
  const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (rawData.length < 3) {
    throw new Error('データが不足しています');
  }

  // ヘッダー行を取得（1行目）
  const headers = rawData[0] as (string | null)[];

  // カラムインデックスのマッピングを作成
  const columnIndices: Record<string, number> = {};
  headers.forEach((header, index) => {
    if (header && typeof header === 'string') {
      columnIndices[header.trim()] = index;
    }
  });

  // 必須カラムのチェック
  for (const col of REQUIRED_COLUMNS) {
    if (!(col in columnIndices)) {
      warnings.push(`必須カラム「${col}」が見つかりません`);
    }
  }

  // データ行を解析（3行目から、2行目はスキップ）
  const fixtures: Fixture[] = [];

  for (let i = 2; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || !Array.isArray(row) || row.every((cell) => cell === null || cell === undefined || cell === '')) {
      continue; // 空行をスキップ
    }

    const fixture: Partial<Fixture> = {};

    for (const [excelCol, fixtureKey] of Object.entries(COLUMN_MAPPING)) {
      const colIndex = columnIndices[excelCol];
      if (colIndex === undefined) continue;

      const value = row[colIndex];
      if (value === null || value === undefined || value === '') continue;

      // 型に応じた変換
      switch (fixtureKey) {
        case 'date':
          if (typeof value === 'number') {
            fixture[fixtureKey] = excelDateToJSDate(value);
          }
          break;
        case 'omitted':
        case 'lumen':
        case 'wattage':
        case 'va':
        case 'costFixture':
        case 'costDriver':
        case 'costOthers':
          fixture[fixtureKey] = typeof value === 'number' ? value : parseFloat(String(value));
          break;
        default:
          fixture[fixtureKey] = String(value).trim();
      }
    }

    // 必須フィールドのチェック
    if (fixture.specNo && fixture.manufacturer && fixture.fixture) {
      if (!fixture.luminaireType) {
        fixture.luminaireType = '不明';
      }
      fixtures.push(fixture as Fixture);
    }
  }

  return {
    fixtures,
    warnings,
    sheetNames: workbook.SheetNames,
  };
}
