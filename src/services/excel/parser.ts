/**
 * Excel解析サービス
 * IES照明器具リストExcelファイルをパースしてFixtureデータに変換する
 * ExcelJS を使用してスタイル情報を完全に保持
 */

import ExcelJS from 'exceljs';
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
  workbook: ExcelJS.Workbook;
  fixtureBaseSheetName: string;
}

/** IES File Check 更新用のデータ */
export interface IesCheckUpdate {
  specNo: string;
  filePath: string;
}

/**
 * セルの値を取得するヘルパー関数
 */
function getCellValue(cell: ExcelJS.Cell | undefined): unknown {
  if (!cell) return null;
  const value = cell.value;

  // ExcelJS の CellValue 型を処理
  if (value === null || value === undefined) return null;

  // 数式の場合は結果を取得
  if (typeof value === 'object' && 'result' in value) {
    return value.result;
  }

  // リッチテキストの場合
  if (typeof value === 'object' && 'richText' in value) {
    return value.richText.map((rt) => rt.text).join('');
  }

  // 日付の場合はそのまま返す
  if (value instanceof Date) {
    return value;
  }

  return value;
}

/**
 * バイナリデータからExcelを解析（非同期）
 */
export async function parseExcelFromBinary(data: Uint8Array): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();

  // Uint8Array から Buffer に変換して読み込み
  await workbook.xlsx.load(data.buffer);

  const warnings: string[] = [];

  // Fixture Baseシートを探す
  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const fixtureBaseSheetName = sheetNames.find(
    (name) => name === 'Fixture Base' || name.toLowerCase().includes('fixture')
  );

  if (!fixtureBaseSheetName) {
    throw new Error('Fixture Base シートが見つかりません');
  }

  const sheet = workbook.getWorksheet(fixtureBaseSheetName);
  if (!sheet) {
    throw new Error('Fixture Base シートが見つかりません');
  }

  // 行数チェック
  if (sheet.rowCount < 3) {
    throw new Error('データが不足しています');
  }

  // ヘッダー行を取得（1行目）
  const headerRow = sheet.getRow(1);
  const columnIndices: Record<string, number> = {};

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = getCellValue(cell);
    const header = value ? String(value).trim() : null;
    if (header) {
      columnIndices[header] = colNumber;
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

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 3) return; // 1-2行目はスキップ

    const fixture: Partial<Fixture> = {};
    let hasData = false;

    for (const [excelCol, fixtureKey] of Object.entries(COLUMN_MAPPING)) {
      const colIndex = columnIndices[excelCol];
      if (colIndex === undefined) continue;

      const cell = row.getCell(colIndex);
      const value = getCellValue(cell);
      if (value === null || value === undefined || value === '') continue;

      hasData = true;

      // 型に応じた変換
      switch (fixtureKey) {
        case 'date':
          if (value instanceof Date) {
            fixture[fixtureKey] = value;
          } else if (typeof value === 'number') {
            // Excel serial date
            const date = new Date((value - 25569) * 86400 * 1000);
            fixture[fixtureKey] = date;
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
    if (hasData && fixture.specNo && fixture.manufacturer && fixture.fixture) {
      if (!fixture.luminaireType) {
        fixture.luminaireType = '不明';
      }
      fixtures.push(fixture as Fixture);
    }
  });

  return {
    fixtures,
    warnings,
    sheetNames,
    workbook,
    fixtureBaseSheetName,
  };
}

/**
 * IES File CheckカラムをExcelに書き込む（非同期）
 * スタイル情報は完全に保持される
 */
export async function updateIesFileCheck(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  updates: IesCheckUpdate[]
): Promise<Uint8Array> {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    throw new Error(`シート "${sheetName}" が見つかりません`);
  }

  // ヘッダー行からカラムインデックスを取得
  const headerRow = sheet.getRow(1);
  let specNoColIndex = -1;
  let iesCheckColIndex = -1;

  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = getCellValue(cell);
    const header = value ? String(value).trim() : null;
    if (header === 'Spec No.') {
      specNoColIndex = colNumber;
    } else if (header === 'IES File Check') {
      iesCheckColIndex = colNumber;
    }
  });

  if (specNoColIndex === -1) {
    throw new Error('Spec No. カラムが見つかりません');
  }

  if (iesCheckColIndex === -1) {
    throw new Error('IES File Check カラムが見つかりません');
  }

  // 更新をマップに変換
  const updateMap = new Map<string, string>();
  for (const update of updates) {
    updateMap.set(update.specNo, update.filePath);
  }

  // データ行を更新（3行目から）- セルの値のみ更新、スタイルは自動的に保持
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber < 3) return; // 1-2行目はスキップ

    const specNoCell = row.getCell(specNoColIndex);
    const specNo = getCellValue(specNoCell);

    if (typeof specNo === 'string' && updateMap.has(specNo)) {
      const iesCheckCell = row.getCell(iesCheckColIndex);
      // 値のみ更新（スタイルは ExcelJS が自動的に保持）
      iesCheckCell.value = updateMap.get(specNo)!;
    }
  });

  // バイナリに変換（スタイル・テーマ情報は完全に保持）
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
