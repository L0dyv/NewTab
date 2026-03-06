import { useState, useEffect } from 'react';
import { useI18n } from '@/hooks/useI18n';

interface GeneralSettingsSectionProps {
  onSettingsChanged?: () => void;
}

export default function GeneralSettingsSection({ onSettingsChanged }: GeneralSettingsSectionProps) {
  const { t, locale, setLocale, supportedLocales } = useI18n();

  const readOpenSearchInNewTabNewTab = () => {
    try {
      const scoped = localStorage.getItem('openSearchInNewTabNewTab');
      if (scoped !== null) return scoped === 'true';
      const legacy = localStorage.getItem('openSearchInNewTab') === 'true';
      localStorage.setItem('openSearchInNewTabNewTab', String(legacy));
      return legacy;
    } catch {
      return false;
    }
  };

  const [openSearchInNewTabNewTab, setOpenSearchInNewTabNewTab] = useState(readOpenSearchInNewTabNewTab);

  // 监听设置变化
  useEffect(() => {
    const handler = () => {
      try {
        setOpenSearchInNewTabNewTab(readOpenSearchInNewTabNewTab());
      } catch {
        // ignore
      }
    };
    window.addEventListener('settings:updated', handler);
    return () => window.removeEventListener('settings:updated', handler);
  }, []);

  const handleOpenInNewTabChange = (checked: boolean) => {
    setOpenSearchInNewTabNewTab(checked);
    try {
      localStorage.setItem('openSearchInNewTabNewTab', String(checked));
      localStorage.setItem('openSearchInNewTab', String(checked));
      window.dispatchEvent(new CustomEvent('settings:updated'));
    } catch {
      // ignore
    }
    onSettingsChanged?.();
  };

  return (
    <div className="p-6 space-y-6">
      {/* 语言设置 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('language.title')}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('language.current')}</p>
          </div>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en')}
            className="px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {supportedLocales.map((loc) => (
              <option key={loc.value} value={loc.value}>{loc.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 搜索行为设置 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <h3 className="text-sm font-medium text-foreground mb-3">{t('generalSettings.searchBehavior')}</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">{t('generalSettings.openInNewTabNewTab')}</p>
            <p className="text-xs text-muted-foreground">{t('generalSettings.openInNewTabNewTabDesc')}</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={openSearchInNewTabNewTab}
              onChange={(e) => handleOpenInNewTabChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-ring rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-stone-600 peer-checked:bg-stone-600 dark:peer-checked:bg-stone-400"></div>
          </label>
        </div>
      </div>

      {/* 版本号 */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        v{__APP_VERSION__}
      </div>
    </div>
  );
}
