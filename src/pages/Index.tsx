import { useState, useEffect, useMemo } from "react";
import { Settings, Settings2, Search, Puzzle } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoComplete from "@/components/AutoComplete";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsModal from "@/components/SettingsModal";
import UnifiedSettings from "@/components/UnifiedSettings";
import { SearchEngine, defaultSearchEngines, mergeBuiltinEngines } from "@/lib/defaultSearchEngines";
import { getStoredValue, setStoredValue, migrateLocalStorageToSync } from "@/lib/storage";
import { deleteQuickLinkGroup, renameQuickLinkGroup } from "@/lib/quickLinkGroups";
import { buildDockSections } from "@/lib/macosDock";
import { ensureUrlHasProtocol } from "@/lib/url";
import { buildSearchEngineUrl } from "@/lib/searchEngineUrl";
import DockBar from "@/components/macos/DockBar";
import Launchpad from "@/components/macos/Launchpad";
import { useI18n } from "@/hooks/useI18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";

const Index = () => {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcutHints, setShowShortcutHints] = useState(false);
  const [showLaunchpad, setShowLaunchpad] = useState(false);

  const readOpenSearchInNewTab = () => {
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

  // 是否在新标签页中打开搜索结果（仅 newtab）
  const [openSearchInNewTab, setOpenSearchInNewTab] = useState(readOpenSearchInNewTab);

  // 从 localStorage 加载搜索引擎配置，并使用方案B自动补齐
  const [searchEngines, setSearchEngines] = useState<SearchEngine[]>(() => {
    try {
      const saved = localStorage.getItem('searchEngines');
      if (saved) return mergeBuiltinEngines(JSON.parse(saved));
    } catch {
      /* ignore */
    }
    return defaultSearchEngines;
  });

  // 从 localStorage 加载快速链接配置
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(() => {
    try {
      const saved = localStorage.getItem('quickLinks');
      if (saved) {
        return JSON.parse(saved).map((link: QuickLink) => ({
          ...link,
          enabled: link.enabled !== false,
        }));
      }
    } catch {
      /* ignore */
    }
    return [];
  });

  // 从 localStorage 加载快速链接分组
  const [quickLinkGroups, setQuickLinkGroups] = useState<QuickLinkGroup[]>(() => {
    try {
      const saved = localStorage.getItem('quickLinkGroups');
      if (saved) return JSON.parse(saved);
    } catch {
      /* ignore */
    }
    return [];
  });

  // 从 localStorage 加载当前选中的搜索引擎
  const [searchEngine, setSearchEngine] = useState(() => {
    try {
      const saved = localStorage.getItem('currentSearchEngine');
      if (saved) return saved;
    } catch {
      /* ignore */
    }
    const def = defaultSearchEngines.find(e => e.isDefault);
    return def ? def.id : "google";
  });

  // 首次加载：迁移并从 chrome.storage.sync 取值
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      await migrateLocalStorageToSync([
        'searchEngines',
        'quickLinks',
        'quickLinkGroups',
        'currentSearchEngine',
        'deletedBuiltinIds',
        'theme',
        'openSearchInNewTab',
        'openSearchInNewTabNewTab',
        'openSearchInNewTabPopup',
      ]);

      const fallbackEngineId = defaultSearchEngines.find(e => e.isDefault)?.id || "google";
      const [storedEngines, storedLinks, storedGroups, storedEngineId] = await Promise.all([
        getStoredValue<SearchEngine[]>('searchEngines', defaultSearchEngines),
        getStoredValue<QuickLink[]>('quickLinks', []),
        getStoredValue<QuickLinkGroup[]>('quickLinkGroups', []),
        getStoredValue<string>('currentSearchEngine', fallbackEngineId),
      ]);

      if (!mounted) return;

      const mergedEngines = mergeBuiltinEngines(storedEngines);
      setSearchEngines(mergedEngines);

      const normalizedLinks = storedLinks.map((link) => ({
        ...link,
        enabled: link.enabled !== undefined ? link.enabled : true,
      }));
      setQuickLinks(normalizedLinks);
      setQuickLinkGroups(storedGroups);

      if (storedEngineId) {
        setSearchEngine(storedEngineId);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const rehydrate = async () => {
      const fallbackEngineId = defaultSearchEngines.find(e => e.isDefault)?.id || "google";
      const [storedEngines, storedLinks, storedGroups, storedEngineId] = await Promise.all([
        getStoredValue<SearchEngine[]>('searchEngines', defaultSearchEngines),
        getStoredValue<QuickLink[]>('quickLinks', []),
        getStoredValue<QuickLinkGroup[]>('quickLinkGroups', []),
        getStoredValue<string>('currentSearchEngine', fallbackEngineId),
      ]);

      const mergedEngines = mergeBuiltinEngines(storedEngines);
      setSearchEngines(mergedEngines);

      const normalizedLinks = storedLinks.map((link) => ({
        ...link,
        enabled: link.enabled !== undefined ? link.enabled : true,
      }));
      setQuickLinks(normalizedLinks);
      setQuickLinkGroups(storedGroups);

      if (storedEngineId) {
        setSearchEngine(storedEngineId);
      }
    };

    const handler = () => {
      rehydrate();
      setOpenSearchInNewTab(readOpenSearchInNewTab());
    };
    window.addEventListener('settings:updated', handler);

    // 监听来自 background.js 的消息（如 popup 添加了新快速链接）
    const messageListener = (message: { type: string }) => {
      if (message.type === 'QUICK_LINKS_UPDATED') {
        rehydrate();
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromeRuntime = (chrome as any)?.runtime;
    if (typeof chrome !== 'undefined' && chromeRuntime?.onMessage) {
      chromeRuntime.onMessage.addListener(messageListener);
    }

    return () => {
      window.removeEventListener('settings:updated', handler);
      if (typeof chrome !== 'undefined' && chromeRuntime?.onMessage) {
        chromeRuntime.onMessage.removeListener(messageListener);
      }
    };
  }, []);

  // 保存搜索引擎配置到 localStorage
  useEffect(() => {
    setStoredValue('searchEngines', searchEngines);
  }, [searchEngines]);

  // 保存快速链接配置到 localStorage
  useEffect(() => {
    setStoredValue('quickLinks', quickLinks);
  }, [quickLinks]);

  // 保存快速链接分组到 localStorage
  useEffect(() => {
    setStoredValue('quickLinkGroups', quickLinkGroups);
  }, [quickLinkGroups]);

  // 保存当前选中的搜索引擎到 localStorage
  useEffect(() => {
    setStoredValue('currentSearchEngine', searchEngine);
  }, [searchEngine]);

  // 判断是否为URL
  const isURL = (text: string) => {
    // 不能包含空格
    if (text.includes(' ')) return false;

    try {
      const urlToTest = text.startsWith('http') ? text : `http://${text}`;
      new URL(urlToTest);

      // 包含 . 的域名（如 google.com）
      if (text.includes('.')) return true;

      // localhost 或 localhost:port 格式
      if (/^localhost(:\d+)?(\/.*)?$/i.test(text)) return true;

      // 带有协议前缀的 localhost
      if (/^https?:\/\/localhost(:\d+)?(\/.*)?$/i.test(text)) return true;

      // IP地址格式（如 127.0.0.1:8080）
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(text)) return true;

      return false;
    } catch {
      return false;
    }
  };

  // 处理Kagi Assistant搜索
  const handleKagiSearch = (query: string) => {
    const params = new URLSearchParams({
      q: query,
      internet: 'true'
    });

    const url = `https://kagi.com/assistant?${params.toString()}`;
    if (openSearchInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  // 导航到 URL 的辅助函数
  const navigateTo = (url: string) => {
    if (openSearchInNewTab) {
      window.open(url, '_blank');
    } else {
      window.location.href = url;
    }
  };

  // 处理搜索/导航
  const handleSubmit = (value: string) => {
    if (!value.trim()) return;

    console.log('Submitting search with engine:', searchEngine, 'value:', value);

    if (isURL(value)) {
      const url = ensureUrlHasProtocol(value);
      navigateTo(url);
    } else {
      const engine = searchEngines.find(e => e.id === searchEngine);
      if (engine) {
        if (engine.id === 'kagi-assistant') {
          handleKagiSearch(value);
        } else {
          const searchUrl = buildSearchEngineUrl(engine, value);
          if (searchUrl) {
            navigateTo(searchUrl);
          }
        }
      }
    }
  };

  // 修复搜索引擎切换 - 移除问题的useEffect
  const handleSearchEngineChange = (engineId: string) => {
    console.log('Changing search engine to:', engineId);
    setSearchEngine(engineId);
  };

  const isKagiSelected = searchEngine === 'kagi-assistant';

  // 打开浏览器设置页面
  const handleOpenBrowserSettings = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "OPEN_BROWSER_SETTINGS" });
    }
  };

  // 打开扩展程序页面
  const handleOpenExtensions = () => {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "OPEN_EXTENSIONS_PAGE" });
    }
  };

  // 删除快速链接
  const removeQuickLink = (id: string) => {
    setQuickLinks(links => links.filter(link => link.id !== id));
  };

  const confirmRemoveQuickLink = (id: string) => {
    const shouldDelete = window.confirm(
      `${t('quickLinks.confirmDelete')}\n${t('quickLinks.deleteWarning')}`
    );
    if (!shouldDelete) return;
    removeQuickLink(id);
  };

  // 复制链接地址到剪贴板
  const copyToClipboard = async (url: string) => {
    const normalizedUrl = ensureUrlHasProtocol(url);
    try {
      await navigator.clipboard.writeText(normalizedUrl);
    } catch {
      // fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = normalizedUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  // Dock 用的分组区段：未分组在前，其余按 order 排列，空分组保留（Dock 要显示它）
  const dockSections = useMemo(
    () => buildDockSections(quickLinks, quickLinkGroups),
    [quickLinks, quickLinkGroups]
  );

  // Launchpad 不展示空分组，否则整屏会出现一堆没有内容的标题
  const launchpadSections = useMemo(
    () => buildDockSections(quickLinks, quickLinkGroups, { keepEmpty: false }),
    [quickLinks, quickLinkGroups]
  );

  // 移动链接到分组
  const moveToGroup = (linkId: string, groupId: string | undefined) => {
    setQuickLinks(links => links.map(link =>
      link.id === linkId ? { ...link, groupId } : link
    ));
  };

  const addGroup = (name: string) => {
    const maxOrder = quickLinkGroups.reduce((max, g) => Math.max(max, g.order), -1);
    setQuickLinkGroups([...quickLinkGroups, { id: `group-${Date.now()}`, name, order: maxOrder + 1 }]);
  };

  const renameGroup = (groupId: string, name: string) => {
    setQuickLinkGroups(groups => renameQuickLinkGroup(groups, groupId, name));
  };

  // 删除分组时组内链接回到"未分组"，不会连带丢失
  const deleteGroup = (groupId: string) => {
    const next = deleteQuickLinkGroup(quickLinkGroups, quickLinks, groupId);
    setQuickLinkGroups(next.groups);
    setQuickLinks(next.links);
  };

  useEffect(() => {
    const def = searchEngines.find(e => e.isDefault);
    if (!def) return;
    setSearchEngine((prev) => (def.id !== prev ? def.id : prev));
  }, [searchEngines]);

  // 键盘快捷键：Alt + 数字 切换已启用的搜索引擎
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 检查按下的是 1-9
      const key = e.key;
      if (!/^[1-9]$/.test(key)) return;

      // 仅响应 Alt + 数字
      if (!e.altKey) return;

      const enabled = searchEngines.filter(s => s.enabled !== false);
      if (enabled.length === 0) return;

      const idx = Math.min(parseInt(key, 10) - 1, enabled.length - 1);
      const target = enabled[idx];
      if (target && target.id !== searchEngine) {
        e.preventDefault();
        setSearchEngine(target.id);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchEngines, searchEngine]);

  // 按住 Alt 键 400ms 后显示快捷键提示
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' && !timer) {
        timer = setTimeout(() => setShowShortcutHints(true), 400);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        setShowShortcutHints(false);
      }
    };

    // 窗口失焦时也隐藏提示
    const onBlur = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      setShowShortcutHints(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="h-screen bg-background flex flex-col items-center justify-center p-4 transition-colors overflow-hidden">

      {/* 右上角工具栏：底部整条留给 Dock，所以这些入口都收到顶部 */}
      <div className="absolute top-4 right-4 flex items-center gap-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenBrowserSettings}
          className="text-muted-foreground/60 hover:text-foreground"
          title={t('index.openBrowserSettings')}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenExtensions}
          className="text-muted-foreground/60 hover:text-foreground"
          title={t('index.openExtensions')}
        >
          <Puzzle className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(true)}
          className="text-muted-foreground hover:text-foreground"
          title={t('index.openSettings')}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* 主搜索区域：Dock 是 fixed 定位不占流，这里直接在视口里居中 */}
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
        {/* 日期：搜索栏上方唯一的文字，当作一个轻量的提示行 */}
        <p className="mb-6 text-center text-xs font-light tracking-wider text-muted-foreground">
          {new Date().toLocaleDateString(locale === 'zh-CN' ? "zh-CN" : "en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>

        {/* V0 风格搜索栏。末尾不留下边距，否则会被算进居中高度，视觉中心上移 */}
        <div className="w-full">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-600 pointer-events-none" />
            <AutoComplete
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              placeholder={isKagiSelected ? t('index.kagiPlaceholder') : t('index.placeholder')}
              className="liquid-glass w-full rounded-full pl-11 pr-24 py-3.5 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all text-sm"
            />

            {/* 搜索按钮在输入框内 - V0 风格 */}
            <Button
              onClick={() => handleSubmit(query)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isKagiSelected ? t('index.ask') : t('common.search')}
            </Button>
          </div>

          {/* 搜索引擎选择：做成一条分段控件，选中项是抬起的浅色药丸，
              而不是原来的纯黑实心块，以免在整页玻璃质感里显得突兀 */}
          <div className="mt-5 flex justify-center">
            <div className="liquid-glass inline-flex flex-wrap items-center justify-center gap-0.5 rounded-full p-1">
            {searchEngines.filter(e => e.enabled !== false).map((engine, index) => (
              <button
                key={engine.id}
                type="button"
                className={`relative inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 cursor-pointer select-none border-0 outline-none focus:outline-none ${searchEngine === engine.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground bg-transparent"
                  }`}
                onClick={() => handleSearchEngineChange(engine.id)}
                onMouseDown={(e) => e.preventDefault()}
              >
                {/* 快捷键数字提示 */}
                {showShortcutHints && index < 9 && (
                  <span className="absolute -top-2 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-primary text-primary-foreground shadow-sm animate-in fade-in zoom-in-50 duration-150">
                    {index + 1}
                  </span>
                )}
                {engine.name}
                {engine.isAI && (
                  <span className="rounded bg-foreground/10 px-1 py-0.5 text-[10px] leading-none text-foreground/70">AI</span>
                )}
              </button>
            ))}
            </div>
          </div>
        </div>

      </div>

      {/* 底部 Dock：取代原来的顶部分组 Tab */}
      <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
        <DockBar
          sections={dockSections}
          groups={quickLinkGroups}
          onGroupsChange={setQuickLinkGroups}
          onAddGroup={addGroup}
          onRenameGroup={renameGroup}
          onDeleteGroup={deleteGroup}
          onOpenLaunchpad={() => setShowLaunchpad(true)}
          onCopy={copyToClipboard}
          onMoveToGroup={moveToGroup}
          onRemoveLink={confirmRemoveQuickLink}
        />
      </div>

      {/* 全部展示：全屏 Launchpad */}
      {showLaunchpad && (
        <Launchpad
          sections={launchpadSections}
          groups={quickLinkGroups}
          onClose={() => setShowLaunchpad(false)}
          onCopy={copyToClipboard}
          onMoveToGroup={moveToGroup}
          onRemoveLink={confirmRemoveQuickLink}
        />
      )}

      {/* 统一设置弹窗 */}
      <SettingsModal
        title={t('settings.title')}
        open={showSettings}
        onOpenChange={setShowSettings}
      >
        <UnifiedSettings
          searchEngines={searchEngines}
          onSearchEnginesChange={setSearchEngines}
          quickLinks={quickLinks}
          onQuickLinksChange={setQuickLinks}
          quickLinkGroups={quickLinkGroups}
          onQuickLinkGroupsChange={setQuickLinkGroups}
        />
      </SettingsModal>
    </div>
  );
};

export default Index;
