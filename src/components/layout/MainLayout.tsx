import { HiDownload, HiCog } from 'react-icons/hi';

interface MainLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

interface NavItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  page: string;
  currentPage: string;
  onClick: (page: string) => void;
}

function NavItem({ icon: Icon, label, page, currentPage, onClick }: NavItemProps) {
  const isActive = currentPage === page;
  return (
    <button
      onClick={() => onClick(page)}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left rounded-lg transition-colors ${
        isActive
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

export function MainLayout({ children, currentPage, onNavigate }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* サイドバー */}
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">AutoSight</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem
            icon={HiDownload}
            label="IES取得"
            page="wizard"
            currentPage={currentPage}
            onClick={onNavigate}
          />
          <div className="border-t border-gray-200 dark:border-gray-700 my-4" />
          <NavItem
            icon={HiCog}
            label="設定"
            page="settings"
            currentPage={currentPage}
            onClick={onNavigate}
          />
        </nav>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  );
}
