import ExcelJS from 'exceljs';

/**
 * テスト用のExcelデータを非同期で生成
 */
export async function createMockExcelData(fixtures: Array<{
  specNo: string;
  manufacturer: string;
  fixture: string;
  luminaireType?: string;
  colorTemp?: string;
  wattage?: number;
}>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Fixture Base');

  // ヘッダー行
  const headers = [
    'Spec No.',
    'Date',
    'Rev.',
    'omitted',
    'Luminaire_Type',
    'Light source type',
    '色温度',
    '配光角',
    'Lumen',
    '消費電力',
    'VA',
    'Unit',
    'メーカー',
    'FIXTURE',
    '型番備考',
    '制御',
    'PSU',
    'ACCESSORIES',
    '注記',
    '製品リンク',
    'IES File Check',
    'Cost of Fixture',
    'Cost of Driver',
    'Cost of Others',
  ];

  // 1行目: ヘッダー
  sheet.addRow(headers);

  // 2行目: 空行（スキップ対象）
  sheet.addRow(headers.map(() => null));

  // 3行目以降: データ
  for (const f of fixtures) {
    const row: (string | number | null)[] = headers.map(() => null);
    row[0] = f.specNo;
    row[4] = f.luminaireType ?? 'ダウンライト';
    row[6] = f.colorTemp ?? '3000K';
    row[9] = f.wattage ?? 10;
    row[12] = f.manufacturer;
    row[13] = f.fixture;
    sheet.addRow(row);
  }

  // バイナリデータとして出力
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * コイズミ照明の器具を含むテストデータ
 */
export async function createKoizumiTestData(): Promise<Uint8Array> {
  return createMockExcelData([
    {
      specNo: 'A01',
      manufacturer: 'コイズミ照明',
      fixture: 'AD12345',
      luminaireType: 'ダウンライト',
      colorTemp: '2700K',
      wattage: 8.5,
    },
    {
      specNo: 'A02',
      manufacturer: 'コイズミ照明',
      fixture: 'AD67890',
      luminaireType: 'スポットライト',
      colorTemp: '3000K',
      wattage: 12,
    },
    {
      specNo: 'B01',
      manufacturer: '大光電機',
      fixture: 'DDL-1234',
      luminaireType: 'ダウンライト',
      colorTemp: '4000K',
      wattage: 15,
    },
  ]);
}
