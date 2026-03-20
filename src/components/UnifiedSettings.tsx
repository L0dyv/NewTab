import { useState } from "react";
import { Settings, Search, Link, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/hooks/useI18n";
import SearchEngineConfig from "./SearchEngineConfig";
import QuickLinksConfig from "./QuickLinksConfig";
import GeneralSettingsSection from "./GeneralSettingsSection";
import DataManagementSection from "./DataManagementSection";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

type SettingsCategory = 'general' | 'searchEngines' | 'quickLinks' | 'dataManagement';

interface SearchEngine {
  id: string;
  name: string;
  url: string;
  isDefault?: boolean;
  isAI?: boolean;
  enabled?: boolean;
}

interface UnifiedSettingsProps {
  searchEngines: SearchEngine[];
  onSearchEnginesChange: (engines: SearchEngine[]) => void;
  quickLinks: QuickLink[];
  onQuickLinksChange: (links: QuickLink[]) => void;
  quickLinkGroups: QuickLinkGroup[];
  onQuickLinkGroupsChange: (groups: QuickLinkGroup[]) => void;
  onSettingsChanged?: () => void;
}

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function NavItem({ active, onClick, icon, children }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left",
        active
          ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100 border-r-2 border-stone-800 dark:border-stone-200"
          : "text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800/50 hover:text-stone-900 dark:hover:text-stone-100"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export default function UnifiedSettings({
  searchEngines,
  onSearchEnginesChange,
  quickLinks,
  onQuickLinksChange,
  quickLinkGroups,
  onQuickLinkGroupsChange,
  onSettingsChanged,
}: UnifiedSettingsProps) {
  const { t } = useI18n();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('general');

  const categories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: t('settings.general'), icon: <Settings className="h-4 w-4" /> },
    { id: 'searchEngines', label: t('settings.searchEnginesShort'), icon: <Search className="h-4 w-4" /> },
    { id: 'quickLinks', label: t('settings.quickLinksShort'), icon: <Link className="h-4 w-4" /> },
    { id: 'dataManagement', label: t('settings.dataManagement'), icon: <Database className="h-4 w-4" /> },
  ];

  return (
    <div className="flex" style={{ height: 'calc(80vh - 80px)', maxHeight: '600px' }}>
      {/* 左侧导航 */}
      <nav className="w-44 border-r border-border flex-shrink-0 bg-muted/30">
        <div className="py-2">
          {categories.map((category) => (
            <NavItem
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => setActiveCategory(category.id)}
              icon={category.icon}
            >
              {category.label}
            </NavItem>
          ))}
        </div>
      </nav>

      {/* 右侧内容区 */}
      <div className="flex-1 overflow-y-auto">
        {activeCategory === 'general' && (
          <GeneralSettingsSection onSettingsChanged={onSettingsChanged} />
        )}
        {activeCategory === 'searchEngines' && (
          <SearchEngineConfig
            engines={searchEngines}
            onEnginesChange={onSearchEnginesChange}
          />
        )}
        {activeCategory === 'quickLinks' && (
          <QuickLinksConfig
            links={quickLinks}
            onLinksChange={onQuickLinksChange}
            groups={quickLinkGroups}
            onGroupsChange={onQuickLinkGroupsChange}
          />
        )}
        {activeCategory === 'dataManagement' && (
          <DataManagementSection onSettingsChanged={onSettingsChanged} />
        )}
      </div>
    </div>
  );
}
