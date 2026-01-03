import { describe, it, expect } from 'vitest';
import { parseExcelFromBinary } from './parser';
import { createMockExcelData, createKoizumiTestData } from '../../test/mocks/excel-data';

describe('Excel Parser', () => {
  describe('parseExcelFromBinary', () => {
    it('Fixture Baseシートから器具データを正しく解析する', () => {
      const excelData = createMockExcelData([
        {
          specNo: 'A01',
          manufacturer: 'コイズミ照明',
          fixture: 'AD12345',
          luminaireType: 'ダウンライト',
          colorTemp: '2700K',
          wattage: 8.5,
        },
      ]);

      const result = parseExcelFromBinary(excelData);

      expect(result.fixtures).toHaveLength(1);
      expect(result.fixtures[0]).toMatchObject({
        specNo: 'A01',
        manufacturer: 'コイズミ照明',
        fixture: 'AD12345',
        luminaireType: 'ダウンライト',
        colorTemp: '2700K',
        wattage: 8.5,
      });
    });

    it('複数の器具データを解析できる', () => {
      const excelData = createKoizumiTestData();

      const result = parseExcelFromBinary(excelData);

      expect(result.fixtures).toHaveLength(3);
      expect(result.fixtures.map((f) => f.specNo)).toEqual(['A01', 'A02', 'B01']);
    });

    it('シート名一覧を返す', () => {
      const excelData = createMockExcelData([
        { specNo: 'A01', manufacturer: 'Test', fixture: 'TEST-001' },
      ]);

      const result = parseExcelFromBinary(excelData);

      expect(result.sheetNames).toContain('Fixture Base');
    });

    it('必須フィールドが欠けている行はスキップする', () => {
      const excelData = createMockExcelData([
        { specNo: 'A01', manufacturer: 'コイズミ照明', fixture: 'AD12345' },
        { specNo: '', manufacturer: 'コイズミ照明', fixture: 'AD67890' }, // specNo欠損
        { specNo: 'A03', manufacturer: '', fixture: 'AD11111' }, // manufacturer欠損
        { specNo: 'A04', manufacturer: 'コイズミ照明', fixture: '' }, // fixture欠損
      ]);

      const result = parseExcelFromBinary(excelData);

      // 必須フィールドが揃っている行のみ
      expect(result.fixtures).toHaveLength(1);
      expect(result.fixtures[0].specNo).toBe('A01');
    });

    it('メーカー名でフィルタリングできる形式で返す', () => {
      const excelData = createKoizumiTestData();

      const result = parseExcelFromBinary(excelData);

      const koizumiFixtures = result.fixtures.filter(
        (f) => f.manufacturer === 'コイズミ照明'
      );
      const daikoFixtures = result.fixtures.filter(
        (f) => f.manufacturer === '大光電機'
      );

      expect(koizumiFixtures).toHaveLength(2);
      expect(daikoFixtures).toHaveLength(1);
    });
  });
});
