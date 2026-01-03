import { useState, useMemo } from 'react';
import { Button } from 'flowbite-react';
import { HiSearch, HiCheck, HiX } from 'react-icons/hi';
import type { Fixture, FixtureSelection } from '../../types/fixture';

interface FixtureTableProps {
  fixtures: Fixture[];
  selections: FixtureSelection[];
  onSelectionChange: (selections: FixtureSelection[]) => void;
  supportedManufacturers: string[];
}

function StatusBadge({ status }: { status?: string }) {
  const styles: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    downloading: 'bg-blue-100 text-blue-800',
    error: 'bg-red-100 text-red-800',
    default: 'bg-gray-100 text-gray-800',
  };
  const labels: Record<string, string> = {
    success: '完了',
    downloading: '処理中',
    error: 'エラー',
    default: '未処理',
  };
  const style = styles[status || 'default'] || styles.default;
  const label = labels[status || 'default'] || labels.default;

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded ${style}`}>
      {label}
    </span>
  );
}

export function FixtureTable({
  fixtures,
  selections,
  onSelectionChange,
  supportedManufacturers,
}: FixtureTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupported, setFilterSupported] = useState(false);

  // フィルタリングされた器具リスト
  const filteredFixtures = useMemo(() => {
    return fixtures.filter((fixture) => {
      // 検索クエリでフィルター
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matches =
          fixture.specNo.toLowerCase().includes(query) ||
          fixture.manufacturer.toLowerCase().includes(query) ||
          fixture.fixture.toLowerCase().includes(query) ||
          fixture.luminaireType.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // 対応メーカーでフィルター
      if (filterSupported) {
        const isSupported = supportedManufacturers.some((m) =>
          fixture.manufacturer.includes(m)
        );
        if (!isSupported) return false;
      }

      return true;
    });
  }, [fixtures, searchQuery, filterSupported, supportedManufacturers]);

  // 選択状態のマップ
  const selectionMap = useMemo(() => {
    const map = new Map<string, FixtureSelection>();
    selections.forEach((s) => map.set(s.fixture.specNo, s));
    return map;
  }, [selections]);

  // 全選択/全解除
  const handleSelectAll = () => {
    const allSelected = filteredFixtures.every(
      (f) => selectionMap.get(f.specNo)?.selected
    );

    const newSelections = fixtures.map((fixture) => {
      const isFiltered = filteredFixtures.some((f) => f.specNo === fixture.specNo);
      const current = selectionMap.get(fixture.specNo);
      return {
        fixture,
        selected: isFiltered ? !allSelected : current?.selected || false,
        downloadStatus: current?.downloadStatus,
        downloadError: current?.downloadError,
      };
    });

    onSelectionChange(newSelections);
  };

  // 個別選択
  const handleSelect = (specNo: string) => {
    const newSelections = selections.map((s) => {
      if (s.fixture.specNo === specNo) {
        return { ...s, selected: !s.selected };
      }
      return s;
    });
    onSelectionChange(newSelections);
  };

  // 対応メーカーかどうか
  const isSupported = (manufacturer: string) => {
    return supportedManufacturers.some((m) => manufacturer.includes(m));
  };

  const selectedCount = selections.filter((s) => s.selected).length;
  const allSelected =
    filteredFixtures.length > 0 &&
    filteredFixtures.every((f) => selectionMap.get(f.specNo)?.selected);

  return (
    <div className="space-y-4">
      {/* ツールバー */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="検索（Spec No.、メーカー、型番）"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <Button
          color={filterSupported ? 'blue' : 'gray'}
          size="sm"
          onClick={() => setFilterSupported(!filterSupported)}
        >
          対応メーカーのみ
        </Button>
      </div>

      {/* サマリー */}
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <span>全{fixtures.length}件</span>
        <span>表示: {filteredFixtures.length}件</span>
        <span className="font-semibold text-blue-600">選択中: {selectedCount}件</span>
      </div>

      {/* テーブル */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                />
              </th>
              <th className="px-4 py-3">Spec No.</th>
              <th className="px-4 py-3">メーカー</th>
              <th className="px-4 py-3">型番</th>
              <th className="px-4 py-3">器具タイプ</th>
              <th className="px-4 py-3">色温度</th>
              <th className="px-4 py-3">配光角</th>
              <th className="w-20 px-4 py-3">対応</th>
              <th className="w-24 px-4 py-3">状態</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredFixtures.map((fixture) => {
              const selection = selectionMap.get(fixture.specNo);
              const supported = isSupported(fixture.manufacturer);

              return (
                <tr
                  key={fixture.specNo}
                  className={`bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    !supported ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selection?.selected || false}
                      onChange={() => handleSelect(fixture.specNo)}
                      disabled={!supported}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {fixture.specNo}
                  </td>
                  <td className="px-4 py-3">{fixture.manufacturer}</td>
                  <td className="px-4 py-3 font-mono text-xs">{fixture.fixture}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{fixture.luminaireType}</td>
                  <td className="px-4 py-3">{fixture.colorTemp || '-'}</td>
                  <td className="px-4 py-3">{fixture.beamAngle || '-'}</td>
                  <td className="px-4 py-3">
                    {supported ? (
                      <HiCheck className="w-5 h-5 text-green-500" />
                    ) : (
                      <HiX className="w-5 h-5 text-gray-400" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={selection?.downloadStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
