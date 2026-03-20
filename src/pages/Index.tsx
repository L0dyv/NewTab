import { useState, useEffect, useMemo } from "react";
import { Settings, Settings2, Search, Puzzle, Copy, Trash2, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import AutoComplete from "@/components/AutoComplete";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsModal from "@/components/SettingsModal";
import UnifiedSettings from "@/components/UnifiedSettings";
import { SearchEngine, defaultSearchEngines, mergeBuiltinEngines } from "@/lib/defaultSearchEngines";
import { getStoredValue, setStoredValue, migrateLocalStorageToSync } from "@/lib/storage";
import { ensureUrlHasProtocol } from "@/lib/url";
import { buildSearchEngineUrl } from "@/lib/searchEngineUrl";
import QuickLinkIcon from "@/components/QuickLinkIcon";
import { useI18n } from "@/hooks/useI18n";
import type { QuickLink, QuickLinkGroup } from "@/lib/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const Index = () => {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showShortcutHints, setShowShortcutHints] = useState(false);

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

  // 将链接按分组组织
  const groupedLinks = useMemo(() => {
    const enabledLinks = quickLinks.filter(l => l.enabled === true);
    const sortedGroups = [...quickLinkGroups].sort((a, b) => a.order - b.order);
    const ungrouped = enabledLinks.filter(l => !l.groupId);
    const result: { group: QuickLinkGroup | null; links: QuickLink[] }[] = [];
    if (ungrouped.length > 0) result.push({ group: null, links: ungrouped });
    for (const g of sortedGroups) {
      const gl = enabledLinks.filter(l => l.groupId === g.id);
      if (gl.length > 0) result.push({ group: g, links: gl });
    }
    return result;
  }, [quickLinks, quickLinkGroups]);

  const hasAnyGroup = quickLinkGroups.length > 0;

  // 移动链接到分组
  const moveToGroup = (linkId: string, groupId: string | undefined) => {
    setQuickLinks(links => links.map(link =>
      link.id === linkId ? { ...link, groupId } : link
    ));
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 transition-colors">
      {/* 设置和主题切换按钮 */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <ThemeToggle />
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setShowSettings(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* 主搜索区域 */}
      <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
        {/* 欢迎标题区域 - V0 风格 */}
        <div className="text-center mb-12">
          <p className="text-xs text-muted-foreground font-light mb-3 tracking-wider">
            {new Date().toLocaleDateString(locale === 'zh-CN' ? "zh-CN" : "en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-5xl md:text-6xl font-light text-foreground tracking-tight mb-2">
            {t('index.welcome')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('index.whatToDo')}</p>
        </div>

        {/* V0 风格搜索栏 */}
        <div className="w-full mb-12">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-600 pointer-events-none" />
            <AutoComplete
              value={query}
              onChange={setQuery}
              onSubmit={handleSubmit}
              placeholder={isKagiSelected ? t('index.kagiPlaceholder') : t('index.placeholder')}
              className="w-full bg-card border border-border rounded-full pl-11 pr-24 py-3.5 text-foreground placeholder-stone-400 dark:placeholder-stone-600 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all text-sm"
            />

            {/* 搜索按钮在输入框内 - V0 风格 */}
            <Button
              onClick={() => handleSubmit(query)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 h-9 px-5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm shadow-sm hover:shadow-md transition-all duration-200"
            >
              {isKagiSelected ? t('index.ask') : t('common.search')}
            </Button>
          </div>

          {/* 搜索引擎选择 - V0 风格圆角标签 */}
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {searchEngines.filter(e => e.enabled !== false).map((engine, index) => (
              <button
                key={engine.id}
                type="button"
                className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer select-none border-0 outline-none focus:outline-none ${searchEngine === engine.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-stone-600 dark:text-stone-400 hover:bg-accent hover:text-foreground bg-transparent"
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
                  <span className="ml-1 text-xs bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 px-1.5 py-0.5 rounded">AI</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 快速链接区域 - 分组渲染（V0 风格）*/}
        {groupedLinks.length > 0 && (
          <div className="w-full space-y-4">
            {groupedLinks.map(({ group, links: groupLinks }) => (
              <div key={group?.id ?? '__ungrouped__'}>
                {/* 分组标题：仅在有自定义分组时显示，未分组不显示标题 */}
                {group && hasAnyGroup && (
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs tracking-widest text-muted-foreground/60 uppercase select-none">
                      {group.name}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className="grid grid-cols-4 md:grid-cols-6 gap-4 md:gap-6">
                  {groupLinks.map((link) => (
                    <ContextMenu key={link.id}>
                      <ContextMenuTrigger asChild>
                        <a
                          href={ensureUrlHasProtocol(link.url)}
                          className="flex items-center justify-center py-4 px-2 rounded-lg hover:bg-accent/50 transition-colors duration-200 group cursor-pointer"
                          title={link.name}
                        >
                          <div className="group-hover:scale-110 transition-transform duration-200">
                            <QuickLinkIcon
                              name={link.name}
                              url={link.url}
                              icon={link.icon}
                              size={32}
                            />
                          </div>
                        </a>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onClick={() => copyToClipboard(link.url)}>
                          <Copy className="mr-2 h-4 w-4" />
                          {t('contextMenu.copyLink')}
                        </ContextMenuItem>
                        {hasAnyGroup && (
                          <>
                            <ContextMenuSub>
                              <ContextMenuSubTrigger>
                                <FolderInput className="mr-2 h-4 w-4" />
                                {t('contextMenu.moveToGroup')}
                              </ContextMenuSubTrigger>
                              <ContextMenuSubContent>
                                <ContextMenuItem
                                  onClick={() => moveToGroup(link.id, undefined)}
                                  disabled={!link.groupId}
                                >
                                  {t('contextMenu.ungrouped')}
                                </ContextMenuItem>
                                <ContextMenuSeparator />
                                {quickLinkGroups
                                  .sort((a, b) => a.order - b.order)
                                  .map((g) => (
                                    <ContextMenuItem
                                      key={g.id}
                                      onClick={() => moveToGroup(link.id, g.id)}
                                      disabled={link.groupId === g.id}
                                    >
                                      {g.name}
                                    </ContextMenuItem>
                                  ))}
                              </ContextMenuSubContent>
                            </ContextMenuSub>
                          </>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => confirmRemoveQuickLink(link.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t('contextMenu.delete')}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 右下角浏览器设置和扩展程序页面按钮 */}
      <div className="fixed bottom-4 right-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenBrowserSettings}
          className="text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50 transition-all duration-200"
          title={t('index.openBrowserSettings')}
        >
          <Settings2 className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenExtensions}
          className="text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/50 transition-all duration-200"
          title={t('index.openExtensions')}
        >
          <Puzzle className="h-5 w-5" />
        </Button>
      </div>

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
